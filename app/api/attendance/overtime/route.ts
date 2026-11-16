import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { createAuditLog, getRequestClientInfo } from '@/lib/audit/log'
import { canEditModule } from '@/lib/auth/check-permission'
import { decideOvertime } from '@/lib/attendance/reports'
import { AttendanceActionError } from '@/lib/attendance/reviews'

export const dynamic = 'force-dynamic'

const schema = z.object({
  userId: z.string().min(1),
  shiftId: z.string().min(1),
  decision: z.enum(['APPROVED', 'REJECTED']),
  minutes: z.number().int().positive().optional().nullable(),
  note: z.string().trim().max(500, 'La nota no puede exceder 500 caracteres').optional().nullable(),
})

// POST /api/attendance/overtime — aprobar (todo o parte) o rechazar las horas extra de una persona
// en un turno (asistencia_reportes: editar). El servidor recalcula los minutos. Nadie decide las suyas.
export async function POST(request: NextRequest) {
  const edit = await canEditModule('asistencia_reportes')
  if (!edit.hasPermission) return NextResponse.json({ error: edit.error }, { status: edit.status })
  try {
    const body = schema.parse(await request.json())
    const { decision, user, areaName, computed } = await decideOvertime({ ...body, reviewerId: edit.userId! })
    const { ipAddress, userAgent } = getRequestClientInfo(request)
    await createAuditLog({
      module: 'asistencia_reportes',
      action: 'ATTENDANCE_OVERTIME_DECIDED',
      entityType: 'attendance_overtime',
      entityId: decision.id,
      description: `Horas extra de ${user.email} en "${areaName}": ${decision.decision === 'APPROVED' ? `aprobadas ${decision.approvedMinutes} de ${computed} min` : 'rechazadas'}`,
      metadata: { userId: user.id, shiftId: body.shiftId, decision: decision.decision, computedMinutes: computed, approvedMinutes: decision.approvedMinutes, note: decision.note },
      performedBy: edit.userId!,
      ipAddress,
      userAgent,
    })
    return NextResponse.json({ ok: true, approvedMinutes: decision.approvedMinutes })
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    if (error instanceof AttendanceActionError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'El cuerpo debe ser JSON válido' }, { status: 400 })
    console.error('Error deciding overtime:', error)
    return NextResponse.json({ error: 'Error al decidir las horas extra' }, { status: 500 })
  }
}
