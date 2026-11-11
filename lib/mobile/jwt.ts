import { SignJWT, jwtVerify, errors as joseErrors } from 'jose'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { MobileApiError } from '@/lib/mobile/errors'

/**
 * Access token de la app: JWT HS256 de vida corta.
 * Solo identifica al usuario y a su sesión; rol y permisos se leen SIEMPRE de la BD.
 * Usa MOBILE_JWT_SECRET, independiente del AUTH_SECRET de la web.
 */

const MIN_SECRET_LENGTH = 32
const DEV_ONLY_PREFIX = 'dev-only-'

export type AccessTokenClaims = { userId: string; sessionId: string }

// Se lee al atender la petición (no al compilar) para que la falta del secreto
// solo afecte a la API móvil y nunca al resto de la plataforma.
function getSecret(): Uint8Array {
  const secret = process.env.MOBILE_JWT_SECRET
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    console.error('[MOBILE] MOBILE_JWT_SECRET falta o tiene menos de 32 caracteres')
    throw new MobileApiError('SERVER_MISCONFIGURED')
  }
  if (process.env.NODE_ENV === 'production' && secret.startsWith(DEV_ONLY_PREFIX)) {
    console.error('[MOBILE] MOBILE_JWT_SECRET es el valor de desarrollo; no se admite en producción')
    throw new MobileApiError('SERVER_MISCONFIGURED')
  }
  return new TextEncoder().encode(secret)
}

/** Lanza SERVER_MISCONFIGURED si el secreto no es utilizable. Llamar antes de crear o rotar sesiones. */
export function assertJwtConfigured(): void {
  getSecret()
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  options: { expiresInSeconds?: number } = {}
): Promise<{ token: string; expiresInSeconds: number }> {
  const { issuer, audience, accessTokenTtlSeconds } = ATTENDANCE_CONFIG.auth
  const expiresInSeconds = options.expiresInSeconds ?? accessTokenTtlSeconds
  const now = Math.floor(Date.now() / 1000)

  const token = await new SignJWT({ sid: claims.sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(getSecret())

  return { token, expiresInSeconds }
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const secret = getSecret()
  const { issuer, audience } = ATTENDANCE_CONFIG.auth
  try {
    const { payload } = await jwtVerify(token, secret, { issuer, audience, algorithms: ['HS256'] })
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      throw new MobileApiError('TOKEN_INVALID')
    }
    return { userId: payload.sub, sessionId: payload.sid }
  } catch (error) {
    if (error instanceof MobileApiError) throw error
    if (error instanceof joseErrors.JWTExpired) throw new MobileApiError('TOKEN_EXPIRED')
    throw new MobileApiError('TOKEN_INVALID')
  }
}
