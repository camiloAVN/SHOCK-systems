import { getRequestClientInfo } from '@/lib/audit/log'
import { mobileOk } from '@/lib/mobile/errors'
import { authedMobileRoute } from '@/lib/mobile/handler'
import { loadMe, profileUpdateSchema, updateOwnProfile } from '@/lib/mobile/profile'

export const dynamic = 'force-dynamic'

// GET /api/mobile/v1/me — perfil del usuario del token y su estado de activación.
// El id sale SIEMPRE del token, nunca de la URL ni del cuerpo.
export const GET = authedMobileRoute(async (_request, actor) => {
  return mobileOk(await loadMe(actor.userId, actor.installationId))
})

// PATCH /api/mobile/v1/me — el empleado completa o corrige sus datos:
// cédula (solo si aún no tiene), celular y fecha de nacimiento.
export const PATCH = authedMobileRoute(async (request, actor) => {
  const input = profileUpdateSchema().parse(await request.json().catch(() => null))
  await updateOwnProfile(actor.userId, input, getRequestClientInfo(request))
  return mobileOk(await loadMe(actor.userId, actor.installationId))
})
