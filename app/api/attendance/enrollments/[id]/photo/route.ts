import { NextRequest, NextResponse } from 'next/server'
import { createAuditLog, getRequestClientInfo } from '@/lib/audit/log'
import { canViewModule } from '@/lib/auth/check-permission'
import { prisma } from '@/lib/db/prisma'
import { signedReadUrl } from '@/lib/storage/r2-private'

export const dynamic = 'force-dynamic'

const URL_TTL_SECONDS = 300

// GET /api/attendance/enrollments/[id]/photo — URL firmada (5 min) de la foto de referencia.
// La foto es un dato biométrico: cada consulta queda en la bitácora de auditoría.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const view = await canViewModule('asistencia_reportes')
  if (!view.hasPermission) return NextResponse.json({ error: view.error }, { status: view.status })

  try {
    const { id } = await params
    const enrollment = await prisma.faceEnrollment.findUnique({
      where: { id },
      select: { id: true, imageKey: true, user: { select: { id: true, email: true } } },
    })
    if (!enrollment) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
    if (!enrollment.imageKey) return NextResponse.json({ error: 'La foto de este registro ya fue eliminada' }, { status: 410 })

    const url = await signedReadUrl(enrollment.imageKey, URL_TTL_SECONDS)
    const { ipAddress, userAgent } = getRequestClientInfo(request)
    await createAuditLog({
      module: 'asistencia_reportes',
      action: 'FACE_ENROLLMENT_PHOTO_VIEWED',
      entityType: 'face_enrollment',
      entityId: enrollment.id,
      description: `Foto de referencia consultada: ${enrollment.user.email}`,
      metadata: { enrollmentId: enrollment.id, userId: enrollment.user.id },
      performedBy: view.userId!,
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ url, expiresInSeconds: URL_TTL_SECONDS }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error signing enrollment photo URL:', error)
    return NextResponse.json({ error: 'Error al obtener la foto' }, { status: 500 })
  }
}
