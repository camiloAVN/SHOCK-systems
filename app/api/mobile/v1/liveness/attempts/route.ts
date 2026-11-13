import { createLivenessAttempt } from '@/lib/attendance/enrollment'
import { mobileOk } from '@/lib/mobile/errors'
import { authedMobileRoute, parseBody } from '@/lib/mobile/handler'
import { mobileLivenessAttemptSchema } from '@/lib/validations/mobile-auth'

export const dynamic = 'force-dynamic'

// POST /api/mobile/v1/liveness/attempts — intento de prueba de vida: el servidor fija el
// orden del reto; el intento caduca en minutos y solo sirve para un envío.
export const POST = authedMobileRoute(async (request, actor) => {
  const { purpose } = await parseBody(request, mobileLivenessAttemptSchema)
  const attempt = await createLivenessAttempt(actor.userId, purpose)
  return mobileOk({
    attemptId: attempt.id,
    method: attempt.method,
    steps: attempt.steps,
    expiresAt: attempt.expiresAt.toISOString(),
  })
})
