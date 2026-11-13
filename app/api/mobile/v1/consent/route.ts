import { CURRENT_CONSENT, CURRENT_CONSENT_HASH } from '@/lib/attendance/consent'
import { getRequestClientInfo } from '@/lib/audit/log'
import { acceptConsent, getActivation } from '@/lib/mobile/activation'
import { mobileOk } from '@/lib/mobile/errors'
import { authedMobileRoute, parseBody } from '@/lib/mobile/handler'
import { mobileConsentAcceptSchema } from '@/lib/validations/mobile-auth'

export const dynamic = 'force-dynamic'

// GET /api/mobile/v1/consent — texto vigente y si el usuario ya lo aceptó
export const GET = authedMobileRoute(async (_request, actor) => {
  const activation = await getActivation(actor.userId, actor.installationId)
  return mobileOk({
    ...CURRENT_CONSENT,
    textHash: CURRENT_CONSENT_HASH,
    accepted: activation.consent.accepted,
    acceptedAt: activation.consent.acceptedAt,
  })
})

// POST /api/mobile/v1/consent — acepta la versión vigente (con su huella)
export const POST = authedMobileRoute(async (request, actor) => {
  const { version, textHash } = await parseBody(request, mobileConsentAcceptSchema)
  const { ipAddress, userAgent } = getRequestClientInfo(request)
  await acceptConsent({
    userId: actor.userId,
    version,
    textHash,
    installationId: actor.installationId,
    ipAddress,
    userAgent,
  })
  console.info(`[MOBILE][CONSENT] Aceptado ${version} por ${actor.userId}`)
  return mobileOk({ activation: await getActivation(actor.userId, actor.installationId) })
})
