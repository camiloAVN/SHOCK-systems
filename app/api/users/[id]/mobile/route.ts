import { NextResponse } from 'next/server'
import { CURRENT_CONSENT, CURRENT_CONSENT_HASH } from '@/lib/attendance/consent'
import { getEnrollmentActivation } from '@/lib/attendance/enrollment'
import { prisma } from '@/lib/db/prisma'
import { requireAdminOver } from '@/lib/mobile/admin-access'

export const dynamic = 'force-dynamic'

// GET /api/users/[id]/mobile — estado del empleado en la app (para la pantalla de usuarios)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const access = await requireAdminOver(id, { write: false })
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const [lastAcceptance, activeDevice, openSessions, enrollment] = await Promise.all([
      prisma.consentAcceptance.findFirst({
        where: { userId: id },
        orderBy: { acceptedAt: 'desc' },
        select: { version: true, textHash: true, acceptedAt: true },
      }),
      prisma.mobileDevice.findUnique({
        where: { activeUserId: id },
        select: { id: true, platform: true, deviceModel: true, appVersion: true, boundAt: true },
      }),
      prisma.mobileSession.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } }),
      getEnrollmentActivation(id),
    ])

    return NextResponse.json({
      consent: {
        currentVersion: CURRENT_CONSENT.version,
        accepted:
          !!lastAcceptance &&
          lastAcceptance.version === CURRENT_CONSENT.version &&
          lastAcceptance.textHash === CURRENT_CONSENT_HASH,
        lastAcceptedVersion: lastAcceptance?.version ?? null,
        lastAcceptedAt: lastAcceptance?.acceptedAt ?? null,
      },
      device: activeDevice,
      openSessions,
      enrollment,
      canManage: !(access.actorRole !== 'SUPERADMIN' && (access.target.role === 'ADMIN' || access.target.role === 'SUPERADMIN')),
    })
  } catch (error) {
    console.error('Error fetching mobile status:', error)
    return NextResponse.json({ error: 'Error al obtener el estado de la app' }, { status: 500 })
  }
}
