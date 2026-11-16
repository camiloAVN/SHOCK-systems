import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { createAuditLog, getRequestClientInfo } from '@/lib/audit/log'
import { canEditModule } from '@/lib/auth/check-permission'
import { LockError, unlockShift } from '@/lib/attendance/marks'

export const dynamic = 'force-dynamic'

const schema = z.object({ note: z.string().trim().min(1, 'El motivo es obligatorio').max(500, 'El motivo no puede exceder 500 caracteres') })

// POST /api/attendance/locks/[id]/unlock — desbloquear un turno (asistencia_reportes: editar).
// Nadie puede desbloquear su propio turno. Exige motivo; queda en la bitácora.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const edit = await canEditModule('asistencia_reportes')
  if (!edit.hasPermission) return NextResponse.json({ error: edit.error }, { status: edit.status })
  try {
    const { id } = await params
    const { note } = schema.parse(await request.json())
    const lock = await unlockShift({ lockId: id, reviewerId: edit.userId!, note })
    const { ipAddress, userAgent } = getRequestClientInfo(request)
    await createAuditLog({
      module: 'asistencia_reportes',
      action: 'ATTENDANCE_SHIFT_UNLOCKED',
      entityType: 'attendance_shift_lock',
      entityId: lock.id,
      description: `Turno desbloqueado para ${lock.user.email} en "${lock.shift.assignment.area.name}"`,
      metadata: { lockId: lock.id, userId: lock.userId, shiftId: lock.shiftId, note },
      performedBy: edit.userId!,
      ipAddress,
      userAgent,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    if (error instanceof LockError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'El cuerpo debe ser JSON válido' }, { status: 400 })
    console.error('Error unlocking shift:', error)
    return NextResponse.json({ error: 'Error al desbloquear el turno' }, { status: 500 })
  }
}
