import { describe, expect, it } from 'vitest'
import { circleRing, destinationPoint, distanceMeters, parseCoordinates } from '@/lib/attendance/geo'
import {
  bogotaInputToDate,
  dateToBogotaInput,
  describe as describeShift,
  expandDailyShifts,
  shiftPhase,
  shiftWindow,
  validateShifts,
  visibleShifts,
} from '@/lib/attendance/shifts'
import { attendanceAreaSchema, attendanceAssignmentSchema } from '@/lib/validations/attendance'

const at = (iso: string) => new Date(iso)
const shift = (start: string, end: string) => ({ startsAt: at(start), endsAt: at(end) })

describe('distancia entre puntos conocidos', () => {
  it('un grado de longitud en el ecuador ≈ 111,195 km', () => {
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111_195, -1)
  })
  it('París – Londres ≈ 343,5 km', () => {
    const d = distanceMeters({ latitude: 48.8566, longitude: 2.3522 }, { latitude: 51.5074, longitude: -0.1278 })
    expect(d / 1000).toBeGreaterThan(343)
    expect(d / 1000).toBeLessThan(344.2)
  })
  it('Bogotá: 0,001° de latitud ≈ 111 m (escala de un área)', () => {
    const d = distanceMeters({ latitude: 4.598, longitude: -74.0758 }, { latitude: 4.599, longitude: -74.0758 })
    expect(d).toBeCloseTo(111.2, 0)
  })
  it('el mismo punto está a 0 m y la distancia es simétrica', () => {
    const a = { latitude: 4.6097, longitude: -74.0817 }
    const b = { latitude: 6.2442, longitude: -75.5812 }
    expect(distanceMeters(a, a)).toBe(0)
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6)
  })
  it('un punto a 50 m del centro, en cualquier rumbo, mide 50 m', () => {
    const c = { latitude: 4.6097, longitude: -74.0817 }
    for (const bearing of [0, 45, 90, 180, 270, 333]) {
      expect(distanceMeters(c, destinationPoint(c, 50, bearing))).toBeCloseTo(50, 3)
    }
  })
  it('el círculo del mapa es un anillo cerrado con todos los puntos al radio', () => {
    const c = { latitude: 4.6097, longitude: -74.0817 }
    const ring = circleRing(c, 120, 32)
    expect(ring).toHaveLength(33)
    expect(ring[0]).toEqual(ring[32])
    for (const [lng, lat] of ring) expect(distanceMeters(c, { latitude: lat, longitude: lng })).toBeCloseTo(120, 2)
  })
})

describe('coordenadas pegadas', () => {
  it.each([
    ['4.6097, -74.0817'],
    ['4.6097,-74.0817'],
    ['4.6097 -74.0817'],
    ['4,6097; -74,0817'],
  ])('lee %s', (text) => {
    expect(parseCoordinates(text)).toEqual({ latitude: 4.6097, longitude: -74.0817 })
  })
  it.each([['hola'], ['95, 10'], ['4.6'], ['4.6, -74.08, 3']])('rechaza %s', (text) => {
    expect(parseCoordinates(text)).toBeNull()
  })
})

describe('turnos en hora de Bogotá', () => {
  it('la hora de Bogotá se guarda en UTC (+5 h) y vuelve igual', () => {
    const d = bogotaInputToDate('2026-11-14T08:00')!
    expect(d.toISOString()).toBe('2026-11-14T13:00:00.000Z')
    expect(dateToBogotaInput(d)).toBe('2026-11-14T08:00')
    expect(describeShift(d)).toBe('sáb 14 nov, 08:00')
  })
  it('las 21:00 de Bogotá ya son el día siguiente en UTC', () => {
    expect(bogotaInputToDate('2026-11-14T21:00')!.toISOString()).toBe('2026-11-15T02:00:00.000Z')
  })
  it('rechaza formatos inválidos', () => {
    expect(bogotaInputToDate('14/11/2026 08:00')).toBeNull()
  })

  it('la ventana de marcación abre 2 h antes y cierra 6 h después', () => {
    const s = shift('2026-11-14T13:00:00Z', '2026-11-14T22:00:00Z') // 08:00–17:00 Bogotá
    expect(shiftWindow(s)).toEqual({ opensAt: at('2026-11-14T11:00:00Z'), closesAt: at('2026-11-15T04:00:00Z') })
    expect(shiftPhase(s, at('2026-11-14T10:59:00Z'))).toBe('upcoming')
    expect(shiftPhase(s, at('2026-11-14T11:00:00Z'))).toBe('open')
    expect(shiftPhase(s, at('2026-11-15T04:00:00Z'))).toBe('open')
    expect(shiftPhase(s, at('2026-11-15T04:00:01Z'))).toBe('expired')
  })

  it('varios días: un turno por día, y el nocturno termina al día siguiente', () => {
    const day = expandDailyShifts('2026-11-14', '2026-11-16', '08:00', '17:00')!
    expect(day.map((s) => dateToBogotaInput(s.startsAt))).toEqual(['2026-11-14T08:00', '2026-11-15T08:00', '2026-11-16T08:00'])
    const night = expandDailyShifts('2026-11-14', '2026-11-14', '22:00', '06:00')!
    expect(night).toHaveLength(1)
    expect(dateToBogotaInput(night[0].endsAt)).toBe('2026-11-15T06:00')
    expect(expandDailyShifts('2026-11-16', '2026-11-14', '08:00', '17:00')).toBeNull()
  })

  it('validación: orden, duración máxima y cruces', () => {
    expect(validateShifts([])).toMatch(/al menos un turno/)
    expect(validateShifts([shift('2026-11-14T13:00:00Z', '2026-11-14T12:00:00Z')])).toMatch(/termina antes/)
    expect(validateShifts([shift('2026-11-14T13:00:00Z', '2026-11-15T14:00:00Z')])).toMatch(/más de 24 horas/)
    expect(
      validateShifts([shift('2026-11-14T13:00:00Z', '2026-11-14T22:00:00Z'), shift('2026-11-14T21:00:00Z', '2026-11-15T02:00:00Z')])
    ).toMatch(/se cruzan/)
    expect(
      validateShifts([shift('2026-11-15T13:00:00Z', '2026-11-15T22:00:00Z'), shift('2026-11-14T13:00:00Z', '2026-11-14T22:00:00Z')])
    ).toBeNull()
  })

  it('la app ve turnos abiertos y próximos (hasta 30 días), no vencidos, ordenados', () => {
    const now = at('2026-11-14T15:00:00Z')
    const list = visibleShifts(
      [
        { id: 'futuro-lejano', ...shift('2026-12-20T13:00:00Z', '2026-12-20T22:00:00Z') },
        { id: 'manana', ...shift('2026-11-15T13:00:00Z', '2026-11-15T22:00:00Z') },
        { id: 'ayer', ...shift('2026-11-13T13:00:00Z', '2026-11-13T22:00:00Z') },
        { id: 'hoy', ...shift('2026-11-14T13:00:00Z', '2026-11-14T22:00:00Z') },
        { id: 'termino-hace-poco', ...shift('2026-11-14T05:00:00Z', '2026-11-14T10:00:00Z') }, // ventana hasta las 16:00Z
      ],
      now
    )
    expect(list.map((s) => [s.id, s.phase])).toEqual([
      ['termino-hace-poco', 'open'],
      ['hoy', 'open'],
      ['manana', 'upcoming'],
    ])
  })
})

describe('validación de formularios', () => {
  const area = { name: 'Bodega principal', latitude: 4.6097, longitude: -74.0817, radiusMeters: 50 }
  it('área válida', () => {
    expect(attendanceAreaSchema.parse(area)).toMatchObject({ ...area, isActive: true, description: null, projectId: null })
  })
  it('radio menor a 30 m o mayor a 5 km se rechaza con mensaje claro', () => {
    expect(() => attendanceAreaSchema.parse({ ...area, radiusMeters: 29 })).toThrow(/mínimo es 30 m/)
    expect(() => attendanceAreaSchema.parse({ ...area, radiusMeters: 5001 })).toThrow(/máximo es 5000 m/)
  })
  it('sin centro en el mapa se rechaza', () => {
    expect(() => attendanceAreaSchema.parse({ ...area, latitude: undefined })).toThrow(/Ubica el centro/)
  })

  const shifts = [{ startsAt: '2026-11-14T08:00:00-05:00', endsAt: '2026-11-14T17:00:00-05:00' }]
  it('asignación a una persona o a un equipo, no a ambos ni a ninguno', () => {
    expect(attendanceAssignmentSchema.safeParse({ userId: 'u1', shifts }).success).toBe(true)
    expect(attendanceAssignmentSchema.safeParse({ teamId: 't1', shifts }).success).toBe(true)
    expect(attendanceAssignmentSchema.safeParse({ userId: 'u1', teamId: 't1', shifts }).success).toBe(false)
    expect(attendanceAssignmentSchema.safeParse({ shifts }).success).toBe(false)
  })
  it('las fechas llegan como instantes con zona horaria', () => {
    const parsed = attendanceAssignmentSchema.parse({ userId: 'u1', shifts })
    expect(parsed.shifts[0].startsAt.toISOString()).toBe('2026-11-14T13:00:00.000Z')
    expect(attendanceAssignmentSchema.safeParse({ userId: 'u1', shifts: [{ startsAt: '2026-11-14 08:00', endsAt: 'x' }] }).success).toBe(false)
  })
  it('una asignación sin turnos se rechaza', () => {
    expect(attendanceAssignmentSchema.safeParse({ userId: 'u1', shifts: [] }).error?.issues[0].message).toMatch(/al menos un turno/)
  })
})
