import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { CURRENT_CONSENT, CURRENT_CONSENT_HASH } from '@/lib/attendance/consent'
import { getEnrollmentActivation, type EnrollmentActivation } from '@/lib/attendance/enrollment'
import { MobileApiError } from '@/lib/mobile/errors'
import { revokeSession } from '@/lib/mobile/sessions'

/**
 * Activación del empleado en la app: consentimiento vigente + teléfono vinculado
 * + registro facial aprobado.
 */

export type DeviceStatus = 'this_device' | 'none' | 'other_device'

export type Activation = {
  consent: { accepted: boolean; currentVersion: string; acceptedVersion: string | null; acceptedAt: string | null }
  device: { status: DeviceStatus; boundAt: string | null; deviceModel: string | null; platform: string | null }
  enrollment: EnrollmentActivation
}

/** Lógica pura: estado del teléfono que hace la petición frente al teléfono activo. */
export function deviceStatusFor(activeInstallationId: string | null, requestInstallationId: string | null): DeviceStatus {
  if (!activeInstallationId) return 'none'
  return requestInstallationId && activeInstallationId === requestInstallationId ? 'this_device' : 'other_device'
}

export type BindDecision = 'bind' | 'already_bound' | 'bound_elsewhere' | 'consent_required' | 'missing_installation'

/** Lógica pura de la vinculación. */
export function decideBind(params: {
  consentAccepted: boolean
  activeInstallationId: string | null
  requestInstallationId: string | null
}): BindDecision {
  if (!params.requestInstallationId) return 'missing_installation'
  if (!params.consentAccepted) return 'consent_required'
  const status = deviceStatusFor(params.activeInstallationId, params.requestInstallationId)
  if (status === 'this_device') return 'already_bound'
  if (status === 'other_device') return 'bound_elsewhere'
  return 'bind'
}

async function latestAcceptance(userId: string) {
  return prisma.consentAcceptance.findFirst({
    where: { userId, version: CURRENT_CONSENT.version, textHash: CURRENT_CONSENT_HASH },
    orderBy: { acceptedAt: 'desc' },
    select: { version: true, acceptedAt: true },
  })
}

export async function hasCurrentConsent(userId: string): Promise<boolean> {
  return (await latestAcceptance(userId)) !== null
}

export async function getActiveDevice(userId: string) {
  return prisma.mobileDevice.findUnique({ where: { activeUserId: userId } })
}

export async function getActivation(userId: string, installationId: string | null): Promise<Activation> {
  const [acceptance, device, enrollment] = await Promise.all([
    latestAcceptance(userId),
    getActiveDevice(userId),
    getEnrollmentActivation(userId),
  ])
  return {
    consent: {
      accepted: acceptance !== null,
      currentVersion: CURRENT_CONSENT.version,
      acceptedVersion: acceptance?.version ?? null,
      acceptedAt: acceptance?.acceptedAt.toISOString() ?? null,
    },
    device: {
      status: deviceStatusFor(device?.installationId ?? null, installationId),
      boundAt: device?.boundAt.toISOString() ?? null,
      deviceModel: device?.deviceModel ?? null,
      platform: device?.platform ?? null,
    },
    enrollment,
  }
}

export async function acceptConsent(params: {
  userId: string
  version: string
  textHash: string
  installationId: string | null
  ipAddress: string | null
  userAgent: string | null
}) {
  if (params.version !== CURRENT_CONSENT.version || params.textHash !== CURRENT_CONSENT_HASH) {
    throw new MobileApiError('CONSENT_OUTDATED', undefined, { currentVersion: CURRENT_CONSENT.version })
  }
  // Aceptar dos veces la misma versión no crea registros duplicados
  const existing = await latestAcceptance(params.userId)
  if (existing) return existing
  return prisma.consentAcceptance.create({
    data: {
      userId: params.userId,
      version: params.version,
      textHash: params.textHash,
      installationId: params.installationId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
    select: { version: true, acceptedAt: true },
  })
}

export async function bindDevice(params: {
  userId: string
  installationId: string | null
  platform: string | null
  deviceModel: string | null
  appVersion: string | null
}) {
  const [consentAccepted, active] = await Promise.all([hasCurrentConsent(params.userId), getActiveDevice(params.userId)])
  const decision = decideBind({
    consentAccepted,
    activeInstallationId: active?.installationId ?? null,
    requestInstallationId: params.installationId,
  })

  if (decision === 'missing_installation') {
    throw new MobileApiError('VALIDATION_ERROR', 'La sesión no tiene identificador de instalación. Cierra sesión y vuelve a entrar.')
  }
  if (decision === 'consent_required') throw new MobileApiError('CONSENT_REQUIRED')
  if (decision === 'bound_elsewhere') throw new MobileApiError('DEVICE_BOUND_ELSEWHERE')
  if (decision === 'already_bound') return active!

  try {
    return await prisma.mobileDevice.create({
      data: {
        userId: params.userId,
        activeUserId: params.userId,
        installationId: params.installationId!,
        platform: params.platform,
        deviceModel: params.deviceModel,
        appVersion: params.appVersion,
      },
    })
  } catch (error) {
    // Dos vinculaciones simultáneas: el índice único deja pasar solo una
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await getActiveDevice(params.userId)
      if (winner?.installationId === params.installationId) return winner
      throw new MobileApiError('DEVICE_BOUND_ELSEWHERE')
    }
    throw error
  }
}

/**
 * Desvincula el teléfono activo de un usuario (lo hace un admin desde la web) y
 * revoca las sesiones de la app abiertas en ese teléfono. Devuelve el teléfono
 * desvinculado, o null si no había ninguno.
 */
export async function unbindActiveDevice(userId: string, adminId: string, reason: string) {
  const active = await getActiveDevice(userId)
  if (!active) return null

  const updated = await prisma.mobileDevice.updateMany({
    where: { id: active.id, activeUserId: userId },
    data: { activeUserId: null, unboundAt: new Date(), unboundById: adminId, unboundReason: reason },
  })
  if (updated.count !== 1) return null

  const sessions = await prisma.mobileSession.findMany({
    where: { userId, installationId: active.installationId, revokedAt: null },
    select: { id: true },
  })
  await Promise.all(sessions.map((s) => revokeSession(s.id, 'device_unbound')))
  return active
}
