import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { createAuditLog } from '@/lib/audit/log'
import { getActivation } from '@/lib/mobile/activation'
import { MobileApiError } from '@/lib/mobile/errors'
import { isProfileComplete, type ProfileUpdate } from '@/lib/mobile/profile-rules'

export { profileUpdateSchema } from '@/lib/mobile/profile-rules'

/**
 * Perfil del empleado en la app. El administrador crea la cuenta (nombre y correo)
 * en la web; el empleado completa en la app su cédula, celular y fecha de nacimiento.
 * La cédula se fija la primera vez: después solo la cambia un administrador en la web
 * (queda en el historial, USER_CEDULA_CHANGED).
 */

const meSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  position: true,
  cedula: true,
  phone: true,
  birthDate: true,
  image: true,
  permissions: { select: { module: true, canView: true, canEdit: true } },
} satisfies Prisma.UserSelect

/** Respuesta de GET /me (y de las rutas que cambian el perfil). */
export async function loadMe(userId: string, installationId: string | null) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: meSelect })
  if (!user) throw new MobileApiError('TOKEN_INVALID')
  return {
    ...user,
    birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    profileComplete: isProfileComplete(user),
    // SUPERADMIN tiene todos los permisos sin filas en user_permissions
    isSuperAdmin: user.role === 'SUPERADMIN',
    activation: await getActivation(userId, installationId),
  }
}

export async function updateOwnProfile(
  userId: string,
  input: ProfileUpdate,
  client: { ipAddress: string | null; userAgent: string | null }
) {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, cedula: true, phone: true, birthDate: true } })
  if (!current) throw new MobileApiError('TOKEN_INVALID')

  const data: Prisma.UserUpdateInput = {}
  if (input.cedula !== undefined && input.cedula !== current.cedula) {
    if (current.cedula) throw new MobileApiError('CEDULA_LOCKED')
    data.cedula = input.cedula
  }
  if (input.phone !== undefined) data.phone = input.phone
  if (input.birthDate !== undefined) data.birthDate = new Date(`${input.birthDate}T00:00:00Z`)
  if (Object.keys(data).length === 0) return

  try {
    await prisma.user.update({ where: { id: userId }, data })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new MobileApiError('CEDULA_TAKEN')
    throw error
  }

  await createAuditLog({
    module: 'usuarios',
    action: 'USER_PROFILE_COMPLETED_IN_APP',
    entityType: 'user',
    entityId: userId,
    description: `${current.email} actualizó sus datos desde la app`,
    metadata: {
      fields: Object.keys(data),
      ...(data.cedula ? { newCedula: input.cedula } : {}),
    },
    performedBy: userId,
    ...client,
  })
}
