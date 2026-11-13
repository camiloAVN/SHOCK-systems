import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { SUPERADMIN_EMAIL } from '@/lib/validations/user'

/**
 * Acceso de la web a la gestión de la app móvil de un empleado (ver su estado,
 * desvincular su teléfono). Mismas reglas que `app/api/users`:
 * - Solo ADMIN o SUPERADMIN, con rol leído de la BD (nunca del JWT).
 * - Un ADMIN no puede actuar sobre otro ADMIN ni sobre el SUPERADMIN.
 */

type Role = 'SUPERADMIN' | 'ADMIN' | 'USER'

export type AdminAccess =
  | { ok: true; actorId: string; actorRole: Role; target: { id: string; email: string; role: Role } }
  | { ok: false; status: number; error: string }

export async function requireAdminOver(targetUserId: string, { write }: { write: boolean }): Promise<AdminAccess> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, status: 401, error: 'No autorizado' }

  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, isActive: true, email: true },
  })
  if (!actor || !actor.isActive) return { ok: false, status: 401, error: 'No autorizado' }
  const actorRole: Role = actor.email === SUPERADMIN_EMAIL ? 'SUPERADMIN' : actor.role
  if (actorRole !== 'ADMIN' && actorRole !== 'SUPERADMIN') return { ok: false, status: 403, error: 'Acceso denegado' }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, role: true },
  })
  if (!target) return { ok: false, status: 404, error: 'Usuario no encontrado' }

  const targetIsAdmin = target.role === 'ADMIN' || target.role === 'SUPERADMIN' || target.email === SUPERADMIN_EMAIL
  if (write && actorRole !== 'SUPERADMIN' && targetIsAdmin) {
    return { ok: false, status: 403, error: 'Solo el superadministrador puede gestionar la app de un administrador' }
  }

  return { ok: true, actorId: actor.id, actorRole, target }
}
