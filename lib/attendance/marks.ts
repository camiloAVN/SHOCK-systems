import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { consumeAttempt, type LivenessStep } from '@/lib/attendance/enrollment'
import {
  applyTimeVerification,
  canMarkNow,
  COUNTED_STATUSES,
  evaluateLocation,
  faceAttemptsState,
  faceMatches,
  nextMarkType,
  rejectionReasons,
  type MarkReason,
  type MarkStatus,
  type MarkType,
} from '@/lib/attendance/mark-rules'
import { compareFaces, isJpeg } from '@/lib/attendance/rekognition'
import { shiftWindow } from '@/lib/attendance/shifts'
import { resolveOfflineTime, signTimeAnchor, verifyTimeAnchor } from '@/lib/attendance/time-anchor'
import { mobileSecret } from '@/lib/mobile/jwt'
import { deletePrivateObject, getPrivateObject, markImageKey, putPrivateObject } from '@/lib/storage/r2-private'
import { MobileApiError } from '@/lib/mobile/errors'

/**
 * Marcación de asistencia en línea (Fase 6). El servidor decide todo: tipo (entrada/salida),
 * ventana, rostro, distancia y hora oficial. Reglas puras en mark-rules.ts.
 */

/** Prueba de vida hecha sin conexión: el orden del reto lo eligió el teléfono, no el servidor */
export const OFFLINE_LIVENESS_METHOD = 'device_challenge_offline_v1'

/** Ancla de hora firmada para esta persona (la app la usa para marcar sin conexión, Fase 8). */
export function timeAnchorFor(userId: string, now: Date = new Date()) {
  return { serverTime: now.toISOString(), token: signTimeAnchor(mobileSecret(), userId, now.getTime()) }
}

const lockKey = (userId: string, shiftId: string) => `${userId}:${shiftId}`

async function safeDelete(key: string | null) {
  if (!key) return
  try {
    await deletePrivateObject(key)
  } catch (error) {
    console.error('[MARKS] No se pudo borrar la selfie del bucket privado:', key, error)
  }
}

/** El turno debe ser de la persona HOY (directo o por un equipo al que pertenece) y el área estar activa. */
export async function resolveUserShift(userId: string, shiftId: string) {
  const shift = await prisma.attendanceShift.findUnique({
    where: { id: shiftId },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      assignment: {
        select: {
          id: true,
          userId: true,
          teamId: true,
          area: { select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true, isActive: true } },
        },
      },
    },
  })
  if (!shift || !shift.assignment.area.isActive) throw new MobileApiError('SHIFT_NOT_ASSIGNED')
  const { assignment } = shift
  if (assignment.userId !== userId) {
    const member = assignment.teamId
      ? await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: assignment.teamId, userId } }, select: { id: true } })
      : null
    if (!member) throw new MobileApiError('SHIFT_NOT_ASSIGNED')
  }
  return shift
}

export type MarkingState = {
  next: MarkType
  openEntryAt: string | null
  locked: boolean
  failedFaceAttempts: number
  attemptsLeft: number
}

type Db = Prisma.TransactionClient | typeof prisma

/** Estado de marcación de la persona en varios turnos (lo usan la lista de la app y el envío). */
export async function markingStates(userId: string, shiftIds: string[], db: Db = prisma): Promise<Map<string, MarkingState>> {
  const result = new Map<string, MarkingState>()
  if (shiftIds.length === 0) return result
  const [marks, locks] = await Promise.all([
    db.attendanceMark.findMany({
      where: { userId, shiftId: { in: shiftIds }, status: { in: [...COUNTED_STATUSES, 'FACE_MISMATCH'] } },
      select: { shiftId: true, type: true, status: true, officialAt: true },
    }),
    db.attendanceShiftLock.findMany({
      where: { userId, shiftId: { in: shiftIds } },
      select: { shiftId: true, unlockedAt: true },
    }),
  ])
  for (const shiftId of shiftIds) {
    const own = marks.filter((m) => m.shiftId === shiftId)
    const shiftLocks = locks.filter((l) => l.shiftId === shiftId)
    const locked = shiftLocks.some((l) => !l.unlockedAt)
    // Los fallos de rostro cuentan desde el último desbloqueo
    const lastUnlock = shiftLocks.reduce<Date | null>((max, l) => (l.unlockedAt && (!max || l.unlockedAt > max) ? l.unlockedAt : max), null)
    const failed = own.filter((m) => m.status === 'FACE_MISMATCH' && (!lastUnlock || m.officialAt > lastUnlock)).length
    const { next, openEntryAt } = nextMarkType(own.filter((m) => COUNTED_STATUSES.includes(m.status)) as { type: MarkType; officialAt: Date }[])
    result.set(shiftId, {
      next,
      openEntryAt: openEntryAt?.toISOString() ?? null,
      locked,
      failedFaceAttempts: failed,
      attemptsLeft: locked ? 0 : faceAttemptsState(failed).attemptsLeft,
    })
  }
  return result
}

const markSelect = {
  id: true,
  clientMarkId: true,
  type: true,
  status: true,
  reasons: true,
  officialAt: true,
  distanceMeters: true,
  accuracyMeters: true,
  similarity: true,
  offline: true,
  shift: { select: { id: true, startsAt: true, endsAt: true, assignment: { select: { area: { select: { id: true, name: true, radiusMeters: true } } } } } },
  review: { select: { decision: true, note: true, createdAt: true } },
} satisfies Prisma.AttendanceMarkSelect

type MarkRow = Prisma.AttendanceMarkGetPayload<{ select: typeof markSelect }>

export function serializeMark(m: MarkRow) {
  return {
    id: m.id,
    clientMarkId: m.clientMarkId,
    type: m.type,
    status: m.status,
    reasons: m.reasons,
    officialAt: m.officialAt.toISOString(),
    distanceMeters: m.distanceMeters,
    accuracyMeters: m.accuracyMeters,
    similarity: m.similarity,
    offline: m.offline,
    area: { id: m.shift.assignment.area.id, name: m.shift.assignment.area.name, radiusMeters: m.shift.assignment.area.radiusMeters },
    shift: { id: m.shift.id, startsAt: m.shift.startsAt.toISOString(), endsAt: m.shift.endsAt.toISOString() },
    // Decisión del supervisor sobre una marcación en revisión (Fase 7)
    review: m.review ? { decision: m.review.decision, note: m.review.note, reviewedAt: m.review.createdAt.toISOString() } : null,
  }
}

export type SubmitMarkParams = {
  userId: string
  installationId: string | null
  clientMarkId: string
  shiftId: string
  /** Intento de prueba de vida emitido por el servidor (marcación en línea) */
  attemptId: string | null
  /**
   * Marcación hecha sin conexión y enviada después (Fase 8). La hora oficial se calcula con el
   * ancla; la prueba de vida la hizo el teléfono con un reto propio (`steps`).
   */
  offline: { timeAnchor: string | null; elapsedSinceAnchorMs: number | null; steps: LivenessStep[] } | null
  latitude: number
  longitude: number
  accuracyMeters: number | null
  mocked: boolean
  deviceAt: Date | null
  image: Buffer
  /** Precondiciones ya calculadas por la ruta */
  consentAccepted: boolean
  deviceBound: boolean
}

export async function submitMark(p: SubmitMarkParams) {
  // 1. Reenvío de la misma marcación (respuesta perdida): se devuelve la ya registrada
  const existing = await prisma.attendanceMark.findUnique({
    where: { userId_clientMarkId: { userId: p.userId, clientMarkId: p.clientMarkId } },
    select: markSelect,
  })
  if (existing) {
    const state = (await markingStates(p.userId, [existing.shift.id])).get(existing.shift.id)!
    return { mark: serializeMark(existing), state, duplicate: true }
  }

  // Hora de la marcación: ahora, o la calculada con el ancla si se hizo sin conexión
  const receivedAt = new Date()
  let markAt = receivedAt
  let timeVerified = true
  if (p.offline) {
    const anchorMs = p.offline.timeAnchor ? verifyTimeAnchor(mobileSecret(), p.userId, p.offline.timeAnchor) : null
    const time = resolveOfflineTime({
      anchorMs,
      anchorInvalid: !!p.offline.timeAnchor && anchorMs === null,
      elapsedMs: p.offline.elapsedSinceAnchorMs,
      deviceAt: p.deviceAt,
      receivedAt,
    })
    markAt = time.officialAt
    timeVerified = time.verified
    if (!time.verified) console.info(`[MARKS] Hora sin verificar (${time.problem}) en marcación sin conexión de ${p.userId}`)
  } else if (!p.attemptId) {
    throw new MobileApiError('LIVENESS_ATTEMPT_INVALID')
  }

  // 2. Precondiciones: sin ellas no se puede marcar (no queda registro)
  if (!p.consentAccepted) throw new MobileApiError('CONSENT_REQUIRED')
  const enrollment = await prisma.faceEnrollment.findFirst({
    where: { userId: p.userId, status: 'APPROVED', imageKey: { not: null } },
    select: { imageKey: true },
  })
  if (!enrollment?.imageKey) throw new MobileApiError('ENROLLMENT_REQUIRED')
  const shift = await resolveUserShift(p.userId, p.shiftId)
  const area = shift.assignment.area

  const before = (await markingStates(p.userId, [shift.id])).get(shift.id)!
  if (before.locked) throw new MobileApiError('SHIFT_LOCKED')
  const window = canMarkNow(before.next, shift, markAt)
  if (!window.ok) {
    const { opensAt, closesAt } = shiftWindow(shift)
    throw new MobileApiError(
      'MARK_WINDOW_CLOSED',
      window.reason === 'NOT_YET_OPEN' ? 'Todavía no se puede marcar la entrada de este turno' : 'Ya cerró el horario para marcar la entrada de este turno',
      { reason: window.reason, opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString() }
    )
  }

  // 3. Intento de prueba de vida (un solo uso) y foto
  // (Sin conexión no hay intento del servidor: se registra uno con el reto del teléfono al guardar)
  const attempt = p.offline ? null : await consumeAttempt(p.attemptId!, p.userId, 'mark')
  if (p.image.length > ATTENDANCE_CONFIG.face.selfieMaxBytes) throw new MobileApiError('IMAGE_TOO_LARGE')
  if (!isJpeg(p.image)) throw new MobileApiError('INVALID_IMAGE')

  // 4. Evaluación (fuera de la transacción: Rekognition tarda)
  let status: MarkStatus
  let reasons: MarkReason[]
  let similarity: number | null = null
  let distance: number | null = null
  const rejected = rejectionReasons({ mocked: p.mocked, deviceBound: p.deviceBound })
  if (rejected.length) {
    // Ubicación simulada o teléfono no vinculado: se registra el intento, sin comparar rostro ni guardar la selfie
    status = 'REJECTED'
    reasons = rejected
  } else {
    const face = await compareFaces(await getPrivateObject(enrollment.imageKey), p.image)
    similarity = face.found ? face.similarity : null
    const match = faceMatches(face)
    if (!match.ok) {
      status = 'FACE_MISMATCH'
      reasons = [match.reason!]
    } else {
      const location = applyTimeVerification(
        evaluateLocation({ latitude: p.latitude, longitude: p.longitude, accuracyMeters: p.accuracyMeters }, area),
        timeVerified
      )
      status = location.status
      reasons = location.reasons
      distance = location.distanceMeters
    }
  }
  if (distance === null) {
    // También se guarda la distancia de los intentos fallidos (útil para la revisión)
    distance = evaluateLocation({ latitude: p.latitude, longitude: p.longitude, accuracyMeters: p.accuracyMeters }, area).distanceMeters
  }

  // 5. Selfie al bucket privado (no en los rechazados)
  const id = randomUUID().replace(/-/g, '')
  const selfieKey = status === 'REJECTED' ? null : markImageKey(p.userId, id)
  if (selfieKey) await putPrivateObject(selfieKey, p.image, 'image/jpeg')

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // Una marcación a la vez por persona y turno: evita dos entradas simultáneas
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey(p.userId, shift.id)}))`
      const state = (await markingStates(p.userId, [shift.id], tx)).get(shift.id)!
      if (state.locked) throw new MobileApiError('SHIFT_LOCKED')
      const type = state.next
      if (COUNTED_STATUSES.includes(status) && !canMarkNow(type, shift, markAt).ok) throw new MobileApiError('MARK_WINDOW_CLOSED')

      const livenessAttempt =
        attempt ??
        (await tx.livenessAttempt.create({
          data: { userId: p.userId, purpose: 'mark', method: OFFLINE_LIVENESS_METHOD, steps: p.offline!.steps, expiresAt: markAt, usedAt: receivedAt },
          select: { id: true, method: true },
        }))

      const mark = await tx.attendanceMark.create({
        data: {
          id,
          userId: p.userId,
          shiftId: shift.id,
          clientMarkId: p.clientMarkId,
          type,
          status,
          reasons,
          officialAt: markAt,
          offline: !!p.offline,
          deviceAt: p.deviceAt,
          latitude: p.latitude,
          longitude: p.longitude,
          accuracyMeters: p.accuracyMeters,
          distanceMeters: distance,
          mocked: p.mocked,
          similarity,
          selfieKey,
          selfieBytes: selfieKey ? p.image.length : null,
          livenessMethod: livenessAttempt.method,
          livenessAttemptId: livenessAttempt.id,
          installationId: p.installationId,
        },
        select: markSelect,
      })

      // Tercer rostro fallido desde el último desbloqueo: se bloquea el turno para esta persona
      let lockedNow = false
      if (status === 'FACE_MISMATCH' && faceAttemptsState(state.failedFaceAttempts + 1).locked) {
        await tx.attendanceShiftLock.create({ data: { userId: p.userId, shiftId: shift.id, activeKey: lockKey(p.userId, shift.id) } })
        lockedNow = true
      }
      const after = (await markingStates(p.userId, [shift.id], tx)).get(shift.id)!
      return { mark, state: after, lockedNow }
    })
    return { mark: serializeMark(outcome.mark), state: outcome.state, duplicate: false, lockedNow: outcome.lockedNow }
  } catch (error) {
    await safeDelete(selfieKey)
    // El mismo envío llegó dos veces a la vez: se devuelve el que ganó
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await prisma.attendanceMark.findUnique({
        where: { userId_clientMarkId: { userId: p.userId, clientMarkId: p.clientMarkId } },
        select: markSelect,
      })
      if (winner) return { mark: serializeMark(winner), state: (await markingStates(p.userId, [shift.id])).get(shift.id)!, duplicate: true }
    }
    throw error
  }
}

/** Historial del empleado: sus marcaciones de los últimos días, la más reciente primero. */
export async function myMarks(userId: string) {
  const { historyDays, historyMax } = ATTENDANCE_CONFIG.marks
  const rows = await prisma.attendanceMark.findMany({
    where: { userId, officialAt: { gte: new Date(Date.now() - historyDays * 24 * 3_600_000) } },
    orderBy: { officialAt: 'desc' },
    take: historyMax,
    select: markSelect,
  })
  return rows.map(serializeMark)
}

// ───────────────────────────── Web: turnos bloqueados ─────────────────────────────

export class LockError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export async function listActiveLocks() {
  const locks = await prisma.attendanceShiftLock.findMany({
    where: { unlockedAt: null },
    orderBy: { lockedAt: 'desc' },
    select: {
      id: true,
      lockedAt: true,
      user: { select: { id: true, name: true, email: true, cedula: true, image: true } },
      shift: { select: { id: true, startsAt: true, endsAt: true, assignment: { select: { area: { select: { id: true, name: true } } } } } },
    },
  })
  const enrollments = await prisma.faceEnrollment.findMany({
    where: { userId: { in: locks.map((l) => l.user.id) }, status: 'APPROVED' },
    select: { id: true, userId: true, imageKey: true },
  })
  const failed = await prisma.attendanceMark.findMany({
    where: { status: 'FACE_MISMATCH', OR: locks.map((l) => ({ userId: l.user.id, shiftId: l.shift.id })) },
    orderBy: { officialAt: 'desc' },
    select: { id: true, userId: true, shiftId: true, officialAt: true, similarity: true, reasons: true, selfieKey: true, distanceMeters: true },
  })
  return locks.map((l) => {
    const ref = enrollments.find((e) => e.userId === l.user.id)
    return {
      id: l.id,
      lockedAt: l.lockedAt,
      user: l.user,
      area: l.shift.assignment.area,
      shift: { id: l.shift.id, startsAt: l.shift.startsAt, endsAt: l.shift.endsAt },
      referenceEnrollmentId: ref?.imageKey ? ref.id : null,
      attempts: failed
        .filter((m) => m.userId === l.user.id && m.shiftId === l.shift.id)
        .map(({ selfieKey, userId: _u, shiftId: _s, ...m }) => ({ ...m, hasPhoto: !!selfieKey })),
    }
  })
}

export async function unlockShift(params: { lockId: string; reviewerId: string; note: string }) {
  const lock = await prisma.attendanceShiftLock.findUnique({
    where: { id: params.lockId },
    include: { user: { select: { id: true, email: true } }, shift: { select: { assignment: { select: { area: { select: { name: true } } } } } } },
  })
  if (!lock) throw new LockError('Bloqueo no encontrado', 404)
  if (lock.userId === params.reviewerId) throw new LockError('No puedes desbloquear tu propio turno; debe hacerlo otro supervisor', 403)
  if (!params.note.trim()) throw new LockError('El motivo es obligatorio', 400)
  const updated = await prisma.attendanceShiftLock.updateMany({
    where: { id: lock.id, unlockedAt: null },
    data: { unlockedAt: new Date(), unlockedById: params.reviewerId, unlockNote: params.note.trim(), activeKey: null },
  })
  if (updated.count !== 1) throw new LockError('Este turno ya fue desbloqueado', 409)
  return lock
}

/** Clave de la selfie de una marcación (para la URL firmada de la web). */
export async function markPhotoKey(markId: string) {
  const mark = await prisma.attendanceMark.findUnique({ where: { id: markId }, select: { id: true, selfieKey: true, user: { select: { email: true } } } })
  if (!mark) throw new LockError('Marcación no encontrada', 404)
  if (!mark.selfieKey) throw new LockError('Esta marcación no tiene foto', 404)
  return mark
}
