import { prisma } from '@/lib/db/prisma'
import { MobileApiError, mobileOk } from '@/lib/mobile/errors'
import { authedMobileRoute } from '@/lib/mobile/handler'

export const dynamic = 'force-dynamic'

// GET /api/mobile/v1/me — perfil del usuario del token.
// El id sale SIEMPRE del token, nunca de la URL ni del cuerpo.
export const GET = authedMobileRoute(async (_request, actor) => {
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      position: true,
      cedula: true,
      phone: true,
      image: true,
      permissions: { select: { module: true, canView: true, canEdit: true } },
    },
  })
  if (!user) throw new MobileApiError('TOKEN_INVALID')

  return mobileOk({
    ...user,
    // SUPERADMIN tiene todos los permisos sin filas en user_permissions
    isSuperAdmin: user.role === 'SUPERADMIN',
  })
})
