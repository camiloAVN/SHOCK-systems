import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { createAuditLog, getRequestClientInfo } from '@/lib/audit/log'
import { canEditModule } from '@/lib/auth/check-permission'
import { ReviewError, reviewEnrollment } from '@/lib/attendance/enrollment'

export const dynamic = 'force-dynamic'

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'revoke']),
  note: z.string().trim().max(500, 'El motivo no puede exceder 500 caracteres').optional().nullable(),
})

const AUDIT = {
  approve: { action: 'FACE_ENROLLMENT_APPROVED', verb: 'aprobado' },
  reject: { action: 'FACE_ENROLLMENT_REJECTED', verb: 'rechazado' },
  revoke: { action: 'FACE_ENROLLMENT_REVOKED', verb: 'anulado' },
} as const

// POST /api/attendance/enrollments/[id]/review — aprobar, rechazar o anular un registro facial.
// SUPERADMIN o asistencia_reportes con edición. Nadie puede revisar su propio registro.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const edit = await canEditModule('asistencia_reportes')
  if (!edit.hasPermission) return NextResponse.json({ error: edit.error }, { status: edit.status })

  try {
    const { id } = await params
    const { action, note } = reviewSchema.parse(await request.json())
    const { enrollment, next } = await reviewEnrollment({ enrollmentId: id, reviewerId: edit.userId!, action, note: note ?? null })

    const { ipAddress, userAgent } = getRequestClientInfo(request)
    await createAuditLog({
      module: 'asistencia_reportes',
      action: AUDIT[action].action,
      entityType: 'face_enrollment',
      entityId: enrollment.id,
      description: `Registro facial ${AUDIT[action].verb}: ${enrollment.user.email}`,
      metadata: { enrollmentId: enrollment.id, userId: enrollment.userId, previousStatus: enrollment.status, newStatus: next, note: note ?? null },
      performedBy: edit.userId!,
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ id: enrollment.id, status: next })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    if (error instanceof ReviewError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Error reviewing face enrollment:', error)
    return NextResponse.json({ error: 'Error al revisar el registro facial' }, { status: 500 })
  }
}
