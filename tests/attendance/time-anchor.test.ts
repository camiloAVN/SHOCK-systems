import { describe, expect, it } from 'vitest'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { applyTimeVerification } from '@/lib/attendance/mark-rules'
import { resolveOfflineTime, signTimeAnchor, verifyTimeAnchor } from '@/lib/attendance/time-anchor'

const secret = new TextEncoder().encode('x'.repeat(40))
const otherSecret = new TextEncoder().encode('y'.repeat(40))
const MIN = 60_000
const received = new Date('2026-11-18T15:00:00Z')
const anchorMs = new Date('2026-11-18T12:00:00Z').getTime()

describe('ancla de hora firmada', () => {
  it('se verifica para el mismo usuario y devuelve la hora', () => {
    const token = signTimeAnchor(secret, 'user1', anchorMs)
    expect(verifyTimeAnchor(secret, 'user1', token)).toBe(anchorMs)
  })

  it('no sirve para otro usuario, con otro secreto ni alterada', () => {
    const token = signTimeAnchor(secret, 'user1', anchorMs)
    expect(verifyTimeAnchor(secret, 'user2', token)).toBeNull()
    expect(verifyTimeAnchor(otherSecret, 'user1', token)).toBeNull()
    const [v, , sig] = token.split('.')
    expect(verifyTimeAnchor(secret, 'user1', `${v}.${anchorMs + 3_600_000}.${sig}`)).toBeNull()
    expect(verifyTimeAnchor(secret, 'user1', 'basura')).toBeNull()
    expect(verifyTimeAnchor(secret, 'user1', `v2.${anchorMs}.${sig}`)).toBeNull()
  })
})

describe('hora oficial sin conexión', () => {
  const deviceAt = new Date('2026-11-18T13:30:00Z')

  it('ancla + tiempo transcurrido = hora verificada', () => {
    const r = resolveOfflineTime({ anchorMs, elapsedMs: 90 * MIN, deviceAt, receivedAt: received })
    expect(r).toEqual({ verified: true, officialAt: new Date('2026-11-18T13:30:00Z') })
  })

  it('no importa que el teléfono tenga la hora cambiada', () => {
    const wrongDevice = new Date('2026-11-18T08:00:00Z')
    const r = resolveOfflineTime({ anchorMs, elapsedMs: 90 * MIN, deviceAt: wrongDevice, receivedAt: received })
    expect(r.verified).toBe(true)
    expect(r.officialAt.toISOString()).toBe('2026-11-18T13:30:00.000Z')
  })

  it('teléfono reiniciado (sin tiempo transcurrido): hora del teléfono, sin verificar', () => {
    const r = resolveOfflineTime({ anchorMs, elapsedMs: null, deviceAt, receivedAt: received })
    expect(r).toEqual({ verified: false, officialAt: deviceAt, problem: 'NO_ELAPSED' })
  })

  it('sin ancla o con ancla inválida: sin verificar', () => {
    expect(resolveOfflineTime({ anchorMs: null, elapsedMs: 5 * MIN, deviceAt, receivedAt: received })).toMatchObject({ verified: false, problem: 'NO_ANCHOR' })
    expect(resolveOfflineTime({ anchorMs: null, anchorInvalid: true, elapsedMs: 5 * MIN, deviceAt, receivedAt: received })).toMatchObject({
      verified: false,
      problem: 'INVALID_ANCHOR',
    })
  })

  it('ancla demasiado vieja: sin verificar', () => {
    const r = resolveOfflineTime({ anchorMs, elapsedMs: ATTENDANCE_CONFIG.offline.anchorMaxAgeMs + 1, deviceAt, receivedAt: received })
    expect(r).toMatchObject({ verified: false, problem: 'STALE_ANCHOR' })
  })

  it('una hora calculada en el futuro es imposible; un poco después se recorta a la llegada', () => {
    const far = resolveOfflineTime({ anchorMs, elapsedMs: 3 * 60 * MIN + ATTENDANCE_CONFIG.offline.futureToleranceMs + 1, deviceAt, receivedAt: received })
    expect(far).toMatchObject({ verified: false, problem: 'IMPLAUSIBLE' })
    const near = resolveOfflineTime({ anchorMs, elapsedMs: 3 * 60 * MIN + 30_000, deviceAt, receivedAt: received })
    expect(near).toEqual({ verified: true, officialAt: received })
  })

  it('sin verificar, la hora del teléfono nunca queda después de la llegada; sin hora del teléfono, la llegada', () => {
    const future = new Date('2026-11-19T00:00:00Z')
    expect(resolveOfflineTime({ anchorMs: null, elapsedMs: null, deviceAt: future, receivedAt: received }).officialAt).toEqual(received)
    expect(resolveOfflineTime({ anchorMs: null, elapsedMs: null, deviceAt: null, receivedAt: received }).officialAt).toEqual(received)
  })
})

describe('regla: hora sin verificar va a revisión', () => {
  it('válida con hora verificada sigue válida', () => {
    expect(applyTimeVerification({ status: 'VALID' as const, reasons: [] }, true)).toEqual({ status: 'VALID', reasons: [] })
  })
  it('sin verificar pasa a revisión y suma el motivo', () => {
    expect(applyTimeVerification({ status: 'VALID' as const, reasons: [] }, false)).toEqual({ status: 'PENDING_REVIEW', reasons: ['TIME_UNVERIFIED'] })
    expect(applyTimeVerification({ status: 'PENDING_REVIEW' as const, reasons: ['OUT_OF_AREA' as const] }, false)).toEqual({
      status: 'PENDING_REVIEW',
      reasons: ['OUT_OF_AREA', 'TIME_UNVERIFIED'],
    })
  })
})
