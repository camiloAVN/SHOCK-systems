import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { submitEnrollment } from '@/lib/attendance/enrollment'
import { getActivation } from '@/lib/mobile/activation'
import { MobileApiError, mobileOk } from '@/lib/mobile/errors'
import { authedMobileRoute } from '@/lib/mobile/handler'

export const dynamic = 'force-dynamic'

// POST /api/mobile/v1/enrollment — envío de la foto de referencia (multipart/form-data):
//   photo      archivo JPEG (máx. 1 MB)
//   attemptId  id del intento de prueba de vida
export const POST = authedMobileRoute(async (request, actor) => {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw new MobileApiError('VALIDATION_ERROR', 'Se esperaba un formulario multipart con la foto')
  }
  const photo = form.get('photo')
  const attemptId = form.get('attemptId')
  if (!(photo instanceof File) || typeof attemptId !== 'string' || !attemptId) {
    throw new MobileApiError('VALIDATION_ERROR', 'Faltan la foto o el id del intento')
  }
  // Se rechaza antes de leerla si ya declara ser demasiado grande
  if (photo.size > ATTENDANCE_CONFIG.face.selfieMaxBytes) throw new MobileApiError('IMAGE_TOO_LARGE')

  const before = await getActivation(actor.userId, actor.installationId)
  const enrollment = await submitEnrollment({
    userId: actor.userId,
    installationId: actor.installationId,
    attemptId,
    image: Buffer.from(await photo.arrayBuffer()),
    consentAccepted: before.consent.accepted,
    deviceIsThisPhone: before.device.status === 'this_device',
  })

  console.info(`[MOBILE][ENROLLMENT] Registro facial enviado por ${actor.userId}: ${enrollment.id}`)
  return mobileOk({ enrollmentId: enrollment.id, activation: await getActivation(actor.userId, actor.installationId) }, 201)
})
