import { NextRequest, NextResponse } from 'next/server'
import { canEditModule, canViewModule } from '@/lib/auth/check-permission'
import { deleteArea, getAreaDetail, mapStyleUrl, updateArea } from '@/lib/attendance/areas'
import { areaErrorResponse, auditAreas } from '@/lib/attendance/route-helpers'
import { attendanceAreaSchema } from '@/lib/validations/attendance'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/attendance/areas/[id] — área con sus asignaciones y turnos (asistencia_areas: ver)
export async function GET(_request: NextRequest, { params }: Ctx) {
  const view = await canViewModule('asistencia_areas')
  if (!view.hasPermission) return NextResponse.json({ error: view.error }, { status: view.status })
  try {
    const { id } = await params
    const [area, edit] = await Promise.all([getAreaDetail(id), canEditModule('asistencia_areas')])
    return NextResponse.json({ area, canEdit: edit.hasPermission, mapStyleUrl: mapStyleUrl() })
  } catch (error) {
    return areaErrorResponse(error, 'Error obteniendo área')
  }
}

// PUT /api/attendance/areas/[id] — editar área (asistencia_areas: editar)
export async function PUT(request: NextRequest, { params }: Ctx) {
  const edit = await canEditModule('asistencia_areas')
  if (!edit.hasPermission) return NextResponse.json({ error: edit.error }, { status: edit.status })
  try {
    const { id } = await params
    const input = attendanceAreaSchema.parse(await request.json())
    const { before, after } = await updateArea(id, input)
    await auditAreas(request, edit.userId!, {
      action: 'ATTENDANCE_AREA_UPDATED',
      entityType: 'attendance_area',
      entityId: id,
      description: `Área de asistencia editada: ${after.name}`,
      metadata: {
        before: { name: before.name, latitude: before.latitude, longitude: before.longitude, radiusMeters: before.radiusMeters, isActive: before.isActive, projectId: before.project?.id ?? null },
        after: { ...input },
      },
    })
    return NextResponse.json(after)
  } catch (error) {
    return areaErrorResponse(error, 'Error editando área')
  }
}

// DELETE /api/attendance/areas/[id] — eliminar área con sus asignaciones (asistencia_areas: editar)
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const edit = await canEditModule('asistencia_areas')
  if (!edit.hasPermission) return NextResponse.json({ error: edit.error }, { status: edit.status })
  try {
    const { id } = await params
    const area = await deleteArea(id)
    await auditAreas(request, edit.userId!, {
      action: 'ATTENDANCE_AREA_DELETED',
      entityType: 'attendance_area',
      entityId: id,
      description: `Área de asistencia eliminada: ${area.name}`,
      metadata: { name: area.name, assignments: area._count.assignments },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return areaErrorResponse(error, 'Error eliminando área')
  }
}
