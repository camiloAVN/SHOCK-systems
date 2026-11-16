import { NextRequest, NextResponse } from 'next/server'
import { canEditModule, canViewModule } from '@/lib/auth/check-permission'
import { createArea, listAreas, mapStyleUrl } from '@/lib/attendance/areas'
import { areaErrorResponse, auditAreas } from '@/lib/attendance/route-helpers'
import { attendanceAreaSchema } from '@/lib/validations/attendance'

export const dynamic = 'force-dynamic'

// GET /api/attendance/areas — lista de áreas (asistencia_areas: ver)
export async function GET() {
  const view = await canViewModule('asistencia_areas')
  if (!view.hasPermission) return NextResponse.json({ error: view.error }, { status: view.status })
  try {
    const [areas, edit] = await Promise.all([listAreas(), canEditModule('asistencia_areas')])
    return NextResponse.json({ areas, canEdit: edit.hasPermission, mapStyleUrl: mapStyleUrl() })
  } catch (error) {
    return areaErrorResponse(error, 'Error listando áreas')
  }
}

// POST /api/attendance/areas — crear área (asistencia_areas: editar)
export async function POST(request: NextRequest) {
  const edit = await canEditModule('asistencia_areas')
  if (!edit.hasPermission) return NextResponse.json({ error: edit.error }, { status: edit.status })
  try {
    const input = attendanceAreaSchema.parse(await request.json())
    const area = await createArea(input, edit.userId!)
    await auditAreas(request, edit.userId!, {
      action: 'ATTENDANCE_AREA_CREATED',
      entityType: 'attendance_area',
      entityId: area.id,
      description: `Área de asistencia creada: ${area.name}`,
      metadata: { ...input },
    })
    return NextResponse.json(area, { status: 201 })
  } catch (error) {
    return areaErrorResponse(error, 'Error creando área')
  }
}
