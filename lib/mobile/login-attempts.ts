import { prisma } from '@/lib/db/prisma'
import type { LoginLimitConfig } from '@/lib/attendance/config'

/**
 * Límite de intentos de login de la app, guardado en Postgres (no hay Redis).
 * Sobrevive a reinicios y despliegues. El limitador de la web no se toca.
 */

export type AttemptState = { count: number; windowStart: Date; blockedUntil: Date | null }

/** Lógica pura: ¿está bloqueada esta clave ahora? */
export function isBlocked(state: AttemptState | null, now: Date): boolean {
  return !!state?.blockedUntil && state.blockedUntil.getTime() > now.getTime()
}

/** Lógica pura: estado resultante tras registrar un intento fallido. */
export function nextStateAfterFailure(state: AttemptState | null, now: Date, config: LoginLimitConfig): AttemptState {
  const windowExpired = !state || now.getTime() - state.windowStart.getTime() > config.windowMs
  const blockExpired = !!state?.blockedUntil && state.blockedUntil.getTime() <= now.getTime()

  if (windowExpired || blockExpired) {
    return { count: 1, windowStart: now, blockedUntil: config.maxAttempts <= 1 ? new Date(now.getTime() + config.blockMs) : null }
  }

  const count = state.count + 1
  return {
    count,
    windowStart: state.windowStart,
    blockedUntil: count >= config.maxAttempts ? new Date(now.getTime() + config.blockMs) : state.blockedUntil,
  }
}

export async function isLoginBlocked(key: string, now = new Date()): Promise<Date | null> {
  const state = await prisma.mobileLoginAttempt.findUnique({ where: { key } })
  return isBlocked(state, now) ? state!.blockedUntil : null
}

export async function registerLoginFailure(key: string, config: LoginLimitConfig, now = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.mobileLoginAttempt.findUnique({ where: { key } })
    const next = nextStateAfterFailure(current, now, config)
    await tx.mobileLoginAttempt.upsert({
      where: { key },
      create: { key, ...next },
      update: next,
    })
  })
}

export async function clearLoginFailures(key: string): Promise<void> {
  await prisma.mobileLoginAttempt.deleteMany({ where: { key } })
}

/** Limpieza oportunista de registros viejos; se llama tras un login correcto. */
export async function purgeOldLoginAttempts(now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  await prisma.mobileLoginAttempt.deleteMany({ where: { updatedAt: { lt: cutoff } } })
}

export const emailKey = (email: string) => `email:${email}`
export const ipKey = (ip: string) => `ip:${ip}`
