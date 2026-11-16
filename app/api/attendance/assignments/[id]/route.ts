import { NextRequest, NextResponse } from 'next/server'
import { canEditModule } from '@/lib/auth/check-permission'
import { deleteAssignment, updateAssignment } from '@/lib/attendance/areas'
import { areaErrorResponse, auditAreas } from '@/lib/attendance/route-helpers'
import { attendanceAssignmentSchema } from '@/lib/validations/attendance'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// PUT /api/attendance/assignments/[id] — reemplaza destino, notas y todos los turnos
export async function PUT(request: NextRequest, { params }: Ctx) {
  const edit = await canEditModule('asistencia_areas')
  if (!edit.hasPermission) return NextResponse.json({ error: edit.error }, { status: edit.status })
  try {
    const { id } = await params
    const input = attendanceAssignmentSchema.parse(await request.json())
    const { area, assignment } = await updateAssignment(id, input)
    const target = assignment.user ? assignment.user.email : `equipo ${assignment.team?.name}`
    await auditAreas(request, edit.userId!, {
      action: 'ATTENDANCE_ASSIGNMENT_UPDATED',
      entityType: 'attendance_assignment',
      entityId: id,
      description: `Asignación del área "${area.name}" a ${target} editada (${assignment.shifts.length} turnos)`,
      metadata: { areaId: area.id, userId: assignment.userId, teamId: assignment.teamId, shifts: assignment.shifts.length },
    })
    return NextResponse.json(assignment)
  } catch (error) {
    return areaErrorResponse(error, 'Error editando asignación')
  }
}

// DELETE /api/attendance/assignments/[id]
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const edit = await canEditModule('asistencia_areas')
  if (!edit.hasPermission) return NextResponse.json({ error: edit.error }, { status: edit.status })
  try {
    const { id } = await params
    const removed = await deleteAssignment(id)
    const target = removed.user ? removed.user.email : `equipo ${removed.team?.name}`
    await auditAreas(request, edit.userId!, {
      action: 'ATTENDANCE_ASSIGNMENT_DELETED',
      entityType: 'attendance_assignment',
      entityId: id,
      description: `Asignación del área "${removed.area.name}" a ${target} eliminada`,
      metadata: { areaId: removed.area.id, userId: removed.userId, teamId: removed.teamId },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return areaErrorResponse(error, 'Error eliminando asignación')
  }
}
