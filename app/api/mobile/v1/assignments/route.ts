import { myAssignments } from '@/lib/attendance/areas'
import { timeAnchorFor } from '@/lib/attendance/marks'
import { mobileOk } from '@/lib/mobile/errors'
import { authedMobileRoute } from '@/lib/mobile/handler'

export const dynamic = 'force-dynamic'

// GET /api/mobile/v1/assignments — mis áreas con turnos abiertos o próximos (el id sale del token).
// Incluye la hora del servidor para que la app calcule estados sin fiarse del reloj del teléfono.
export const GET = authedMobileRoute(async (_request, actor) => {
  const now = new Date()
  const assignments = await myAssignments(actor.userId, now)
  // timeAnchor: hora firmada para calcular la hora de las marcaciones sin conexión (Fase 8)
  return mobileOk({ serverTime: now.toISOString(), timeAnchor: timeAnchorFor(actor.userId, now), assignments })
})
