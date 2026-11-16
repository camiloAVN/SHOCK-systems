import type { OvertimeState, ShiftStatus } from './report'
import { formatMinutes } from './report'
import type { ReportRow } from './reports'
import { dateToBogotaInput } from './shifts'

/**
 * CSV del reporte para Excel en español: separador ";", UTF-8 con BOM, horas de Bogotá.
 * Las celdas que empiezan con = + - @ se anteponen con ' (evita fórmulas inyectadas en Excel).
 */

export const STATUS_TEXT: Record<ShiftStatus, string> = {
  upcoming: 'Próximo',
  in_progress: 'En curso',
  missing_exit: 'Sin salida',
  absent: 'Ausente',
  complete: 'Completo',
}

export const OVERTIME_TEXT: Record<OvertimeState, string> = {
  none: '',
  blocked_by_review: 'Revisar marcaciones primero',
  to_approve: 'Por aprobar',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  changed: 'Cambió: decidir de nuevo',
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const date = (iso: string | null) => (iso ? dateToBogotaInput(new Date(iso)).slice(0, 10) : '')
const dateTime = (iso: string | null) => (iso ? dateToBogotaInput(new Date(iso)).replace('T', ' ') : '')

export function reportToCsv(rows: ReportRow[]): string {
  const header = [
    'Fecha',
    'Persona',
    'Cédula',
    'Correo',
    'Área',
    'Equipo',
    'Inicio planeado',
    'Fin planeado',
    'Primera entrada',
    'Última salida',
    'Estado',
    'Trabajado (h:mm)',
    'Trabajado (min)',
    'En revisión (min)',
    'Tardanza (min)',
    'Salida anticipada (min)',
    'Extra calculada (min)',
    'Extra aprobada (min)',
    'Estado extra',
    'Nota extra',
    'Marcaciones en revisión',
    'Marcaciones rechazadas',
  ]
  const lines = rows.map((r) =>
    [
      date(r.shift.startsAt),
      r.user.name ?? '',
      r.user.cedula ?? '',
      r.user.email,
      r.area.name,
      r.via.type === 'team' ? r.via.teamName : '',
      dateTime(r.shift.startsAt),
      dateTime(r.shift.endsAt),
      dateTime(r.firstIn),
      dateTime(r.lastOut),
      STATUS_TEXT[r.status],
      formatMinutes(r.workedMinutes),
      r.workedMinutes,
      r.pendingMinutes,
      r.lateMinutes,
      r.earlyLeaveMinutes,
      r.overtimeMinutes,
      r.overtime.approvedMinutes,
      OVERTIME_TEXT[r.overtime.state],
      r.overtime.note,
      r.pendingReviews,
      r.rejectedMarks,
    ]
      .map(cell)
      .join(';')
  )
  const BOM = String.fromCharCode(0xfeff)
  const CRLF = String.fromCharCode(13, 10)
  return BOM + [header.map(cell).join(';'), ...lines].join(CRLF) + CRLF
}
