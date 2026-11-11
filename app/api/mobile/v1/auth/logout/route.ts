import { mobileOk } from '@/lib/mobile/errors'
import { authedMobileRoute } from '@/lib/mobile/handler'
import { revokeSession } from '@/lib/mobile/sessions'

export const dynamic = 'force-dynamic'

// POST /api/mobile/v1/auth/logout — cierra la sesión del token presentado
export const POST = authedMobileRoute(async (_request, actor) => {
  await revokeSession(actor.sessionId, 'logout')
  return mobileOk({ loggedOut: true })
})
