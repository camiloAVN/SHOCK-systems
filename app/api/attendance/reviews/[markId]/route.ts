import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { createAuditLog, getRequestClientInfo } from '@/lib/audit/log'
import { canEditModule } from '@/lib/auth/check-permission'
import { AttendanceActionError, reviewMark } from '@/lib/attendance/reviews'

export const dynamic = 'force-dynamic'

const schema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().min(1, 'La nota es obligatoria').max(500, 'La nota no puede exceder 500 caracteres'),
})

// POST /api/attendance/reviews/[markId] — aprobar o rechazar una marcación en revisión
// (asistencia_reportes: editar). Nota obligatoria; nadie revisa sus propias marcaciones.
export async function POST(request: NextRequest, { params }: { params: Promise<{ markId: string }> }) {
  const edit = await canEditModule('asistencia_reportes')
  if (!edit.hasPermission) return NextResponse.json({ error: edit.error }, { status: edit.status })
  try {
    const { markId } = await params
    const { decision, note } = schema.parse(await request.json())
    const mark = await reviewMark({ markId, reviewerId: edit.userId!, decision, note })
    const { ipAddress, userAgent } = getRequestClientInfo(request)
    await createAuditLog({
      module: 'asistencia_reportes',
      action: 'ATTENDANCE_MARK_REVIEWED',
      entityType: 'attendance_mark',
      entityId: mark.id,
      description: `${mark.type === 'IN' ? 'Entrada' : 'Salida'} de ${mark.user.email} en "${mark.shift.assignment.area.name}" ${decision === 'APPROVED' ? 'aprobada' : 'rechazada'}`,
      metadata: { markId: mark.id, userId: mark.userId, decision, note },
      performedBy: edit.userId!,
      ipAddress,
      userAgent,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    if (error instanceof AttendanceActionError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'El cuerpo debe ser JSON válido' }, { status: 400 })
    console.error('Error reviewing mark:', error)
    return NextResponse.json({ error: 'Error al revisar la marcación' }, { status: 500 })
  }
}
