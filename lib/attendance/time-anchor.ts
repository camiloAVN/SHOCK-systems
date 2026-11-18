import { createHmac, timingSafeEqual } from 'crypto'
import { ATTENDANCE_CONFIG } from './config'

/**
 * Hora de las marcaciones sin conexión (Fase 8, docs/decisiones.md 2.8). Lógica pura.
 *
 * Cada vez que la app habla con el servidor recibe un "ancla": la hora del servidor firmada
 * con HMAC y ligada al usuario. La app la guarda junto con su reloj monotónico (tiempo desde
 * el encendido, que no cambia aunque alguien mueva la hora del teléfono). Al marcar sin señal
 * anota cuánto tiempo pasó desde el ancla; al sincronizar el servidor calcula:
 *
 *     hora oficial = hora del ancla + tiempo transcurrido
 *
 * Si el teléfono se reinició entre el ancla y la marcación, el reloj monotónico volvió a cero:
 * la app no manda tiempo transcurrido y la hora queda SIN VERIFICAR (va a revisión con la hora
 * que decía el teléfono). Igual si el ancla falta, no es válida o es demasiado vieja.
 *
 * Límite conocido: una app modificada podría mentir sobre el tiempo transcurrido. La firma solo
 * impide inventar la hora del ancla.
 */

const VERSION = 'v1'

function hmac(secret: Uint8Array, userId: string, serverMs: number): Buffer {
  return createHmac('sha256', secret).update(`xa-time-anchor.${VERSION}.${userId}.${serverMs}`).digest()
}

/** Ancla firmada: `v1.<ms del servidor>.<firma base64url>` */
export function signTimeAnchor(secret: Uint8Array, userId: string, serverMs: number): string {
  return `${VERSION}.${serverMs}.${hmac(secret, userId, serverMs).toString('base64url')}`
}

/** Hora del ancla (ms) si la firma es válida para este usuario; null si no. */
export function verifyTimeAnchor(secret: Uint8Array, userId: string, token: string): number | null {
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== VERSION || !/^\d{1,15}$/.test(parts[1])) return null
  const serverMs = Number(parts[1])
  const expected = hmac(secret, userId, serverMs)
  const given = Buffer.from(parts[2], 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return serverMs
}

export type OfflineTimeProblem = 'NO_ANCHOR' | 'INVALID_ANCHOR' | 'STALE_ANCHOR' | 'NO_ELAPSED' | 'IMPLAUSIBLE'

export type OfflineTime =
  | { verified: true; officialAt: Date }
  | { verified: false; officialAt: Date; problem: OfflineTimeProblem }

/**
 * Hora oficial de una marcación sin conexión.
 * - `anchorMs`: hora del ancla ya verificada (null = no llegó, `anchorInvalid` = llegó con firma mala)
 * - `elapsedMs`: tiempo desde el ancla según el reloj monotónico (null = el teléfono se reinició)
 * - `deviceAt`: hora que decía el teléfono (solo se usa si no se puede verificar)
 * - `receivedAt`: llegada al servidor
 */
export function resolveOfflineTime(p: {
  anchorMs: number | null
  anchorInvalid?: boolean
  elapsedMs: number | null
  deviceAt: Date | null
  receivedAt: Date
}): OfflineTime {
  const { anchorMaxAgeMs, futureToleranceMs } = ATTENDANCE_CONFIG.offline
  const received = p.receivedAt.getTime()

  const unverified = (problem: OfflineTimeProblem): OfflineTime => {
    // La hora del teléfono, pero nunca en el futuro respecto a la llegada
    const device = p.deviceAt?.getTime()
    const at = device !== undefined && Number.isFinite(device) ? Math.min(device, received) : received
    return { verified: false, officialAt: new Date(at), problem }
  }

  if (p.anchorInvalid) return unverified('INVALID_ANCHOR')
  if (p.anchorMs === null) return unverified('NO_ANCHOR')
  if (p.elapsedMs === null) return unverified('NO_ELAPSED')
  if (p.anchorMs > received + futureToleranceMs) return unverified('INVALID_ANCHOR')
  if (p.elapsedMs < 0 || !Number.isFinite(p.elapsedMs)) return unverified('IMPLAUSIBLE')
  if (p.elapsedMs > anchorMaxAgeMs) return unverified('STALE_ANCHOR')

  const at = p.anchorMs + p.elapsedMs
  // Un poco después de la llegada se tolera (latencia, deriva) y se recorta; más que eso no es posible
  if (at > received + futureToleranceMs) return unverified('IMPLAUSIBLE')
  return { verified: true, officialAt: new Date(Math.min(at, received)) }
}
