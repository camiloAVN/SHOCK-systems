import { prisma } from '@/lib/db/prisma'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { computeShiftReport, overtimeState, toMinutes, type OvertimeState, type ReportMark, type ShiftStatus } from '@/lib/attendance/report'
import { AttendanceActionError } from '@/lib/attendance/reviews'

/**
 * Reporte de asistencia por persona, área y fechas (Fase 7). Una fila por persona y turno.
 * El cálculo está en report.ts (puro); aquí solo se consulta la base y se arma el resultado.
 *
 * Quién aparece en un turno: la persona asignada, o los miembros ACTUALES del equipo asignado
 * (el modelo de equipos no guarda historial), más cualquiera que haya marcado en ese turno.
 */

export type ReportFilters = { from: Date; to: Date; userId?: string | null; areaId?: string | null }

export type ReportRow = {
  shift: { id: string; startsAt: string; endsAt: string }
  area: { id: string; name: string }
  user: { id: string; name: string | null; email: string; cedula: string | null }
  via: { type: 'user' } | { type: 'team'; teamName: string }
  status: ShiftStatus
  pairs: { in: string | null; out: string | null; state: string }[]
  firstIn: string | null
  lastOut: string | null
  workedMinutes: number
  pendingMinutes: number
  lateMinutes: number
  earlyLeaveMinutes: number
  overtimeMinutes: number
  pendingReviews: number
  rejectedMarks: number
  overtime: {
    state: OvertimeState
    approvedMinutes: number
    note: string | null
    decidedAt: string | null
    reviewer: string | null
  }
}

export type PersonSummary = {
  user: ReportRow['user']
  shifts: number
  workedMinutes: number
  lateCount: number
  lateMinutes: number
  earlyLeaveCount: number
  earlyLeaveMinutes: number
  overtimeMinutes: number
  overtimeApprovedMinutes: number
  overtimeToDecide: number
  absences: number
  missingExits: number
  pendingReviews: number
}

export function validateRange(from: Date, to: Date) {
  const days = (to.getTime() - from.getTime()) / (24 * 3_600_000)
  if (days > ATTENDANCE_CONFIG.reports.maxRangeDays) throw new AttendanceActionError(`El rango máximo es de ${ATTENDANCE_CONFIG.reports.maxRangeDays} días`, 400)
}

async function loadShiftMarks(shiftIds: string[], userId?: string | null) {
  const marks = await prisma.attendanceMark.findMany({
    where: { shiftId: { in: shiftIds }, status: { in: ['VALID', 'PENDING_REVIEW'] }, ...(userId ? { userId } : {}) },
    select: { id: true, userId: true, shiftId: true, type: true, status: true, officialAt: true, review: { select: { decision: true } } },
  })
  return marks
}

export async function buildAttendanceReport(filters: ReportFilters, now = new Date()) {
  validateRange(filters.from, filters.to)
  const shifts = await prisma.attendanceShift.findMany({
    where: {
      startsAt: { gte: filters.from, lt: filters.to },
      ...(filters.areaId ? { assignment: { areaId: filters.areaId } } : {}),
    },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      assignment: {
        select: {
          userId: true,
          area: { select: { id: true, name: true } },
          team: { select: { name: true, members: { select: { userId: true } } } },
        },
      },
    },
  })
  const shiftIds = shifts.map((s) => s.id)
  const [marks, decisions] = await Promise.all([
    loadShiftMarks(shiftIds, filters.userId),
    prisma.attendanceOvertimeDecision.findMany({
      where: { shiftId: { in: shiftIds }, ...(filters.userId ? { userId: filters.userId } : {}) },
      select: { userId: true, shiftId: true, decision: true, computedMinutes: true, approvedMinutes: true, note: true, updatedAt: true, reviewer: { select: { name: true, email: true } } },
    }),
  ])

  // Personas por turno
  const pairsWanted: { shift: (typeof shifts)[number]; userId: string }[] = []
  for (const s of shifts) {
    const people = new Set<string>()
    if (s.assignment.userId) people.add(s.assignment.userId)
    for (const member of s.assignment.team?.members ?? []) people.add(member.userId)
    for (const mk of marks) if (mk.shiftId === s.id) people.add(mk.userId)
    for (const userId of people) if (!filters.userId || userId === filters.userId) pairsWanted.push({ shift: s, userId })
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(pairsWanted.map((p) => p.userId))] } },
    select: { id: true, name: true, email: true, cedula: true },
  })
  const userById = new Map(users.map((u) => [u.id, u]))

  const rows: ReportRow[] = []
  for (const { shift, userId } of pairsWanted) {
    const user = userById.get(userId)
    if (!user) continue
    const own: ReportMark[] = marks.filter((mk) => mk.shiftId === shift.id && mk.userId === userId)
    const r = computeShiftReport(shift, own, now)
    const decision = decisions.find((d) => d.shiftId === shift.id && d.userId === userId) ?? null
    const otState = overtimeState(r, decision)
    rows.push({
      shift: { id: shift.id, startsAt: shift.startsAt.toISOString(), endsAt: shift.endsAt.toISOString() },
      area: shift.assignment.area,
      user,
      via: shift.assignment.userId === userId || !shift.assignment.team ? { type: 'user' } : { type: 'team', teamName: shift.assignment.team.name },
      status: r.status,
      pairs: r.pairs.map((p) => ({ in: p.in?.officialAt.toISOString() ?? null, out: p.out?.officialAt.toISOString() ?? null, state: p.state })),
      firstIn: r.firstIn?.toISOString() ?? null,
      lastOut: r.lastOut?.toISOString() ?? null,
      workedMinutes: toMinutes(r.workedMs),
      pendingMinutes: toMinutes(r.pendingMs),
      lateMinutes: toMinutes(r.lateMs),
      earlyLeaveMinutes: toMinutes(r.earlyLeaveMs),
      overtimeMinutes: toMinutes(r.overtimeMs),
      pendingReviews: r.pendingReviews,
      rejectedMarks: r.rejectedMarks,
      overtime: {
        state: otState,
        approvedMinutes: otState === 'approved' ? decision!.approvedMinutes : 0,
        note: decision?.note ?? null,
        decidedAt: decision?.updatedAt.toISOString() ?? null,
        reviewer: decision?.reviewer ? decision.reviewer.name || decision.reviewer.email : null,
      },
    })
  }
  rows.sort((a, b) => a.shift.startsAt.localeCompare(b.shift.startsAt) || (a.user.name ?? a.user.email).localeCompare(b.user.name ?? b.user.email))
  return { rows, summary: summarize(rows) }
}

export function summarize(rows: ReportRow[]): PersonSummary[] {
  const byUser = new Map<string, PersonSummary>()
  for (const r of rows) {
    if (r.status === 'upcoming') continue
    let s = byUser.get(r.user.id)
    if (!s) {
      s = {
        user: r.user,
        shifts: 0,
        workedMinutes: 0,
        lateCount: 0,
        lateMinutes: 0,
        earlyLeaveCount: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        overtimeApprovedMinutes: 0,
        overtimeToDecide: 0,
        absences: 0,
        missingExits: 0,
        pendingReviews: 0,
      }
      byUser.set(r.user.id, s)
    }
    s.shifts++
    s.workedMinutes += r.workedMinutes
    if (r.lateMinutes > 0) {
      s.lateCount++
      s.lateMinutes += r.lateMinutes
    }
    if (r.earlyLeaveMinutes > 0) {
      s.earlyLeaveCount++
      s.earlyLeaveMinutes += r.earlyLeaveMinutes
    }
    s.overtimeMinutes += r.overtimeMinutes
    s.overtimeApprovedMinutes += r.overtime.approvedMinutes
    if (['to_approve', 'changed', 'blocked_by_review'].includes(r.overtime.state)) s.overtimeToDecide++
    if (r.status === 'absent') s.absences++
    if (r.status === 'missing_exit') s.missingExits++
    s.pendingReviews += r.pendingReviews
  }
  return [...byUser.values()].sort((a, b) => (a.user.name ?? a.user.email).localeCompare(b.user.name ?? b.user.email))
}

/** Aprobar o rechazar las horas extra de una persona en un turno. Se recalcula aquí: no se confía en el navegador. */
export async function decideOvertime(params: {
  userId: string
  shiftId: string
  reviewerId: string
  decision: 'APPROVED' | 'REJECTED'
  minutes?: number | null
  note?: string | null
}) {
  if (params.userId === params.reviewerId) throw new AttendanceActionError('No puedes aprobar tus propias horas extra; debe hacerlo otro supervisor', 403)
  const shift = await prisma.attendanceShift.findUnique({
    where: { id: params.shiftId },
    select: { id: true, startsAt: true, endsAt: true, assignment: { select: { area: { select: { name: true } } } } },
  })
  if (!shift) throw new AttendanceActionError('Turno no encontrado', 404)
  const user = await prisma.user.findUnique({ where: { id: params.userId }, select: { id: true, email: true } })
  if (!user) throw new AttendanceActionError('Persona no encontrada', 404)
  const marks = await loadShiftMarks([shift.id], user.id)
  const report = computeShiftReport(shift, marks, new Date())
  const computed = toMinutes(report.overtimeMs)
  if (computed === 0) throw new AttendanceActionError('Esta persona no tiene horas extra en este turno', 400)
  if (report.pendingReviews > 0) throw new AttendanceActionError('Primero revisa las marcaciones pendientes de este turno', 409)

  const note = params.note?.trim() || null
  let approved = 0
  if (params.decision === 'APPROVED') {
    approved = params.minutes ?? computed
    if (!Number.isInteger(approved) || approved < 1 || approved > computed) throw new AttendanceActionError(`Los minutos aprobados deben estar entre 1 y ${computed}`, 400)
    if (approved < computed && !note) throw new AttendanceActionError('Explica en la nota por qué apruebas menos minutos de los calculados', 400)
  } else if (!note) {
    throw new AttendanceActionError('La nota es obligatoria al rechazar', 400)
  }

  const data = { decision: params.decision, computedMinutes: computed, approvedMinutes: approved, note, reviewerId: params.reviewerId }
  const saved = await prisma.attendanceOvertimeDecision.upsert({
    where: { userId_shiftId: { userId: user.id, shiftId: shift.id } },
    create: { userId: user.id, shiftId: shift.id, ...data },
    update: data,
  })
  return { decision: saved, user, areaName: shift.assignment.area.name, computed }
}

/** Opciones de los filtros: áreas y personas que alguna vez tuvieron un turno o una marcación. */
export async function reportOptions() {
  const [areas, direct, teams, marked] = await Promise.all([
    prisma.attendanceArea.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, isActive: true } }),
    prisma.attendanceAssignment.findMany({ where: { userId: { not: null } }, select: { userId: true }, distinct: ['userId'] }),
    prisma.attendanceAssignment.findMany({ where: { teamId: { not: null } }, select: { team: { select: { members: { select: { userId: true } } } } } }),
    prisma.attendanceMark.findMany({ select: { userId: true }, distinct: ['userId'] }),
  ])
  const ids = new Set<string>()
  for (const a of direct) if (a.userId) ids.add(a.userId)
  for (const t of teams) for (const m of t.team?.members ?? []) ids.add(m.userId)
  for (const m of marked) ids.add(m.userId)
  const users = await prisma.user.findMany({ where: { id: { in: [...ids] } }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } })
  return { areas, users }
}
