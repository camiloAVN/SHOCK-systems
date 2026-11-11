import { compare } from 'bcrypt'
import { prisma } from '@/lib/db/prisma'

/**
 * Verificación de correo y contraseña para la app.
 *
 * Misma secuencia que el provider Credentials de `auth.ts` (web): correo en
 * minúsculas, bcrypt, comparación de relleno si el usuario no existe.
 * Está duplicada a propósito para no tocar el login web en la Fase 1.
 * Si cambias una, revisa la otra.
 */

// Mismo hash de relleno que auth.ts: iguala el tiempo de respuesta cuando el correo no existe
const DUMMY_HASH = '$2b$12$invalidhashtopreventtimingattacks'

export type VerifiedUser = {
  id: string
  email: string
  name: string | null
  image: string | null
  role: 'SUPERADMIN' | 'ADMIN' | 'USER'
  position: string | null
  passwordHash: string
}

export type CredentialsResult =
  | { ok: true; user: VerifiedUser }
  | { ok: false; reason: 'invalid' | 'inactive' }

export async function verifyCredentials(emailInput: string, password: string): Promise<CredentialsResult> {
  const email = emailInput.toLowerCase()

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, image: true, role: true, position: true, password: true, isActive: true },
  })

  if (!user || !user.password) {
    await compare(password, DUMMY_HASH).catch(() => false)
    return { ok: false, reason: 'invalid' }
  }

  const valid = await compare(password, user.password)
  if (!valid) return { ok: false, reason: 'invalid' }

  // "Desactivado" solo se revela a quien conoce la contraseña correcta
  if (!user.isActive) return { ok: false, reason: 'inactive' }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      position: user.position,
      passwordHash: user.password,
    },
  }
}
