import { getRequestClientInfo } from '@/lib/audit/log'
import { mobileOk } from '@/lib/mobile/errors'
import { parseBody, publicMobileRoute } from '@/lib/mobile/handler'
import { assertJwtConfigured, signAccessToken } from '@/lib/mobile/jwt'
import { rotateSession } from '@/lib/mobile/sessions'
import { mobileRefreshSchema } from '@/lib/validations/mobile-auth'

export const dynamic = 'force-dynamic'

// POST /api/mobile/v1/auth/refresh
// Pública respecto al access token (puede estar vencido): la credencial es el refresh token.
export const POST = publicMobileRoute(async (request) => {
  const { refreshToken } = await parseBody(request, mobileRefreshSchema)
  const { ipAddress } = getRequestClientInfo(request)

  // Falla con SERVER_MISCONFIGURED antes de rotar si falta el secreto
  assertJwtConfigured()

  const rotated = await rotateSession(refreshToken, ipAddress)
  const access = await signAccessToken({ userId: rotated.userId, sessionId: rotated.sessionId })

  return mobileOk({
    accessToken: access.token,
    accessTokenExpiresIn: access.expiresInSeconds,
    refreshToken: rotated.refreshToken,
  })
})
