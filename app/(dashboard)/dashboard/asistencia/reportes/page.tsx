'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart3, Download, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { formatMinutes } from '@/lib/attendance/report'
import { OVERTIME_TEXT, STATUS_TEXT } from '@/lib/attendance/report-csv'
import type { PersonSummary, ReportRow } from '@/lib/attendance/reports'
import { bogotaTime, dateToBogotaInput, describe } from '@/lib/attendance/shifts'

const DAY = 24 * 3_600_000
const bogotaDate = (ms: number) => dateToBogotaInput(new Date(ms)).slice(0, 10)

const STATUS_TONE: Record<string, string> = {
  complete: 'bg-green-500/15 text-green-300',
  in_progress: 'bg-sky-500/15 text-sky-300',
  upcoming: 'bg-white/[0.06] text-gray-400',
  missing_exit: 'bg-orange-500/15 text-orange-300',
  absent: 'bg-red-500/15 text-red-300',
}

const OT_TONE: Record<string, string> = {
  approved: 'text-green-300',
  rejected: 'text-red-300',
  to_approve: 'text-orange-300',
  changed: 'text-orange-300',
  blocked_by_review: 'text-gray-400',
}

/** "1:35" o "—" */
const hm = (min: number) => (min > 0 ? formatMinutes(min) : '—')
/** Etiqueta visible solo en el celular (la tabla se vuelve tarjetas y pierde el encabezado) */
const L = ({ children }: { children: string }) => <span className="text-gray-500 md:hidden">{children}: </span>

const PAIR_TEXT: Record<string, string> = { pending: ' (en revisión)', rejected: ' (rechazada)', open: ' → sin salida', orphan_out: ' (salida sin entrada)' }

function Pairs({ row }: { row: ReportRow }) {
  if (row.pairs.length === 0) return <span className="text-gray-500">Sin marcaciones</span>
  return (
    <span className="space-y-0.5">
      {row.pairs.map((p, i) => (
        <span key={i} className={`block ${p.state === 'rejected' ? 'text-red-300 line-through' : p.state === 'pending' ? 'text-orange-300' : ''}`}>
          {p.in ? bogotaTime(new Date(p.in)) : '¿?'} – {p.out ? bogotaTime(new Date(p.out)) : '¿?'}
          {PAIR_TEXT[p.state] ?? ''}
        </span>
      ))}
    </span>
  )
}

export default function AttendanceReportPage() {
  const today = Date.now()
  const [from, setFrom] = useState(bogotaDate(today - 6 * DAY))
  const [to, setTo] = useState(bogotaDate(today))
  const [userId, setUserId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [options, setOptions] = useState<{ areas: { id: string; name: string }[]; users: { id: string; name: string | null; email: string }[] }>({ areas: [], users: [] })
  const [rows, setRows] = useState<ReportRow[] | null>(null)
  const [summary, setSummary] = useState<PersonSummary[]>([])
  const [canDecide, setCanDecide] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [target, setTarget] = useState<ReportRow | null>(null)
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const query = useMemo(() => {
    const q = new URLSearchParams({ from, to })
    if (userId) q.set('userId', userId)
    if (areaId) q.set('areaId', areaId)
    return q.toString()
  }, [from, to, userId, areaId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/attendance/report?${query}`)
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Error al generar el reporte')
      setRows(body.rows)
      setSummary(body.summary)
      setCanDecide(body.canDecide)
      setCurrentUserId(body.currentUserId)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    fetch('/api/attendance/report/options')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => body && setOptions(body))
      .catch(() => {})
    void load()
    // Solo al entrar; después, con el botón "Ver reporte"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openDecision = (row: ReportRow) => {
    setTarget(row)
    setMinutes(String(row.overtimeMinutes))
    setNote(row.overtime.note ?? '')
  }

  const decide = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!target) return
    setBusy(true)
    try {
      const r = await fetch('/api/attendance/overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: target.user.id,
          shiftId: target.shift.id,
          decision,
          minutes: decision === 'APPROVED' ? Number(minutes) : null,
          note: note.trim() || null,
        }),
      })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Error al guardar')
      toast.success(decision === 'APPROVED' ? `Horas extra aprobadas: ${formatMinutes(body.approvedMinutes)}` : 'Horas extra rechazadas')
      setTarget(null)
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toDecide = rows?.filter((r) => ['to_approve', 'changed'].includes(r.overtime.state) && r.user.id !== currentUserId).length ?? 0
  const pendingReviews = rows?.reduce((s, r) => s + r.pendingReviews, 0) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <BarChart3 className="h-7 w-7 text-orange-400" />
          Reportes de asistencia
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Horas trabajadas, tardanzas (más de {ATTENDANCE_CONFIG.shifts.lateToleranceMs / 60_000} min), salidas anticipadas y horas extra (después del fin del turno, desde{' '}
          {ATTENDANCE_CONFIG.reports.overtimeMinMs / 60_000} min), en hora de Colombia. Las horas extra se aprueban aquí.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_1.4fr_auto]">
        <Input type="date" label="Desde" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" label="Hasta" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        <Select
          label="Persona"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          options={[{ value: '', label: 'Todas' }, ...options.users.map((u) => ({ value: u.id, label: u.name || u.email }))]}
        />
        <Select label="Área" value={areaId} onChange={(e) => setAreaId(e.target.value)} options={[{ value: '', label: 'Todas' }, ...options.areas.map((a) => ({ value: a.id, label: a.name }))]} />
        <div className="flex items-end gap-2">
          <Button onClick={load} isLoading={loading} className="flex-1 lg:flex-none">
            <Search className="mr-2 h-4 w-4" />
            Ver reporte
          </Button>
          <a href={`/api/attendance/report?${query}&format=csv`} className="inline-flex h-11 items-center rounded-lg border border-white/15 px-3 text-sm font-medium text-gray-200 hover:bg-white/5 sm:h-10" title="Descargar CSV para Excel">
            <Download className="mr-1.5 h-4 w-4" />
            CSV
          </a>
        </div>
      </div>

      {(toDecide > 0 || pendingReviews > 0) && (
        <div className="flex flex-col gap-1 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-200">
          {pendingReviews > 0 && (
            <p>
              Hay {pendingReviews} {pendingReviews === 1 ? 'marcación' : 'marcaciones'} en revisión en este rango; sus horas son provisionales.{' '}
              <Link href="/dashboard/asistencia/revision" className="font-semibold underline">
                Revisarlas
              </Link>
            </p>
          )}
          {canDecide && toDecide > 0 && <p>Hay {toDecide} {toDecide === 1 ? 'turno' : 'turnos'} con horas extra por aprobar.</p>}
        </div>
      )}

      {rows && rows.length === 0 && <div className="rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-10 text-center text-gray-400">No hay turnos en este rango.</div>}

      {summary.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Resumen por persona</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#141414]/80">
            <table className="table-cards w-full text-sm">
              <thead className="border-b border-white/[0.07] text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-3">Persona</th>
                  <th className="p-3">Turnos</th>
                  <th className="p-3">Trabajado</th>
                  <th className="p-3">Tardanzas</th>
                  <th className="p-3">Salidas antes</th>
                  <th className="p-3">Extra calculada</th>
                  <th className="p-3">Extra aprobada</th>
                  <th className="p-3">Ausencias</th>
                  <th className="p-3">Sin salida</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.user.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="p-3">{s.user.name || s.user.email}</td>
                    <td className="p-3"><L>Turnos</L>{s.shifts}</td>
                    <td className="p-3"><L>Trabajado</L>{hm(s.workedMinutes)}{s.pendingReviews > 0 && <span className="text-orange-300"> *</span>}</td>
                    <td className="p-3"><L>Tardanzas</L>{s.lateCount > 0 ? `${s.lateCount} (${hm(s.lateMinutes)})` : '—'}</td>
                    <td className="p-3"><L>Salidas antes</L>{s.earlyLeaveCount > 0 ? `${s.earlyLeaveCount} (${hm(s.earlyLeaveMinutes)})` : '—'}</td>
                    <td className="p-3"><L>Extra calculada</L>{hm(s.overtimeMinutes)}</td>
                    <td className="p-3"><L>Extra aprobada</L>{hm(s.overtimeApprovedMinutes)}{s.overtimeToDecide > 0 && <span className="text-orange-300"> ({s.overtimeToDecide} por decidir)</span>}</td>
                    <td className="p-3"><L>Ausencias</L>{s.absences || '—'}</td>
                    <td className="p-3"><L>Sin salida</L>{s.missingExits || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary.some((s) => s.pendingReviews > 0) && <p className="text-xs text-gray-500">* Incluye horas de marcaciones en revisión.</p>}
        </section>
      )}

      {rows && rows.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Detalle por turno</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#141414]/80">
            <table className="table-cards w-full text-sm">
              <thead className="border-b border-white/[0.07] text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-3">Turno</th>
                  <th className="p-3">Persona</th>
                  <th className="p-3">Área</th>
                  <th className="p-3">Marcaciones</th>
                  <th className="p-3">Trabajado</th>
                  <th className="p-3">Tardanza</th>
                  <th className="p-3">Salida antes</th>
                  <th className="p-3">Horas extra</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const own = r.user.id === currentUserId
                  const decidable = canDecide && !own && ['to_approve', 'changed', 'approved', 'rejected'].includes(r.overtime.state)
                  return (
                    <tr key={`${r.shift.id}-${r.user.id}`} className="border-b border-white/[0.04] align-top last:border-0">
                      <td className="whitespace-nowrap p-3">
                        {describe(new Date(r.shift.startsAt))} – {bogotaTime(new Date(r.shift.endsAt))}
                      </td>
                      <td className="p-3">
                        {r.user.name || r.user.email}
                        {r.via.type === 'team' && <span className="block text-xs text-gray-500">Equipo {r.via.teamName}</span>}
                      </td>
                      <td className="p-3"><L>Área</L>{r.area.name}</td>
                      <td className="p-3"><Pairs row={r} /></td>
                      <td className="p-3"><L>Trabajado</L>{hm(r.workedMinutes)}</td>
                      <td className="p-3"><L>Tardanza</L>{r.lateMinutes > 0 ? <span className="text-orange-300">{hm(r.lateMinutes)}</span> : '—'}</td>
                      <td className="p-3"><L>Salida antes</L>{r.earlyLeaveMinutes > 0 ? <span className="text-orange-300">{hm(r.earlyLeaveMinutes)}</span> : '—'}</td>
                      <td className="p-3">
                        <L>Horas extra</L>
                        {r.overtimeMinutes > 0 ? (
                          <span className="inline-flex flex-col items-start gap-1">
                            <span>
                              {hm(r.overtimeMinutes)}{' '}
                              <span className={`text-xs ${OT_TONE[r.overtime.state] ?? ''}`}>
                                {OVERTIME_TEXT[r.overtime.state]}
                                {r.overtime.state === 'approved' && r.overtime.approvedMinutes < r.overtimeMinutes ? ` ${hm(r.overtime.approvedMinutes)}` : ''}
                              </span>
                            </span>
                            {decidable && (
                              <button type="button" onClick={() => openDecision(r)} className="text-xs font-semibold text-orange-400 hover:text-orange-300">
                                {['approved', 'rejected'].includes(r.overtime.state) ? 'Cambiar decisión' : 'Aprobar o rechazar'}
                              </button>
                            )}
                            {r.overtime.state === 'blocked_by_review' && (
                              <Link href="/dashboard/asistencia/revision" className="text-xs font-semibold text-orange-400 hover:text-orange-300">
                                Ir a revisión
                              </Link>
                            )}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[r.status]}`}>{STATUS_TEXT[r.status]}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal isOpen={!!target} onClose={() => setTarget(null)} title="Horas extra" size="sm">
        {target && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              {target.user.name || target.user.email} · {target.area.name} · {describe(new Date(target.shift.startsAt))} – {bogotaTime(new Date(target.shift.endsAt))}.
              <br />
              Trabajó <strong>{formatMinutes(target.overtimeMinutes)}</strong> después del fin del turno
              {target.lastOut ? ` (última salida ${bogotaTime(new Date(target.lastOut))})` : ''}.
            </p>
            <Input
              type="number"
              label="Minutos a aprobar"
              min={1}
              max={target.overtimeMinutes}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              helperText={`Hasta ${target.overtimeMinutes} min. Si apruebas menos, explica por qué en la nota.`}
            />
            <Textarea label="Nota" placeholder="Obligatoria al rechazar o al aprobar menos minutos" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setTarget(null)}>
                Cancelar
              </Button>
              <Button variant="outline" onClick={() => decide('REJECTED')} isLoading={busy} disabled={!note.trim()}>
                Rechazar
              </Button>
              <Button onClick={() => decide('APPROVED')} isLoading={busy}>
                Aprobar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
