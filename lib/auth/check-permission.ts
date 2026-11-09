import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { SystemModule } from '@/lib/validations/user'

interface PermissionCheck {
  hasPermission: boolean
  userId?: string
  error?: string
  status?: number
}

/**
 * Loads the CURRENT state of the logged-in user from the DB (role, isActive and
 * the permission for `module`). The JWT can be up to 24 h old, so role changes
 * and deactivations must be read from the database, never trusted from the token.
 */
async function loadActor(module?: SystemModule) {
  const session = await auth()
  if (!session?.user?.id) return null
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      isActive: true,
      ...(module && {
        permissions: { where: { module }, select: { canView: true, canEdit: true } },
      }),
    },
  })
  return user
}

async function checkModule(module: SystemModule, need: 'view' | 'edit'): Promise<PermissionCheck> {
  const actor = await loadActor(module)

  if (!actor) {
    return { hasPermission: false, error: 'No autorizado', status: 401 }
  }

  // Usuario desactivado: se corta el acceso de inmediato aunque su token siga vigente
  if (!actor.isActive) {
    return { hasPermission: false, error: 'Usuario desactivado', status: 401 }
  }

  // Superadmin tiene todos los permisos
  if (actor.role === 'SUPERADMIN') {
    return { hasPermission: true, userId: actor.id }
  }

  const permission = (actor as { permissions?: { canView: boolean; canEdit: boolean }[] }).permissions?.[0]
  const ok = need === 'edit' ? !!permission?.canEdit : !!permission?.canView

  if (!ok) {
    return {
      hasPermission: false,
      error: need === 'edit' ? 'No tienes permiso para editar este recurso' : 'No tienes permiso para ver este recurso',
      status: 403,
    }
  }

  return { hasPermission: true, userId: actor.id }
}

/**
 * Verifica si el usuario actual tiene permiso para ver un módulo
 */
export async function canViewModule(module: SystemModule): Promise<PermissionCheck> {
  return checkModule(module, 'view')
}

/**
 * Verifica si el usuario actual tiene permiso para editar un módulo
 */
export async function canEditModule(module: SystemModule): Promise<PermissionCheck> {
  return checkModule(module, 'edit')
}

/**
 * Exige que el usuario actual sea SUPERADMIN (verificado contra la BD).
 */
export async function requireSuperAdmin(): Promise<PermissionCheck> {
  const actor = await loadActor()
  if (!actor) return { hasPermission: false, error: 'No autorizado', status: 401 }
  if (!actor.isActive) return { hasPermission: false, error: 'Usuario desactivado', status: 401 }
  if (actor.role !== 'SUPERADMIN') {
    return { hasPermission: false, error: 'Solo el superadministrador puede realizar esta acción', status: 403 }
  }
  return { hasPermission: true, userId: actor.id }
}

/**
 * Exige un usuario autenticado y ACTIVO (verificado contra la BD).
 */
export async function requireActiveUser(): Promise<PermissionCheck & { role?: string }> {
  const actor = await loadActor()
  if (!actor) return { hasPermission: false, error: 'No autorizado', status: 401 }
  if (!actor.isActive) return { hasPermission: false, error: 'Usuario desactivado', status: 401 }
  return { hasPermission: true, userId: actor.id, role: actor.role }
}

/**
 * Verifica autenticación básica (solo si está logueado)
 */
export async function checkAuth(): Promise<PermissionCheck> {
  const session = await auth()

  if (!session?.user?.id) {
    return { hasPermission: false, error: 'No autorizado', status: 401 }
  }

  return { hasPermission: true, userId: session.user.id }
}

/**
 * Verifica si es superadmin
 */
export async function isSuperAdmin(): Promise<boolean> {
  return (await requireSuperAdmin()).hasPermission
}
