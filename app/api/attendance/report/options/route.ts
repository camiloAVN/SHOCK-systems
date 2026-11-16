import { NextResponse } from 'next/server'
import { canViewModule } from '@/lib/auth/check-permission'
import { reportOptions } from '@/lib/attendance/reports'

export const dynamic = 'force-dynamic'

// GET /api/attendance/report/options — áreas y personas para los filtros del reporte (asistencia_reportes: ver)
export async function GET() {
  const view = await canViewModule('asistencia_reportes')
  if (!view.hasPermission) return NextResponse.json({ error: view.error }, { status: view.status })
  try {
    return NextResponse.json(await reportOptions())
  } catch (error) {
    console.error('Error loading report options:', error)
    return NextResponse.json({ error: 'Error al cargar los filtros' }, { status: 500 })
  }
}
