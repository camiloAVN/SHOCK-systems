import { z } from 'zod'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { myMarks, submitMark, timeAnchorFor } from '@/lib/attendance/marks'
import { getActivation } from '@/lib/mobile/activation'
import { MobileApiError, mobileOk } from '@/lib/mobile/errors'
import { authedMobileRoute } from '@/lib/mobile/handler'

export const dynamic = 'force-dynamic'

const stepSchema = z.enum(['blink', 'turn_left', 'turn_right'])

const fieldsSchema = z.object({
  clientMarkId: z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/, 'clientMarkId inválido'),
  shiftId: z.string().min(1),
  attemptId: z.string().min(1).optional(),
  // Marcación hecha sin conexión (Fase 8)
  offline: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  timeAnchor: z.string().max(200).optional(),
  elapsedSinceAnchorMs: z.coerce.number().int().min(0).optional(),
  livenessSteps: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',') : []))
    .pipe(z.array(stepSchema).max(4)),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(100_000).optional(),
  mocked: z.enum(['true', 'false']).transform((v) => v === 'true'),
  deviceTime: z.iso.datetime({ offset: true }).optional(),
})

// POST /api/mobile/v1/marks — marcar entrada o salida (multipart/form-data):
//   photo (JPEG ≤ 1 MB), clientMarkId (id único generado en el teléfono), shiftId, attemptId,
//   latitude, longitude, accuracy, mocked ("true"/"false"), deviceTime (ISO, informativa).
// Sin conexión (Fase 8): offline="true", sin attemptId, con livenessSteps ("blink,turn_left"),
//   timeAnchor (el último que recibió la app) y elapsedSinceAnchorMs (reloj monotónico; se omite
//   si el teléfono se reinició). El servidor calcula la hora oficial con eso.
// El servidor decide si es entrada o salida y el resultado. Reenviar el mismo clientMarkId no duplica.
export const POST = authedMobileRoute(async (request, actor) => {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw new MobileApiError('VALIDATION_ERROR', 'Se esperaba un formulario multipart con la foto')
  }
  const photo = form.get('photo')
  if (!(photo instanceof File)) throw new MobileApiError('VALIDATION_ERROR', 'Falta la foto')
  if (photo.size > ATTENDANCE_CONFIG.face.selfieMaxBytes) throw new MobileApiError('IMAGE_TOO_LARGE')

  const raw = Object.fromEntries([...form.entries()].filter(([k, v]) => k !== 'photo' && typeof v === 'string'))
  const f = fieldsSchema.parse(raw)
  if (!f.offline && !f.attemptId) throw new MobileApiError('VALIDATION_ERROR', 'Falta attemptId')
  if (f.offline && f.livenessSteps.length === 0) throw new MobileApiError('VALIDATION_ERROR', 'Falta livenessSteps')

  const activation = await getActivation(actor.userId, actor.installationId)
  const result = await submitMark({
    userId: actor.userId,
    installationId: actor.installationId,
    clientMarkId: f.clientMarkId,
    shiftId: f.shiftId,
    attemptId: f.attemptId ?? null,
    offline: f.offline
      ? { timeAnchor: f.timeAnchor ?? null, elapsedSinceAnchorMs: f.elapsedSinceAnchorMs ?? null, steps: f.livenessSteps }
      : null,
    latitude: f.latitude,
    longitude: f.longitude,
    accuracyMeters: f.accuracy ?? null,
    mocked: f.mocked,
    deviceAt: f.deviceTime ? new Date(f.deviceTime) : null,
    image: Buffer.from(await photo.arrayBuffer()),
    consentAccepted: activation.consent.accepted,
    deviceBound: activation.device.status === 'this_device',
  })

  console.info(
    `[MOBILE][MARK] ${actor.userId} ${result.mark.type} ${result.mark.status} ${result.mark.reasons.join(',')}${f.offline ? ' (sin conexión)' : ''}${result.duplicate ? ' (reenvío)' : ''}`
  )
  return mobileOk(
    { mark: result.mark, marking: result.state, duplicate: result.duplicate, timeAnchor: timeAnchorFor(actor.userId) },
    result.duplicate ? 200 : 201
  )
})

// GET /api/mobile/v1/marks — mi historial reciente
export const GET = authedMobileRoute(async (_request, actor) => {
  return mobileOk({ marks: await myMarks(actor.userId) })
})
