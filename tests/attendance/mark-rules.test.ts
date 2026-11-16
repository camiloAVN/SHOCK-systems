import { describe, expect, it } from 'vitest'
import {
  canMarkNow,
  evaluateLocation,
  faceAttemptsState,
  faceMatches,
  nextMarkType,
  rejectionReasons,
} from '@/lib/attendance/mark-rules'

const at = (iso: string) => new Date(iso)
// 08:00–17:00 en Bogotá → ventana de 06:00 a 23:00
const shift = { startsAt: at('2026-11-14T13:00:00Z'), endsAt: at('2026-11-14T22:00:00Z') }
const area = { latitude: 4.6097, longitude: -74.0817, radiusMeters: 50 }
const north = (m: number) => ({ latitude: 4.6097 + m / 111_195, longitude: -74.0817 })

describe('entrada o salida (automático)', () => {
  it('sin marcaciones: entrada', () => {
    expect(nextMarkType([])).toEqual({ next: 'IN', openEntryAt: null })
  })
  it('con una entrada abierta: salida', () => {
    expect(nextMarkType([{ type: 'IN', officialAt: at('2026-11-14T13:05:00Z') }])).toEqual({ next: 'OUT', openEntryAt: at('2026-11-14T13:05:00Z') })
  })
  it('entrada y salida: otra entrada (varios pares en un turno)', () => {
    expect(
      nextMarkType([
        { type: 'OUT', officialAt: at('2026-11-14T17:00:00Z') },
        { type: 'IN', officialAt: at('2026-11-14T13:05:00Z') },
      ]).next
    ).toBe('IN')
  })
})

describe('ventana de marcación', () => {
  it('entrada: solo con la ventana abierta', () => {
    expect(canMarkNow('IN', shift, at('2026-11-14T10:59:00Z'))).toEqual({ ok: false, reason: 'NOT_YET_OPEN' })
    expect(canMarkNow('IN', shift, at('2026-11-14T11:00:00Z'))).toEqual({ ok: true })
    expect(canMarkNow('IN', shift, at('2026-11-15T04:00:01Z'))).toEqual({ ok: false, reason: 'CLOSED' })
  })
  it('salida con entrada abierta: se permite aunque la ventana haya cerrado', () => {
    expect(canMarkNow('OUT', shift, at('2026-11-16T12:00:00Z'))).toEqual({ ok: true })
  })
})

describe('resultado de la marcación (decisiones 2.7)', () => {
  it('ubicación simulada → rechazada', () => {
    expect(rejectionReasons({ mocked: true, deviceBound: true })).toEqual(['MOCK_LOCATION'])
  })
  it('teléfono no vinculado → rechazada', () => {
    expect(rejectionReasons({ mocked: false, deviceBound: false })).toEqual(['DEVICE_NOT_BOUND'])
  })
  it('sin problemas de teléfono ni ubicación simulada → se evalúa', () => {
    expect(rejectionReasons({ mocked: false, deviceBound: true })).toEqual([])
  })

  it('rostro: coincide desde el 90 %', () => {
    expect(faceMatches({ found: true, similarity: 99.5 })).toEqual({ ok: true, reason: null })
    expect(faceMatches({ found: true, similarity: 90 })).toEqual({ ok: true, reason: null })
    expect(faceMatches({ found: true, similarity: 89.9 })).toEqual({ ok: false, reason: 'FACE_MISMATCH' })
    expect(faceMatches({ found: true, similarity: null })).toEqual({ ok: false, reason: 'FACE_MISMATCH' })
    expect(faceMatches({ found: false })).toEqual({ ok: false, reason: 'NO_FACE' })
  })

  it('dentro del área con buen GPS → válida', () => {
    expect(evaluateLocation({ ...north(20), accuracyMeters: 8 }, area)).toMatchObject({ status: 'VALID', reasons: [] })
  })
  it('fuera del área → pendiente de revisión', () => {
    const r = evaluateLocation({ ...north(120), accuracyMeters: 8 }, area)
    expect(r).toMatchObject({ status: 'PENDING_REVIEW', reasons: ['OUT_OF_AREA'] })
    expect(r.distanceMeters).toBeCloseTo(120, 0)
  })
  it('GPS impreciso (> 50 m) o sin dato → pendiente de revisión', () => {
    expect(evaluateLocation({ ...north(10), accuracyMeters: 65 }, area)).toMatchObject({ status: 'PENDING_REVIEW', reasons: ['LOW_GPS_ACCURACY'] })
    expect(evaluateLocation({ ...north(10), accuracyMeters: null }, area).reasons).toEqual(['LOW_GPS_ACCURACY'])
  })
  it('fuera y con GPS impreciso: ambos motivos', () => {
    expect(evaluateLocation({ ...north(300), accuracyMeters: 80 }, area).reasons).toEqual(['OUT_OF_AREA', 'LOW_GPS_ACCURACY'])
  })
})

describe('bloqueo por rostros fallidos', () => {
  it('quedan intentos hasta el tercero; al tercero se bloquea', () => {
    expect(faceAttemptsState(0)).toEqual({ locked: false, attemptsLeft: 3 })
    expect(faceAttemptsState(2)).toEqual({ locked: false, attemptsLeft: 1 })
    expect(faceAttemptsState(3)).toEqual({ locked: true, attemptsLeft: 0 })
  })
})
