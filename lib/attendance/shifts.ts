/**
 * Turnos de asistencia: hora de Bogotá, ventana de marcación y validación.
 * Lógica pura (sin Prisma ni Next), usable en el servidor y en el navegador.
 *
 * - El turno es el HORARIO PLANEADO (sirve para tardanzas y horas extra).
 * - La VENTANA de marcación es más amplia: desde `markBeforeStartMs` antes del inicio
 *   hasta `markAfterEndMs` después del fin (docs/decisiones.md, 2.6).
 */
import { ATTENDANCE_CONFIG } from './config'

export type ShiftTimes = { startsAt: Date; endsAt: Date }
export type ShiftPhase = 'open' | 'upcoming' | 'expired'

const TZ = ATTENDANCE_CONFIG.timezone

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-11-14T08:00" (hora de Bogotá, como la da un <input type="datetime-local">) → instante UTC. */
export function bogotaInputToDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const d = new Date(`${value}:00${TZ.utcOffset}`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Instante → "2026-11-14T08:00" en hora de Bogotá (para rellenar inputs). */
export function dateToBogotaInput(date: Date): string {
  const b = new Date(date.getTime() + TZ.utcOffsetMs)
  return `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())}T${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`
}

/** Ventana en la que se permite marcar para este turno. */
export function shiftWindow(shift: ShiftTimes): { opensAt: Date; closesAt: Date } {
  return {
    opensAt: new Date(shift.startsAt.getTime() - ATTENDANCE_CONFIG.shifts.markBeforeStartMs),
    closesAt: new Date(shift.endsAt.getTime() + ATTENDANCE_CONFIG.shifts.markAfterEndMs),
  }
}

/** Abierto = ya se puede marcar; próximo = aún no; vencido = la ventana ya cerró. */
export function shiftPhase(shift: ShiftTimes, now: Date): ShiftPhase {
  const { opensAt, closesAt } = shiftWindow(shift)
  if (now.getTime() > closesAt.getTime()) return 'expired'
  if (now.getTime() < opensAt.getTime()) return 'upcoming'
  return 'open'
}

/**
 * Turnos que ve el empleado en la app: los que aún se pueden marcar (ventana abierta) y los
 * próximos dentro del horizonte `listAheadMs`, ordenados por inicio. Los vencidos no aparecen.
 */
export function visibleShifts<T extends ShiftTimes>(shifts: T[], now: Date): (T & { phase: ShiftPhase; opensAt: Date; closesAt: Date })[] {
  const horizon = now.getTime() + ATTENDANCE_CONFIG.shifts.listAheadMs
  return shifts
    .filter((s) => s.startsAt.getTime() <= horizon)
    .map((s) => ({ ...s, phase: shiftPhase(s, now), ...shiftWindow(s) }))
    .filter((s) => s.phase !== 'expired')
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}

/** Límites para la consulta en BD equivalentes a `visibleShifts` (fin de ventana ≥ ahora, inicio ≤ horizonte). */
export function visibleShiftsRange(now: Date): { endsAtFrom: Date; startsAtTo: Date } {
  const c = ATTENDANCE_CONFIG.shifts
  return { endsAtFrom: new Date(now.getTime() - c.markAfterEndMs), startsAtTo: new Date(now.getTime() + c.listAheadMs) }
}

/**
 * Valida una lista de turnos de UNA asignación. Devuelve el primer problema en español,
 * o null si todo está bien. No admite turnos solapados entre sí.
 */
export function validateShifts(shifts: ShiftTimes[]): string | null {
  const c = ATTENDANCE_CONFIG.shifts
  if (shifts.length === 0) return 'Agrega al menos un turno'
  if (shifts.length > c.maxShiftsPerAssignment) return `Máximo ${c.maxShiftsPerAssignment} turnos por asignación`
  for (const s of shifts) {
    const ms = s.endsAt.getTime() - s.startsAt.getTime()
    if (!(ms > 0)) return `El turno del ${describe(s.startsAt)} termina antes de empezar`
    if (ms > c.maxShiftMs) return `El turno del ${describe(s.startsAt)} dura más de ${c.maxShiftMs / 3_600_000} horas; divídelo en varios turnos`
  }
  const sorted = [...shifts].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startsAt.getTime() < sorted[i - 1].endsAt.getTime()) {
      return `Los turnos del ${describe(sorted[i - 1].startsAt)} y del ${describe(sorted[i].startsAt)} se cruzan`
    }
  }
  return null
}

/**
 * Un turno por día entre dos fechas (inclusive), con la misma hora de inicio y fin.
 * Si la hora de fin es menor o igual que la de inicio, el turno termina al día siguiente
 * (turno nocturno). Fechas "YYYY-MM-DD" y horas "HH:mm", en hora de Bogotá.
 */
export function expandDailyShifts(fromDate: string, toDate: string, startTime: string, endTime: string): ShiftTimes[] | null {
  const first = bogotaInputToDate(`${fromDate}T${startTime}`)
  const last = bogotaInputToDate(`${toDate}T${startTime}`)
  const firstEnd = bogotaInputToDate(`${fromDate}T${endTime}`)
  if (!first || !last || !firstEnd || last < first) return null
  let durationMs = firstEnd.getTime() - first.getTime()
  if (durationMs <= 0) durationMs += 24 * 3_600_000
  const out: ShiftTimes[] = []
  // Sin horario de verano en Bogotá: sumar 24 h mantiene la hora local
  for (let t = first.getTime(); t <= last.getTime(); t += 24 * 3_600_000) {
    out.push({ startsAt: new Date(t), endsAt: new Date(t + durationMs) })
    if (out.length > ATTENDANCE_CONFIG.shifts.maxShiftsPerAssignment) break
  }
  return out
}

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "lun 14 nov, 08:00" en hora de Bogotá (sin depender de la zona horaria del navegador). */
export function describe(date: Date): string {
  const b = new Date(date.getTime() + TZ.utcOffsetMs)
  return `${DAYS[b.getUTCDay()]} ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}, ${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`
}

/** "08:00" en hora de Bogotá. */
export function bogotaTime(date: Date): string {
  const b = new Date(date.getTime() + TZ.utcOffsetMs)
  return `${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`
}
