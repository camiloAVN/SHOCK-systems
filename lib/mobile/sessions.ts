import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { MobileApiError } from '@/lib/mobile/errors'

/**
 * Sesiones de la app. Cada login crea una fila con el HASH del refresh token
 * (el token en claro solo lo tiene el teléfono). Las sesiones son revocables:
 * logout, usuario desactivado, cambio de contraseña o reutilización sospechosa.
 */

export type DeviceInfo = {
  installationId?: string
  platform?: string
  deviceModel?: string
  appVersion?: string
}

export const generateRefreshToken = () => randomBytes(32).toString('base64url')
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
/** Huella de la contraseña vigente: si cambia, las sesiones anteriores dejan de valer. */
export const passwordFingerprint = (passwordHash: string) => createHash('sha256').update(passwordHash).digest('hex')

export type RefreshDecision =
  | 'rotate' // token vigente: se rota
  | 'retry_within_grace' // token anterior presentado poco después de rotar (respuesta perdida)
  | 'reuse_detected' // token anterior presentado fuera del margen: posible robo
  | 'revoked'
  | 'expired'

type SessionForDecision = {
  refreshTokenHash: string
  previousTokenHash: string | null
  rotatedAt: Date | null
  expiresAt: Date
  revokedAt: Date | null
}

/** Lógica pura de la rotación; no toca la base. */
export function decideRefresh(
  session: SessionForDecision,
  presentedHash: string,
  now: Date,
  graceMs: number = ATTENDANCE_CONFIG.auth.refreshReuseGraceMs
): RefreshDecision {
  if (session.revokedAt) return 'revoked'
  if (session.expiresAt.getTime() <= now.getTime()) return 'expired'
  if (presentedHash === session.refreshTokenHash) return 'rotate'
  if (presentedHash === session.previousTokenHash && session.rotatedAt) {
    return now.getTime() - session.rotatedAt.getTime() <= graceMs ? 'retry_within_grace' : 'reuse_detected'
  }
  // findFirst solo devuelve sesiones que coinciden por uno de los dos hashes
  return 'reuse_detected'
}

export async function createSession(params: {
  userId: string
  passwordHash: string
  device?: DeviceInfo
  ipAddress?: string | null
}) {
  const refreshToken = generateRefreshToken()
  const now = new Date()
  const session = await prisma.mobileSession.create({
    data: {
      userId: params.userId,
      refreshTokenHash: hashToken(refreshToken),
      passwordFingerprint: passwordFingerprint(params.passwordHash),
      expiresAt: new Date(now.getTime() + ATTENDANCE_CONFIG.auth.refreshTokenTtlMs),
      installationId: params.device?.installationId ?? null,
      platform: params.device?.platform ?? null,
      deviceModel: params.device?.deviceModel ?? null,
      appVersion: params.device?.appVersion ?? null,
      ipAddress: params.ipAddress ?? null,
    },
    select: { id: true },
  })
  return { sessionId: session.id, refreshToken }
}

export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  await prisma.mobileSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  })
}

/**
 * Canjea un refresh token por uno nuevo. Lanza MobileApiError si no procede.
 * Devuelve el usuario y la sesión para emitir el nuevo access token.
 */
export async function rotateSession(presentedToken: string, ipAddress?: string | null) {
  const presentedHash = hashToken(presentedToken)
  const now = new Date()

  const session = await prisma.mobileSession.findFirst({
    where: { OR: [{ refreshTokenHash: presentedHash }, { previousTokenHash: presentedHash }] },
    include: { user: { select: { id: true, isActive: true, password: true } } },
  })
  if (!session) throw new MobileApiError('TOKEN_INVALID')

  const decision = decideRefresh(session, presentedHash, now)

  if (decision === 'revoked') throw new MobileApiError('SESSION_REVOKED')
  if (decision === 'expired') throw new MobileApiError('TOKEN_EXPIRED')
  if (decision === 'reuse_detected') {
    console.warn(`[MOBILE][SECURITY] Refresh token reutilizado; sesión revocada: ${session.id}`)
    await revokeSession(session.id, 'refresh_reuse')
    throw new MobileApiError('SESSION_REVOKED')
  }

  if (!session.user.isActive) {
    await revokeSession(session.id, 'user_inactive')
    throw new MobileApiError('USER_INACTIVE')
  }
  if (!session.user.password || passwordFingerprint(session.user.password) !== session.passwordFingerprint) {
    await revokeSession(session.id, 'password_changed')
    throw new MobileApiError('SESSION_REVOKED')
  }

  const newToken = generateRefreshToken()
  const newHash = hashToken(newToken)
  const expiresAt = new Date(now.getTime() + ATTENDANCE_CONFIG.auth.refreshTokenTtlMs)

  if (decision === 'rotate') {
    // Condición sobre el hash actual: si dos peticiones llegan a la vez, solo una rota.
    const updated = await prisma.mobileSession.updateMany({
      where: { id: session.id, refreshTokenHash: presentedHash, revokedAt: null },
      data: {
        refreshTokenHash: newHash,
        previousTokenHash: presentedHash,
        rotatedAt: now,
        lastUsedAt: now,
        expiresAt,
        ...(ipAddress && { ipAddress }),
      },
    })
    if (updated.count === 1) return { userId: session.userId, sessionId: session.id, refreshToken: newToken }
    // Otra petición con el mismo token rotó primero: se trata como reintento dentro del margen.
  }

  // Reintento dentro del margen: se emite otro token y se conserva el anterior y su reloj,
  // para que el margen se mida siempre desde la primera rotación.
  const retried = await prisma.mobileSession.updateMany({
    where: { id: session.id, previousTokenHash: presentedHash, revokedAt: null },
    data: { refreshTokenHash: newHash, lastUsedAt: now, expiresAt },
  })
  if (retried.count !== 1) throw new MobileApiError('TOKEN_INVALID')
  return { userId: session.userId, sessionId: session.id, refreshToken: newToken }
}

/** Limpieza oportunista de sesiones caducadas hace más de 30 días. */
export async function purgeOldSessions(now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  await prisma.mobileSession.deleteMany({ where: { expiresAt: { lt: cutoff } } })
}
