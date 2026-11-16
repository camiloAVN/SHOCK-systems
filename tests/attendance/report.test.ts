import { describe, expect, it } from 'vitest'
import { bogotaDayRange, computeShiftReport, formatMinutes, markStanding, overtimeState, toMinutes, type ReportMark } from '@/lib/attendance/report'

// Horas en Bogotá (UTC-5)
const at = (s: string) => new Date(`${s}:00-05:00`)
const shift = { startsAt: at('2026-11-14T08:00'), endsAt: at('2026-11-14T17:00') }
const LATER = at('2026-11-20T12:00')
let n = 0
const m = (type: 'IN' | 'OUT', time: string, status: ReportMark['status'] = 'VALID', review: ReportMark['review'] = null): ReportMark => ({
  id: `m${++n}`,
  type,
  status,
  officialAt: at(time),
  review,
})
const min = (ms: number) => toMinutes(ms)

describe('estado efectivo de una marcación', () => {
  it('válida, en revisión, aprobada, rechazada por el supervisor; los intentos no cuentan', () => {
    expect(markStanding({ status: 'VALID', review: null })).toBe('ok')
    expect(markStanding({ status: 'PENDING_REVIEW', review: null })).toBe('pending')
    expect(markStanding({ status: 'PENDING_REVIEW', review: { decision: 'APPROVED' } })).toBe('ok')
    expect(markStanding({ status: 'PENDING_REVIEW', review: { decision: 'REJECTED' } })).toBe('rejected')
    expect(markStanding({ status: 'FACE_MISMATCH', review: null })).toBeNull()
    expect(markStanding({ status: 'REJECTED', review: null })).toBeNull()
  })
})

describe('reporte de un turno', () => {
  it('a tiempo: 9 h trabajadas, sin tardanza, sin salida anticipada, sin extra', () => {
    const r = computeShiftReport(shift, [m('IN', '2026-11-14T07:58'), m('OUT', '2026-11-14T17:03')], LATER)
    expect(r.status).toBe('complete')
    expect(min(r.workedMs)).toBe(9 * 60 + 5)
    expect(r.lateMs).toBe(0)
    expect(r.earlyLeaveMs).toBe(0)
    expect(r.overtimeMs).toBe(0) // 3 min después del fin: no llega al mínimo de 15
  })

  it('tardanza dentro de la tolerancia (5 min) no cuenta; pasada la tolerancia cuenta completa', () => {
    expect(computeShiftReport(shift, [m('IN', '2026-11-14T08:05'), m('OUT', '2026-11-14T17:00')], LATER).lateMs).toBe(0)
    expect(min(computeShiftReport(shift, [m('IN', '2026-11-14T08:20'), m('OUT', '2026-11-14T17:00')], LATER).lateMs)).toBe(20)
  })

  it('salida anticipada', () => {
    const r = computeShiftReport(shift, [m('IN', '2026-11-14T08:00'), m('OUT', '2026-11-14T16:30')], LATER)
    expect(min(r.earlyLeaveMs)).toBe(30)
    expect(computeShiftReport(shift, [m('IN', '2026-11-14T08:00'), m('OUT', '2026-11-14T16:56')], LATER).earlyLeaveMs).toBe(0)
  })

  it('horas extra: solo lo trabajado después del fin; llegar antes no suma', () => {
    const r = computeShiftReport(shift, [m('IN', '2026-11-14T07:30'), m('OUT', '2026-11-14T18:30')], LATER)
    expect(min(r.overtimeMs)).toBe(90)
    expect(min(r.workedMs)).toBe(11 * 60)
  })

  it('varios pares en el turno: suma las horas; tardanza con la primera entrada y salida con la última', () => {
    const r = computeShiftReport(
      shift,
      [m('IN', '2026-11-14T08:10'), m('OUT', '2026-11-14T12:00'), m('IN', '2026-11-14T13:00'), m('OUT', '2026-11-14T17:40')],
      LATER
    )
    expect(r.pairs).toHaveLength(2)
    expect(min(r.workedMs)).toBe(3 * 60 + 50 + 4 * 60 + 40)
    expect(min(r.lateMs)).toBe(10)
    expect(r.earlyLeaveMs).toBe(0)
    expect(min(r.overtimeMs)).toBe(40)
  })

  it('turno que cruza la medianoche (22:00 → 06:00)', () => {
    const night = { startsAt: at('2026-11-14T22:00'), endsAt: at('2026-11-15T06:00') }
    const r = computeShiftReport(night, [m('IN', '2026-11-14T22:12'), m('OUT', '2026-11-15T07:00')], LATER)
    expect(min(r.workedMs)).toBe(8 * 60 + 48)
    expect(min(r.lateMs)).toBe(12)
    expect(min(r.overtimeMs)).toBe(60)
  })

  it('un intento de rostro fallido o una marcación rechazada no forman pares', () => {
    const r = computeShiftReport(
      shift,
      [m('IN', '2026-11-14T07:50', 'FACE_MISMATCH'), m('IN', '2026-11-14T07:55', 'REJECTED'), m('IN', '2026-11-14T08:00'), m('OUT', '2026-11-14T17:00')],
      LATER
    )
    expect(r.pairs).toHaveLength(1)
    expect(min(r.workedMs)).toBe(9 * 60)
  })

  it('en revisión: suma horas pero queda señalado', () => {
    const r = computeShiftReport(shift, [m('IN', '2026-11-14T08:00'), m('OUT', '2026-11-14T17:30', 'PENDING_REVIEW')], LATER)
    expect(r.pairs[0].state).toBe('pending')
    expect(min(r.workedMs)).toBe(9 * 60 + 30)
    expect(r.pendingMs).toBe(r.workedMs)
    expect(r.pendingReviews).toBe(1)
  })

  it('rechazada por el supervisor: el par no suma horas ni extra, y no cuenta para la tardanza', () => {
    const r = computeShiftReport(
      shift,
      [m('IN', '2026-11-14T08:30', 'PENDING_REVIEW', { decision: 'REJECTED' }), m('OUT', '2026-11-14T18:30')],
      LATER
    )
    expect(r.pairs[0].state).toBe('rejected')
    expect(r.workedMs).toBe(0)
    expect(r.overtimeMs).toBe(0)
    expect(r.lateMs).toBe(0)
    expect(r.rejectedMarks).toBe(1)
    expect(r.status).toBe('absent')
  })

  it('aprobada por el supervisor: cuenta como válida', () => {
    const r = computeShiftReport(shift, [m('IN', '2026-11-14T08:00', 'PENDING_REVIEW', { decision: 'APPROVED' }), m('OUT', '2026-11-14T17:00')], LATER)
    expect(r.pairs[0].state).toBe('ok')
    expect(r.pendingMs).toBe(0)
  })

  it('entrada sin salida: en curso mientras la ventana está abierta; después, "sin salida"', () => {
    const marks = [m('IN', '2026-11-14T08:00')]
    expect(computeShiftReport(shift, marks, at('2026-11-14T12:00')).status).toBe('in_progress')
    const r = computeShiftReport(shift, marks, LATER)
    expect(r.status).toBe('missing_exit')
    expect(r.workedMs).toBe(0)
    expect(r.earlyLeaveMs).toBe(0)
  })

  it('sin marcaciones: próximo, en curso o ausente según la hora', () => {
    expect(computeShiftReport(shift, [], at('2026-11-14T06:00')).status).toBe('upcoming')
    expect(computeShiftReport(shift, [], at('2026-11-14T09:00')).status).toBe('in_progress')
    expect(computeShiftReport(shift, [], LATER).status).toBe('absent')
  })
})

describe('aprobación de horas extra', () => {
  const report = (overtimeMin: number, pendingReviews = 0) => ({ overtimeMs: overtimeMin * 60_000, pendingReviews })
  it('sin extra no hay nada que aprobar', () => expect(overtimeState(report(0), null)).toBe('none'))
  it('con marcaciones en revisión se revisan primero', () => expect(overtimeState(report(90, 1), null)).toBe('blocked_by_review'))
  it('por aprobar, aprobada y rechazada', () => {
    expect(overtimeState(report(90), null)).toBe('to_approve')
    expect(overtimeState(report(90), { decision: 'APPROVED', computedMinutes: 90 })).toBe('approved')
    expect(overtimeState(report(90), { decision: 'REJECTED', computedMinutes: 90 })).toBe('rejected')
  })
  it('si el cálculo cambió después de decidir, hay que volver a decidir', () => {
    expect(overtimeState(report(60), { decision: 'APPROVED', computedMinutes: 90 })).toBe('changed')
  })
})

describe('utilidades', () => {
  it('formato h:mm', () => {
    expect(formatMinutes(95)).toBe('1:35')
    expect(formatMinutes(0)).toBe('0:00')
  })
  it('rango de días en hora de Bogotá', () => {
    const r = bogotaDayRange('2026-11-14', '2026-11-15')!
    expect(r.from.toISOString()).toBe('2026-11-14T05:00:00.000Z')
    expect(r.to.toISOString()).toBe('2026-11-16T05:00:00.000Z')
    expect(bogotaDayRange('2026-11-15', '2026-11-14')).toBeNull()
    expect(bogotaDayRange('14/11/2026', '2026-11-14')).toBeNull()
  })
})
