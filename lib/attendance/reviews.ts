import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'

/**
 * Revisión de marcaciones (Fase 7): un supervisor aprueba o rechaza, con nota, las marcaciones
 * PENDING_REVIEW (fuera del área, GPS impreciso). La decisión es una sola y definitiva; la
 * marcación conserva su estado original y el reporte usa la decisión.
 */

export class AttendanceActionError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

const queueSelect = {
  id: true,
  type: true,
  status: true,
  reasons: true,
  officialAt: true,
  latitude: true,
  longitude: true,
  accuracyMeters: true,
  distanceMeters: true,
  similarity: true,
  selfieKey: true,
  offline: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, cedula: true } },
  shift: {
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      assignment: { select: { area: { select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true } } } },
    },
  },
  review: { select: { decision: true, note: true, createdAt: true, reviewer: { select: { id: true, name: true, email: true } } } },
} satisfies Prisma.AttendanceMarkSelect

type QueueRow = Prisma.AttendanceMarkGetPayload<{ select: typeof queueSelect }>

function serialize(m: QueueRow, referenceByUser: Map<string, string>) {
  const { selfieKey, shift, ...rest } = m
  return {
    ...rest,
    hasPhoto: !!selfieKey,
    area: shift.assignment.area,
    shift: { id: shift.id, startsAt: shift.startsAt, endsAt: shift.endsAt },
    referenceEnrollmentId: referenceByUser.get(m.user.id) ?? null,
  }
}

async function referenceIds(userIds: string[]) {
  const rows = await prisma.faceEnrollment.findMany({
    where: { userId: { in: [...new Set(userIds)] }, status: 'APPROVED', imageKey: { not: null } },
    select: { id: true, userId: true },
  })
  return new Map(rows.map((r) => [r.userId, r.id]))
}

/** Pendientes (las más antiguas primero) o revisadas en los últimos días (las más recientes primero). */
export async function listReviewQueue(state: 'pending' | 'done') {
  const rows =
    state === 'pending'
      ? await prisma.attendanceMark.findMany({
          where: { status: 'PENDING_REVIEW', review: null },
          orderBy: { officialAt: 'asc' },
          take: 200,
          select: queueSelect,
        })
      : await prisma.attendanceMark.findMany({
          where: {
            review: { createdAt: { gte: new Date(Date.now() - ATTENDANCE_CONFIG.reports.reviewedHistoryDays * 24 * 3_600_000) } },
          },
          orderBy: { review: { createdAt: 'desc' } },
          take: 200,
          select: queueSelect,
        })
  const refs = await referenceIds(rows.map((r) => r.user.id))
  return rows.map((r) => serialize(r, refs))
}

export async function pendingReviewCount() {
  return prisma.attendanceMark.count({ where: { status: 'PENDING_REVIEW', review: null } })
}

export async function reviewMark(params: { markId: string; reviewerId: string; decision: 'APPROVED' | 'REJECTED'; note: string }) {
  const note = params.note.trim()
  if (!note) throw new AttendanceActionError('La nota es obligatoria', 400)
  const mark = await prisma.attendanceMark.findUnique({
    where: { id: params.markId },
    select: { id: true, userId: true, status: true, type: true, user: { select: { email: true } }, shift: { select: { assignment: { select: { area: { select: { name: true } } } } } }, review: { select: { id: true } } },
  })
  if (!mark) throw new AttendanceActionError('Marcación no encontrada', 404)
  if (mark.userId === params.reviewerId) throw new AttendanceActionError('No puedes revisar tus propias marcaciones; debe hacerlo otro supervisor', 403)
  if (mark.status !== 'PENDING_REVIEW') throw new AttendanceActionError('Esta marcación no necesita revisión', 409)
  if (mark.review) throw new AttendanceActionError('Esta marcación ya fue revisada', 409)
  try {
    await prisma.attendanceMarkReview.create({ data: { markId: mark.id, decision: params.decision, note, reviewerId: params.reviewerId } })
  } catch (error) {
    // Dos supervisores a la vez: gana el primero
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AttendanceActionError('Esta marcación ya fue revisada', 409)
    throw error
  }
  return mark
}
