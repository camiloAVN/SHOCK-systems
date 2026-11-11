import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { getRequestClientInfo } from '@/lib/audit/log'
import { verifyCredentials } from '@/lib/mobile/credentials'
import { MobileApiError, mobileOk } from '@/lib/mobile/errors'
import { parseBody, publicMobileRoute } from '@/lib/mobile/handler'
import { assertJwtConfigured, signAccessToken } from '@/lib/mobile/jwt'
import {
  clearLoginFailures,
  emailKey,
  ipKey,
  isLoginBlocked,
  purgeOldLoginAttempts,
  registerLoginFailure,
} from '@/lib/mobile/login-attempts'
import { createSession, purgeOldSessions } from '@/lib/mobile/sessions'
import { mobileLoginSchema } from '@/lib/validations/mobile-auth'

export const dynamic = 'force-dynamic'

// POST /api/mobile/v1/auth/login
export const POST = publicMobileRoute(async (request) => {
  const { email, password, device } = await parseBody(request, mobileLoginSchema)
  const { ipAddress } = getRequestClientInfo(request)
  const { loginByEmail, loginByIp } = ATTENDANCE_CONFIG.auth

  const keys = [emailKey(email), ...(ipAddress ? [ipKey(ipAddress)] : [])]
  for (const key of keys) {
    const blockedUntil = await isLoginBlocked(key)
    if (blockedUntil) {
      console.warn(`[MOBILE][SECURITY] Login bloqueado por límite de intentos: ${key}`)
      throw new MobileApiError('RATE_LIMITED', undefined, {
        retryAfterSeconds: Math.ceil((blockedUntil.getTime() - Date.now()) / 1000),
      })
    }
  }

  const result = await verifyCredentials(email, password)

  if (!result.ok) {
    await registerLoginFailure(emailKey(email), loginByEmail)
    if (ipAddress) await registerLoginFailure(ipKey(ipAddress), loginByIp)
    if (result.reason === 'inactive') {
      console.warn(`[MOBILE][SECURITY] Usuario inactivo intentó iniciar sesión: ${email}`)
      throw new MobileApiError('USER_INACTIVE')
    }
    throw new MobileApiError('INVALID_CREDENTIALS')
  }

  const { user } = result
  // Se comprueba el secreto ANTES de crear la sesión: sin él no debe quedar una sesión huérfana.
  assertJwtConfigured()

  const { sessionId, refreshToken } = await createSession({
    userId: user.id,
    passwordHash: user.passwordHash,
    device,
    ipAddress,
  })
  const access = await signAccessToken({ userId: user.id, sessionId })

  await clearLoginFailures(emailKey(email))
  // Limpieza oportunista; un fallo aquí no debe romper el login
  await Promise.all([purgeOldLoginAttempts(), purgeOldSessions()]).catch(() => {})

  console.info(`[MOBILE][AUTH] Sesión iniciada: ${user.email}`)

  return mobileOk({
    accessToken: access.token,
    accessTokenExpiresIn: access.expiresInSeconds,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      position: user.position,
    },
  })
})
