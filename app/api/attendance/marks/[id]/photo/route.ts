import { NextRequest, NextResponse } from 'next/server'
import { createAuditLog, getRequestClientInfo } from '@/lib/audit/log'
import { canViewModule } from '@/lib/auth/check-permission'
import { LockError, markPhotoKey } from '@/lib/attendance/marks'
import { signedReadUrl } from '@/lib/storage/r2-private'

export const dynamic = 'force-dynamic'

// GET /api/attendance/marks/[id]/photo — URL firmada (5 min) de la selfie de una marcación.
// asistencia_reportes: ver. Cada vista queda en la bitácora.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const view = await canViewModule('asistencia_reportes')
  if (!view.hasPermission) return NextResponse.json({ error: view.error }, { status: view.status })
  try {
    const { id } = await params
    const mark = await markPhotoKey(id)
    const url = await signedReadUrl(mark.selfieKey!)
    const { ipAddress, userAgent } = getRequestClientInfo(request)
    await createAuditLog({
      module: 'asistencia_reportes',
      action: 'ATTENDANCE_MARK_PHOTO_VIEWED',
      entityType: 'attendance_mark',
      entityId: mark.id,
      description: `Selfie de marcación vista: ${mark.user.email}`,
      performedBy: view.userId!,
      ipAddress,
      userAgent,
    })
    return NextResponse.json({ url })
  } catch (error) {
    if (error instanceof LockError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Error signing mark photo:', error)
    return NextResponse.json({ error: 'Error al obtener la foto' }, { status: 500 })
  }
}
