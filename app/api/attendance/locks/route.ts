import { NextResponse } from 'next/server'
import { canEditModule, canViewModule } from '@/lib/auth/check-permission'
import { listActiveLocks } from '@/lib/attendance/marks'

export const dynamic = 'force-dynamic'

// GET /api/attendance/locks — turnos bloqueados por rostros fallidos (asistencia_reportes: ver)
export async function GET() {
  const view = await canViewModule('asistencia_reportes')
  if (!view.hasPermission) return NextResponse.json({ error: view.error }, { status: view.status })
  try {
    const [locks, edit] = await Promise.all([listActiveLocks(), canEditModule('asistencia_reportes')])
    return NextResponse.json({ locks, canUnlock: edit.hasPermission, currentUserId: view.userId })
  } catch (error) {
    console.error('Error listing shift locks:', error)
    return NextResponse.json({ error: 'Error al obtener los turnos bloqueados' }, { status: 500 })
  }
}
