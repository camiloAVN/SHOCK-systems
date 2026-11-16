/**
 * Cálculo del reporte de asistencia de UNA persona en UN turno (Fase 7). Lógica pura, sin
 * Prisma, para probarla con todos los casos (tests/attendance/report.test.ts).
 *
 * Reglas (docs/decisiones.md, 2.7, y decisiones del dueño en la Fase 7):
 * - Solo cuentan las marcaciones VALID y PENDING_REVIEW, en pares entrada → salida.
 * - Una PENDING_REVIEW aprobada cuenta como válida; si se rechaza, su par no suma horas.
 *   Mientras nadie la revisa, el par suma horas pero queda marcado como "en revisión".
 * - Tardanza: primera entrada (de un par no rechazado) después del inicio + tolerancia.
 *   Se reporta el retraso completo desde la hora de inicio.
 * - Salida anticipada: última salida antes del fin − tolerancia (solo si no quedó una entrada abierta).
 * - Horas extra: tiempo trabajado DESPUÉS del fin planeado (llegar antes no suma); solo
 *   cuentan si llegan al mínimo configurado. Requieren aprobación.
 */
import { ATTENDANCE_CONFIG } from './config'
import { shiftWindow, type ShiftTimes } from './shifts'

export type ReportMark = {
  id: string
  type: 'IN' | 'OUT'
  status: 'VALID' | 'PENDING_REVIEW' | 'FACE_MISMATCH' | 'REJECTED'
  officialAt: Date
  review: { decision: 'APPROVED' | 'REJECTED' } | null
}

/** Estado efectivo de una marcación que cuenta: ok, en revisión o rechazada por el supervisor. */
export type MarkStanding = 'ok' | 'pending' | 'rejected'

export function markStanding(m: Pick<ReportMark, 'status' | 'review'>): MarkStanding | null {
  if (m.status === 'VALID') return 'ok'
  if (m.status !== 'PENDING_REVIEW') return null
  if (!m.review) return 'pending'
  return m.review.decision === 'APPROVED' ? 'ok' : 'rejected'
}

export type PairState = 'ok' | 'pending' | 'rejected' | 'open' | 'orphan_out'

export type Pair = {
  in: ReportMark | null
  out: ReportMark | null
  state: PairState
  workedMs: number
  overtimeMs: number
}

export type ShiftStatus = 'upcoming' | 'in_progress' | 'missing_exit' | 'absent' | 'complete'

export type ShiftReport = {
  status: ShiftStatus
  pairs: Pair[]
  firstIn: Date | null
  lastOut: Date | null
  /** Trabajado en pares ok + en revisión */
  workedMs: number
  /** Parte de workedMs que aún está en revisión */
  pendingMs: number
  lateMs: number
  earlyLeaveMs: number
  /** Extra calculada (0 si no llega al mínimo) */
  overtimeMs: number
  pendingReviews: number
  rejectedMarks: number
}

const worstOf = (a: MarkStanding, b: MarkStanding): PairState => (a === 'rejected' || b === 'rejected' ? 'rejected' : a === 'pending' || b === 'pending' ? 'pending' : 'ok')

/** Arma los pares entrada → salida con las marcaciones que cuentan, en orden. */
export function buildPairs(marks: ReportMark[], shift: ShiftTimes): Pair[] {
  const counted = marks
    .filter((m) => markStanding(m) !== null)
    .sort((a, b) => a.officialAt.getTime() - b.officialAt.getTime())
  const pairs: Pair[] = []
  let open: ReportMark | null = null
  const endMs = shift.endsAt.getTime()
  for (const m of counted) {
    if (m.type === 'IN') {
      // Dos entradas seguidas no deberían ocurrir (el servidor alterna); por si acaso, la anterior queda abierta
      if (open) pairs.push({ in: open, out: null, state: 'open', workedMs: 0, overtimeMs: 0 })
      open = m
      continue
    }
    if (!open) {
      pairs.push({ in: null, out: m, state: 'orphan_out', workedMs: 0, overtimeMs: 0 })
      continue
    }
    const state = worstOf(markStanding(open)!, markStanding(m)!)
    const inMs = open.officialAt.getTime()
    const outMs = m.officialAt.getTime()
    const counts = state !== 'rejected'
    pairs.push({
      in: open,
      out: m,
      state,
      workedMs: counts ? Math.max(0, outMs - inMs) : 0,
      overtimeMs: counts ? Math.max(0, outMs - Math.max(inMs, endMs)) : 0,
    })
    open = null
  }
  if (open) pairs.push({ in: open, out: null, state: 'open', workedMs: 0, overtimeMs: 0 })
  return pairs
}

export function computeShiftReport(shift: ShiftTimes, marks: ReportMark[], now: Date): ShiftReport {
  const { lateToleranceMs } = ATTENDANCE_CONFIG.shifts
  const { earlyLeaveToleranceMs, overtimeMinMs } = ATTENDANCE_CONFIG.reports
  const pairs = buildPairs(marks, shift)
  const counting = pairs.filter((p) => p.state === 'ok' || p.state === 'pending')
  const workedMs = counting.reduce((s, p) => s + p.workedMs, 0)
  const pendingMs = pairs.filter((p) => p.state === 'pending').reduce((s, p) => s + p.workedMs, 0)

  // Entradas de pares no rechazados (incluye la entrada abierta)
  const entries = pairs.filter((p) => p.in && p.state !== 'rejected' && !(p.state === 'open' && markStanding(p.in) === 'rejected')).map((p) => p.in!.officialAt)
  const firstIn = entries.length ? new Date(Math.min(...entries.map((d) => d.getTime()))) : null
  const exits = counting.map((p) => p.out!.officialAt)
  const lastOut = exits.length ? new Date(Math.max(...exits.map((d) => d.getTime()))) : null
  const openPair = pairs.some((p) => p.state === 'open' && markStanding(p.in!) !== 'rejected')

  const startMs = shift.startsAt.getTime()
  const endMs = shift.endsAt.getTime()
  const late = firstIn ? firstIn.getTime() - startMs : 0
  const lateMs = late > lateToleranceMs ? late : 0
  const early = lastOut && !openPair ? endMs - lastOut.getTime() : 0
  const earlyLeaveMs = early > earlyLeaveToleranceMs ? early : 0
  const rawOvertime = counting.reduce((s, p) => s + p.overtimeMs, 0)
  const overtimeMs = rawOvertime >= overtimeMinMs ? rawOvertime : 0

  const nowMs = now.getTime()
  let status: ShiftStatus
  if (openPair) status = nowMs <= shiftWindow(shift).closesAt.getTime() ? 'in_progress' : 'missing_exit'
  else if (counting.length > 0) status = 'complete'
  else if (nowMs < startMs) status = 'upcoming'
  else if (nowMs <= endMs) status = 'in_progress'
  else status = 'absent'

  const standings = marks.map(markStanding)
  return {
    status,
    pairs,
    firstIn,
    lastOut,
    workedMs,
    pendingMs,
    lateMs,
    earlyLeaveMs,
    overtimeMs,
    pendingReviews: standings.filter((s) => s === 'pending').length,
    rejectedMarks: standings.filter((s) => s === 'rejected').length,
  }
}

export type OvertimeState = 'none' | 'blocked_by_review' | 'to_approve' | 'approved' | 'rejected' | 'changed'

/**
 * Estado de la aprobación de horas extra de un turno:
 * - none: no hay extra que aprobar
 * - blocked_by_review: hay marcaciones en revisión; primero se revisan
 * - to_approve / approved / rejected
 * - changed: se decidió con otro cálculo (cambiaron las marcaciones): hay que volver a decidir
 */
export function overtimeState(
  report: Pick<ShiftReport, 'overtimeMs' | 'pendingReviews'>,
  decision: { decision: 'APPROVED' | 'REJECTED'; computedMinutes: number } | null
): OvertimeState {
  const minutes = toMinutes(report.overtimeMs)
  if (decision && decision.computedMinutes !== minutes) return minutes === 0 ? 'none' : 'changed'
  if (decision) return decision.decision === 'APPROVED' ? 'approved' : 'rejected'
  if (minutes === 0) return 'none'
  if (report.pendingReviews > 0) return 'blocked_by_review'
  return 'to_approve'
}

export const toMinutes = (ms: number) => Math.floor(ms / 60_000)

/** 95 → "1:35" */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const m = Math.abs(Math.round(minutes))
  return `${sign}${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

/** "2026-11-14" (hora de Bogotá) → [inicio del día, inicio del día siguiente) en UTC. */
export function bogotaDayRange(fromDate: string, toDate: string): { from: Date; to: Date } | null {
  const re = /^\d{4}-\d{2}-\d{2}$/
  if (!re.test(fromDate) || !re.test(toDate)) return null
  const offset = ATTENDANCE_CONFIG.timezone.utcOffset
  const from = new Date(`${fromDate}T00:00:00${offset}`)
  const lastDay = new Date(`${toDate}T00:00:00${offset}`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(lastDay.getTime()) || lastDay < from) return null
  return { from, to: new Date(lastDay.getTime() + 24 * 3_600_000) }
}
