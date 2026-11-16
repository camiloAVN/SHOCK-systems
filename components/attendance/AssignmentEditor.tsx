'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Moon, Plus, Search, Trash2, User, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { bogotaInputToDate, dateToBogotaInput, describe, expandDailyShifts, validateShifts, type ShiftTimes } from '@/lib/attendance/shifts'
import { cn } from '@/lib/utils/cn'

export type UserOption = { id: string; name: string | null; email: string; cedula: string | null; position: string | null }
export type TeamOption = { id: string; name: string; color: string | null; _count: { members: number } }

export type EditableAssignment = {
  id: string
  userId: string | null
  teamId: string | null
  notes: string | null
  shifts: { id: string; startsAt: string; endsAt: string }[]
}

/** Fila del editor: fecha + horas en hora de Bogotá. `id` = turno existente que se conserva. */
type Row = { key: string; id?: string; date: string; start: string; end: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  areaId: string
  areaName: string
  assignment: EditableAssignment | null
  users: UserOption[]
  teams: TeamOption[]
  onSaved: () => void
}

const FIELD = 'w-full min-w-0 rounded-lg border border-white/[0.07] bg-gray-900/50 px-2 py-1.5 text-sm text-gray-100'

const HOURS_BEFORE = ATTENDANCE_CONFIG.shifts.markBeforeStartMs / 3_600_000
const HOURS_AFTER = ATTENDANCE_CONFIG.shifts.markAfterEndMs / 3_600_000

let rowSeq = 0
const newKey = () => `r${++rowSeq}`

/** Fila → instantes. Si la hora de fin no es mayor que la de inicio, termina al día siguiente. */
function rowToShift(r: Row): ShiftTimes | null {
  const startsAt = bogotaInputToDate(`${r.date}T${r.start}`)
  let endsAt = bogotaInputToDate(`${r.date}T${r.end}`)
  if (!startsAt || !endsAt) return null
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 3_600_000)
  return { startsAt, endsAt }
}

const crossesMidnight = (r: Row) => !!r.start && !!r.end && r.end <= r.start

function shiftToRow(s: { id?: string; startsAt: Date; endsAt: Date }): Row {
  const [date, start] = dateToBogotaInput(s.startsAt).split('T')
  const end = dateToBogotaInput(s.endsAt).split('T')[1]
  return { key: newKey(), id: s.id, date, start, end }
}

/** Mañana en Bogotá, "YYYY-MM-DD" */
function tomorrowBogota(): string {
  return dateToBogotaInput(new Date(Date.now() + 24 * 3_600_000)).split('T')[0]
}

function addDays(date: string, days: number): string {
  const d = bogotaInputToDate(`${date}T12:00`)
  return d ? dateToBogotaInput(new Date(d.getTime() + days * 24 * 3_600_000)).split('T')[0] : date
}

export function AssignmentEditor({ isOpen, onClose, areaId, areaName, assignment, users, teams, onSaved }: Props) {
  const [target, setTarget] = useState<'user' | 'team'>('user')
  const [userId, setUserId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [range, setRange] = useState({ from: tomorrowBogota(), to: tomorrowBogota(), start: '08:00', end: '17:00' })
  const [saving, setSaving] = useState(false)

  // Cargar los datos al abrir
  useEffect(() => {
    if (!isOpen) return
    setSearch('')
    if (assignment) {
      setTarget(assignment.teamId ? 'team' : 'user')
      setUserId(assignment.userId ?? '')
      setTeamId(assignment.teamId ?? '')
      setNotes(assignment.notes ?? '')
      setRows(assignment.shifts.map((s) => shiftToRow({ id: s.id, startsAt: new Date(s.startsAt), endsAt: new Date(s.endsAt) })))
    } else {
      setTarget('user')
      setUserId('')
      setTeamId('')
      setNotes('')
      setRows([{ key: newKey(), date: tomorrowBogota(), start: '08:00', end: '17:00' }])
    }
  }, [isOpen, assignment])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? users.filter((u) => [u.name, u.email, u.cedula, u.position].some((v) => v?.toLowerCase().includes(q)))
      : users
    // La persona elegida siempre visible aunque no coincida con la búsqueda
    const chosen = users.find((u) => u.id === userId)
    return chosen && !list.includes(chosen) ? [chosen, ...list] : list
  }, [users, search, userId])

  const shifts = rows.map(rowToShift)
  const problem = shifts.some((s) => !s) ? 'Completa la fecha y las horas de todos los turnos' : validateShifts(shifts as ShiftTimes[])

  const updateRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const addRow = () =>
    setRows((rs) => {
      const last = rs[rs.length - 1]
      return [...rs, last ? { key: newKey(), date: addDays(last.date, 1), start: last.start, end: last.end } : { key: newKey(), date: tomorrowBogota(), start: '08:00', end: '17:00' }]
    })

  const addRange = () => {
    const generated = expandDailyShifts(range.from, range.to, range.start, range.end)
    if (!generated) {
      toast.error('Revisa el rango: la fecha final no puede ser anterior a la inicial')
      return
    }
    setRows((rs) => [...rs, ...generated.map((s) => shiftToRow(s))].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)))
    toast.success(`${generated.length} turnos agregados`)
  }

  const save = async () => {
    if (problem) {
      toast.error(problem)
      return
    }
    if (target === 'user' ? !userId : !teamId) {
      toast.error(target === 'user' ? 'Elige la persona' : 'Elige el equipo')
      return
    }
    setSaving(true)
    try {
      const body = {
        userId: target === 'user' ? userId : null,
        teamId: target === 'team' ? teamId : null,
        notes: notes.trim() || null,
        shifts: rows.map((r, i) => ({ id: r.id, startsAt: shifts[i]!.startsAt.toISOString(), endsAt: shifts[i]!.endsAt.toISOString() })),
      }
      const response = await fetch(assignment ? `/api/attendance/assignments/${assignment.id}` : `/api/attendance/areas/${areaId}/assignments`, {
        method: assignment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Error al guardar')
      toast.success(assignment ? 'Asignación actualizada' : 'Asignación creada')
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const tabClass = (active: boolean) =>
    cn('flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm', active ? 'border-orange-500/50 bg-orange-500/10 text-orange-300' : 'border-white/[0.07] text-gray-400 hover:text-gray-200')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${assignment ? 'Editar asignación' : 'Asignar'} · ${areaName}`} size="lg">
      <div className="space-y-4 sm:space-y-5">
        {/* Destino */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <button type="button" className={tabClass(target === 'user')} onClick={() => setTarget('user')}>
              <User className="h-4 w-4" /> Una persona
            </button>
            <button type="button" className={tabClass(target === 'team')} onClick={() => setTarget('team')}>
              <Users className="h-4 w-4" /> Un equipo
            </button>
          </div>

          {target === 'user' ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, correo, cédula o cargo"
                  className="w-full rounded-lg border border-white/[0.07] bg-gray-900/50 py-2 pl-9 pr-3 text-sm text-gray-100 placeholder:text-gray-500"
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-white/[0.07] sm:max-h-48">
                {filteredUsers.length === 0 && <p className="p-3 text-sm text-gray-500">Sin resultados</p>}
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUserId(u.id)}
                    className={cn('flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-white/[0.04]', userId === u.id && 'bg-orange-500/10')}
                  >
                    <span className={cn('font-medium', userId === u.id ? 'text-orange-300' : 'text-gray-200')}>{u.name || u.email}</span>
                    <span className="text-xs text-gray-500">
                      {u.email}
                      {u.cedula && ` · ${u.cedula}`}
                      {u.position && ` · ${u.position}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-white/[0.07] sm:max-h-48">
              {teams.length === 0 && <p className="p-3 text-sm text-gray-500">No hay equipos creados. Se crean en "Equipo".</p>}
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTeamId(t.id)}
                  className={cn('flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/[0.04]', teamId === t.id && 'bg-orange-500/10')}
                >
                  <span className={cn('font-medium', teamId === t.id ? 'text-orange-300' : 'text-gray-200')}>{t.name}</span>
                  <span className="text-xs text-gray-500">{t._count.members} integrantes</span>
                </button>
              ))}
            </div>
          )}
          {target === 'team' && <p className="text-xs text-gray-500">Verán el área quienes pertenezcan al equipo en el momento de marcar.</p>}
        </div>

        {/* Turnos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-300">Turnos (hora de Colombia)</p>
            <Button type="button" size="sm" variant="outline" onClick={addRow}>
              <Plus className="mr-1 h-4 w-4" /> Turno
            </Button>
          </div>

          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.key} className="rounded-xl border border-white/[0.07] bg-black/20 p-2">
                <div className="flex items-center gap-2">
                  {/* En celular: fecha arriba y horas debajo; en pantalla grande, todo en una línea */}
                  <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:flex-wrap">
                    <input type="date" value={r.date} onChange={(e) => updateRow(r.key, { date: e.target.value })} className={cn(FIELD, 'col-span-3 sm:w-auto')} aria-label="Fecha del turno" />
                    <input type="time" value={r.start} onChange={(e) => updateRow(r.key, { start: e.target.value })} className={cn(FIELD, 'sm:w-auto')} aria-label="Hora de inicio" />
                    <span className="text-center text-gray-500">a</span>
                    <input type="time" value={r.end} onChange={(e) => updateRow(r.key, { end: e.target.value })} className={cn(FIELD, 'sm:w-auto')} aria-label="Hora de fin" />
                  </div>
                  <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="shrink-0 self-start rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400 sm:self-center" aria-label="Quitar turno">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {crossesMidnight(r) && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-orange-300">
                    <Moon className="h-3.5 w-3.5" /> termina al día siguiente
                  </p>
                )}
              </div>
            ))}
            {rows.length === 0 && <p className="text-sm text-gray-500">Sin turnos. Agrega al menos uno.</p>}
          </div>

          {/* Varios días */}
          <div className="rounded-xl border border-dashed border-white/10 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm text-gray-300">
              <CalendarPlus className="h-4 w-4 text-orange-400" /> Varios días seguidos con el mismo horario
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap sm:items-end">
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Desde</span>
                <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value, to: e.target.value > range.to ? e.target.value : range.to })} className={FIELD} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Hasta</span>
                <input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} className={FIELD} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Entrada</span>
                <input type="time" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} className={FIELD} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Salida</span>
                <input type="time" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} className={FIELD} />
              </label>
              <Button type="button" size="sm" variant="outline" onClick={addRange} className="col-span-2 sm:col-span-1">
                Agregar días
              </Button>
            </div>
          </div>

          {problem && rows.length > 0 && <p className="text-sm text-red-400">{problem}</p>}
          {!problem && rows.length > 0 && (
            <p className="text-xs text-gray-500">
              {rows.length} {rows.length === 1 ? 'turno' : 'turnos'}: del {describe(shifts[0]!.startsAt)} al {describe((shifts as ShiftTimes[]).reduce((a, b) => (b.endsAt > a.endsAt ? b : a)).endsAt)}. Se podrá marcar desde {HOURS_BEFORE} h antes de cada inicio hasta {HOURS_AFTER} h después de cada fin.
            </p>
          )}
        </div>

        <Textarea label="Notas (opcional)" placeholder="Ej.: montaje del escenario; llevar dotación" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} />

        {/* Botones siempre visibles al fondo del modal, aunque haya muchos turnos */}
        <div className="sticky bottom-0 -mx-4 -mb-4 flex gap-2 border-t border-gray-800 bg-gray-900 px-4 py-3 sm:-mx-6 sm:-mb-6 sm:justify-end sm:px-6">
          <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button onClick={save} isLoading={saving} disabled={!!problem && rows.length > 0} className="flex-1 sm:flex-none">
            {assignment ? 'Guardar cambios' : 'Asignar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
