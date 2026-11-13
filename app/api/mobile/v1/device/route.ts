import { bindDevice, getActivation } from '@/lib/mobile/activation'
import { mobileOk } from '@/lib/mobile/errors'
import { authedMobileRoute, parseBody } from '@/lib/mobile/handler'
import { mobileDeviceBindSchema } from '@/lib/validations/mobile-auth'

export const dynamic = 'force-dynamic'

// POST /api/mobile/v1/device — vincula el teléfono de esta sesión al empleado.
// El id de instalación sale de la sesión (fijado en el login), no del cuerpo.
export const POST = authedMobileRoute(async (request, actor) => {
  const body = await parseBody(request, mobileDeviceBindSchema)
  const device = await bindDevice({
    userId: actor.userId,
    installationId: actor.installationId,
    platform: body.platform ?? null,
    deviceModel: body.deviceModel ?? null,
    appVersion: body.appVersion ?? null,
  })
  console.info(`[MOBILE][DEVICE] Teléfono vinculado para ${actor.userId}: ${device.id}`)
  return mobileOk({ activation: await getActivation(actor.userId, actor.installationId) })
})
