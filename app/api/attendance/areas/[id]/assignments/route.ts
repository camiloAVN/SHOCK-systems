import { NextRequest, NextResponse } from 'next/server'
import { canEditModule } from '@/lib/auth/check-permission'
import { createAssignment } from '@/lib/attendance/areas'
import { areaErrorResponse, auditAreas } from '@/lib/attendance/route-helpers'
import { attendanceAssignmentSchema } from '@/lib/validations/attendance'

export const dynamic = 'force-dynamic'

// POST /api/attendance/areas/[id]/assignments — asignar el área a una persona o equipo con sus turnos
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const edit = await canEditModule('asistencia_areas')
  if (!edit.hasPermission) return NextResponse.json({ error: edit.error }, { status: edit.status })
  try {
    const { id } = await params
    const input = attendanceAssignmentSchema.parse(await request.json())
    const { area, assignment } = await createAssignment(id, input, edit.userId!)
    const target = assignment.user ? assignment.user.email : `equipo ${assignment.team?.name}`
    await auditAreas(request, edit.userId!, {
      action: 'ATTENDANCE_ASSIGNMENT_CREATED',
      entityType: 'attendance_assignment',
      entityId: assignment.id,
      description: `Área "${area.name}" asignada a ${target} (${assignment.shifts.length} turnos)`,
      metadata: { areaId: area.id, userId: assignment.userId, teamId: assignment.teamId, shifts: assignment.shifts.length },
    })
    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    return areaErrorResponse(error, 'Error creando asignación')
  }
}
