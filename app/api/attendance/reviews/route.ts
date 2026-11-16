import { NextRequest, NextResponse } from 'next/server'
import { canEditModule, canViewModule } from '@/lib/auth/check-permission'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { listReviewQueue } from '@/lib/attendance/reviews'

export const dynamic = 'force-dynamic'

// GET /api/attendance/reviews?state=pending|done — bandeja de marcaciones en revisión (asistencia_reportes: ver)
export async function GET(request: NextRequest) {
  const view = await canViewModule('asistencia_reportes')
  if (!view.hasPermission) return NextResponse.json({ error: view.error }, { status: view.status })
  try {
    const state = request.nextUrl.searchParams.get('state') === 'done' ? 'done' : 'pending'
    const [marks, edit] = await Promise.all([listReviewQueue(state), canEditModule('asistencia_reportes')])
    return NextResponse.json({
      marks,
      canReview: edit.hasPermission,
      currentUserId: view.userId,
      mapStyleUrl: process.env.MAP_STYLE_URL || ATTENDANCE_CONFIG.map.defaultStyleUrl,
    })
  } catch (error) {
    console.error('Error listing mark reviews:', error)
    return NextResponse.json({ error: 'Error al obtener las marcaciones en revisión' }, { status: 500 })
  }
}
