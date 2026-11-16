import { NextResponse } from 'next/server'
import { canEditModule } from '@/lib/auth/check-permission'
import { assignmentOptions } from '@/lib/attendance/areas'
import { areaErrorResponse } from '@/lib/attendance/route-helpers'

export const dynamic = 'force-dynamic'

// GET /api/attendance/options — personas, equipos y proyectos para los formularios de áreas.
// Ruta propia para no exigir los permisos de usuarios o proyectos a quien solo gestiona áreas.
export async function GET() {
  const edit = await canEditModule('asistencia_areas')
  if (!edit.hasPermission) return NextResponse.json({ error: edit.error }, { status: edit.status })
  try {
    return NextResponse.json(await assignmentOptions())
  } catch (error) {
    return areaErrorResponse(error, 'Error cargando opciones')
  }
}
