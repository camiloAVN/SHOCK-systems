import { randomInt, randomUUID } from 'crypto'
import { Prisma, type FaceEnrollmentStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { detectFaces, evaluateEnrollmentQuality, isJpeg, type QualityProblem } from '@/lib/attendance/rekognition'
import { deletePrivateObject, enrollmentImageKey, putPrivateObject } from '@/lib/storage/r2-private'
import { MobileApiError } from '@/lib/mobile/errors'

/**
 * Registro facial (foto de referencia) e intentos de prueba de vida.
 *
 * Flujo: la app pide un intento (el servidor fija el orden del reto) → hace la prueba de
 * vida en el teléfono → envía la foto con el id del intento → el servidor valida, mide la
 * calidad con DetectFaces, guarda la foto en el bucket privado y deja el registro PENDIENTE
 * hasta que un revisor lo apruebe en la web.
 */

export const LIVENESS_METHOD = 'device_challenge_v1'

export type LivenessStep = 'blink' | 'turn_left' | 'turn_right'

/** Lógica pura: orden aleatorio del reto (parpadeo + un giro, en cualquier orden). */
export function randomChallenge(rand: (max: number) => number = randomInt): LivenessStep[] {
  const turn: LivenessStep = rand(2) === 0 ? 'turn_left' : 'turn_right'
  return rand(2) === 0 ? ['blink', turn] : [turn, 'blink']
}

// ───────────────────────────── Intentos ─────────────────────────────

export async function createLivenessAttempt(userId: string, purpose: 'enrollment') {
  const { attemptTtlMs, maxAttemptsPerHour } = ATTENDANCE_CONFIG.liveness
  const recent = await prisma.livenessAttempt.count({
    where: { userId, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  })
  if (recent >= maxAttemptsPerHour) throw new MobileApiError('RATE_LIMITED', 'Demasiados intentos. Espera un rato e inténtalo de nuevo')

  return prisma.livenessAttempt.create({
    data: {
      userId,
      purpose,
      method: LIVENESS_METHOD,
      steps: randomChallenge(),
      expiresAt: new Date(Date.now() + attemptTtlMs),
    },
    select: { id: true, steps: true, expiresAt: true, method: true },
  })
}

/** Consume el intento (solo una vez, solo su dueño, solo si no caducó). */
async function consumeAttempt(attemptId: string, userId: string, purpose: string) {
  const now = new Date()
  const used = await prisma.livenessAttempt.updateMany({
    where: { id: attemptId, userId, purpose, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  })
  if (used.count === 1) return prisma.livenessAttempt.findUniqueOrThrow({ where: { id: attemptId } })

  const attempt = await prisma.livenessAttempt.findUnique({ where: { id: attemptId } })
  if (attempt && attempt.userId === userId && !attempt.usedAt && attempt.expiresAt <= now) {
    throw new MobileApiError('LIVENESS_ATTEMPT_EXPIRED')
  }
  throw new MobileApiError('LIVENESS_ATTEMPT_INVALID')
}

// ───────────────────────────── Estado ─────────────────────────────

export type EnrollmentActivation = {
  status: 'none' | 'pending' | 'approved' | 'rejected' | 'revoked'
  submittedAt: string | null
  reviewedAt: string | null
  /** Motivo del rechazo o de la anulación */
  note: string | null
  canSubmit: boolean
}

/** Lógica pura: estado que ve el empleado a partir de su último registro. */
export function enrollmentActivationFrom(
  latest: { status: FaceEnrollmentStatus; submittedAt: Date; reviewedAt: Date | null; reviewNote: string | null } | null
): EnrollmentActivation {
  if (!latest) return { status: 'none', submittedAt: null, reviewedAt: null, note: null, canSubmit: true }
  const base = {
    submittedAt: latest.submittedAt.toISOString(),
    reviewedAt: latest.reviewedAt?.toISOString() ?? null,
    note: latest.reviewNote ?? null,
  }
  switch (latest.status) {
    case 'APPROVED':
      return { status: 'approved', ...base, canSubmit: false }
    case 'PENDING':
      // Puede reenviar mientras está pendiente (reemplaza el envío anterior)
      return { status: 'pending', ...base, note: null, canSubmit: true }
    case 'REJECTED':
      return { status: 'rejected', ...base, canSubmit: true }
    case 'REVOKED':
      return { status: 'revoked', ...base, canSubmit: true }
    default:
      return { status: 'none', submittedAt: null, reviewedAt: null, note: null, canSubmit: true }
  }
}

export async function getEnrollmentActivation(userId: string): Promise<EnrollmentActivation> {
  const latest = await prisma.faceEnrollment.findFirst({
    where: { userId, status: { not: 'SUPERSEDED' } },
    orderBy: { submittedAt: 'desc' },
    select: { status: true, submittedAt: true, reviewedAt: true, reviewNote: true },
  })
  return enrollmentActivationFrom(latest)
}

// ───────────────────────────── Envío ─────────────────────────────

const PROBLEM_TO_CODE: Record<QualityProblem, 'FACE_NOT_FOUND' | 'MULTIPLE_FACES' | 'FACE_QUALITY_LOW'> = {
  no_face: 'FACE_NOT_FOUND',
  multiple_faces: 'MULTIPLE_FACES',
  low_confidence: 'FACE_QUALITY_LOW',
  too_dark: 'FACE_QUALITY_LOW',
  too_bright: 'FACE_QUALITY_LOW',
  blurry: 'FACE_QUALITY_LOW',
  not_frontal: 'FACE_QUALITY_LOW',
  too_far: 'FACE_QUALITY_LOW',
}

async function safeDelete(key: string | null) {
  if (!key) return
  try {
    await deletePrivateObject(key)
  } catch (error) {
    console.error('[ENROLLMENT] No se pudo borrar la foto del bucket privado:', key, error)
  }
}

export async function submitEnrollment(params: {
  userId: string
  installationId: string | null
  attemptId: string
  image: Buffer
  /** Precondiciones ya calculadas por la ruta (consentimiento y teléfono) */
  consentAccepted: boolean
  deviceIsThisPhone: boolean
}) {
  if (!params.consentAccepted) throw new MobileApiError('CONSENT_REQUIRED')
  if (!params.deviceIsThisPhone) throw new MobileApiError('DEVICE_NOT_BOUND')

  const approved = await prisma.faceEnrollment.findFirst({ where: { userId: params.userId, status: 'APPROVED' }, select: { id: true } })
  if (approved) throw new MobileApiError('ENROLLMENT_ALREADY_APPROVED')

  const attempt = await consumeAttempt(params.attemptId, params.userId, 'enrollment')

  if (params.image.length > ATTENDANCE_CONFIG.face.selfieMaxBytes) throw new MobileApiError('IMAGE_TOO_LARGE')
  if (!isJpeg(params.image)) throw new MobileApiError('INVALID_IMAGE')

  const evaluation = evaluateEnrollmentQuality(await detectFaces(params.image))
  if (!evaluation.ok) {
    console.info(`[ENROLLMENT] Foto rechazada por calidad (${evaluation.problems.join(', ')}) para ${params.userId}`)
    throw new MobileApiError(PROBLEM_TO_CODE[evaluation.problems[0]], undefined, {
      problems: evaluation.problems,
      quality: evaluation.quality,
    })
  }

  const id = randomUUID().replace(/-/g, '')
  const key = enrollmentImageKey(params.userId, id)
  await putPrivateObject(key, params.image, 'image/jpeg')

  try {
    const { enrollment, replacedKeys } = await prisma.$transaction(async (tx) => {
      const pending = await tx.faceEnrollment.findMany({
        where: { userId: params.userId, status: 'PENDING' },
        select: { id: true, imageKey: true },
      })
      if (pending.length) {
        await tx.faceEnrollment.updateMany({
          where: { id: { in: pending.map((p) => p.id) } },
          data: { status: 'SUPERSEDED', activeUserId: null, imageKey: null, imageDeletedAt: new Date() },
        })
      }
      const created = await tx.faceEnrollment.create({
        data: {
          id,
          userId: params.userId,
          activeUserId: params.userId,
          status: 'PENDING',
          imageKey: key,
          imageBytes: params.image.length,
          livenessMethod: attempt.method,
          livenessAttemptId: attempt.id,
          challengeSteps: attempt.steps,
          quality: evaluation.quality,
          installationId: params.installationId,
        },
        select: { id: true, status: true, submittedAt: true },
      })
      return { enrollment: created, replacedKeys: pending.map((p) => p.imageKey) }
    })
    await Promise.all(replacedKeys.map((k) => safeDelete(k)))
    return enrollment
  } catch (error) {
    await safeDelete(key)
    // Otro envío simultáneo ganó (índice único de activeUserId)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new MobileApiError('ENROLLMENT_ALREADY_APPROVED')
    }
    throw error
  }
}

// ───────────────────────────── Revisión (web) ─────────────────────────────

export type ReviewAction = 'approve' | 'reject' | 'revoke'

export class ReviewError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

/** Lógica pura: ¿se puede aplicar esta acción a un registro en este estado? */
export function reviewTransition(status: FaceEnrollmentStatus, action: ReviewAction): FaceEnrollmentStatus | null {
  if (action === 'approve' && status === 'PENDING') return 'APPROVED'
  if (action === 'reject' && status === 'PENDING') return 'REJECTED'
  if (action === 'revoke' && status === 'APPROVED') return 'REVOKED'
  return null
}

export async function reviewEnrollment(params: { enrollmentId: string; reviewerId: string; action: ReviewAction; note: string | null }) {
  const enrollment = await prisma.faceEnrollment.findUnique({
    where: { id: params.enrollmentId },
    include: { user: { select: { id: true, email: true, isActive: true } } },
  })
  if (!enrollment) throw new ReviewError('Registro no encontrado', 404)
  if (enrollment.userId === params.reviewerId) {
    throw new ReviewError('No puedes revisar tu propio registro facial; debe hacerlo otro revisor', 403)
  }
  const next = reviewTransition(enrollment.status, params.action)
  if (!next) throw new ReviewError('El registro ya no está en un estado que permita esta acción', 409)
  if (params.action !== 'approve' && !params.note?.trim()) throw new ReviewError('El motivo es obligatorio', 400)

  const removesImage = next === 'REJECTED' || next === 'REVOKED'
  const updated = await prisma.faceEnrollment.updateMany({
    where: { id: enrollment.id, status: enrollment.status },
    data: {
      status: next,
      reviewedAt: new Date(),
      reviewedById: params.reviewerId,
      reviewNote: params.note?.trim() || null,
      ...(removesImage && { activeUserId: null, imageKey: null, imageDeletedAt: new Date() }),
    },
  })
  if (updated.count !== 1) throw new ReviewError('El registro cambió mientras lo revisabas. Recarga la página', 409)

  if (removesImage) await safeDelete(enrollment.imageKey)
  return { enrollment, next }
}
