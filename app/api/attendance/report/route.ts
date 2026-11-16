import { NextRequest, NextResponse } from 'next/server'
import { createAuditLog, getRequestClientInfo } from '@/lib/audit/log'
import { canEditModule, canViewModule } from '@/lib/auth/check-permission'
import { bogotaDayRange } from '@/lib/attendance/report'
import { reportToCsv } from '@/lib/attendance/report-csv'
import { buildAttendanceReport } from '@/lib/attendance/reports'
import { AttendanceActionError } from '@/lib/attendance/reviews'

export const dynamic = 'force-dynamic'

// GET /api/attendance/report?from=YYYY-MM-DD&to=YYYY-MM-DD[&userId][&areaId][&format=csv]
// Reporte por persona y turno, en hora de Bogotá (asistencia_reportes: ver). La exportación queda en la bitácora.
export async function GET(request: NextRequest) {
  const view = await canViewModule('asistencia_reportes')
  if (!view.hasPermission) return NextResponse.json({ error: view.error }, { status: view.status })
  try {
    const q = request.nextUrl.searchParams
    const range = bogotaDayRange(q.get('from') ?? '', q.get('to') ?? '')
    if (!range) return NextResponse.json({ error: 'Fechas inválidas: usa desde y hasta (desde ≤ hasta)' }, { status: 400 })
    const filters = { ...range, userId: q.get('userId') || null, areaId: q.get('areaId') || null }
    const { rows, summary } = await buildAttendanceReport(filters)

    if (q.get('format') === 'csv') {
      const { ipAddress, userAgent } = getRequestClientInfo(request)
      await createAuditLog({
        module: 'asistencia_reportes',
        action: 'ATTENDANCE_REPORT_EXPORTED',
        entityType: 'attendance_report',
        entityId: `${q.get('from')}_${q.get('to')}`,
        description: `Reporte de asistencia exportado (${q.get('from')} a ${q.get('to')}, ${rows.length} filas)`,
        metadata: { from: q.get('from'), to: q.get('to'), userId: filters.userId, areaId: filters.areaId, rows: rows.length },
        performedBy: view.userId!,
        ipAddress,
        userAgent,
      })
      return new NextResponse(reportToCsv(rows), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="asistencia_${q.get('from')}_${q.get('to')}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const edit = await canEditModule('asistencia_reportes')
    return NextResponse.json({ rows, summary, canDecide: edit.hasPermission, currentUserId: view.userId })
  } catch (error) {
    if (error instanceof AttendanceActionError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Error building attendance report:', error)
    return NextResponse.json({ error: 'Error al generar el reporte' }, { status: 500 })
  }
}
