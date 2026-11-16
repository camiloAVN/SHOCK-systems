'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MapPinned, Pencil, Plus, Trash2, User, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { AreaForm, type AreaFormValues } from '@/components/attendance/AreaForm'
import { AssignmentEditor, type EditableAssignment, type TeamOption, type UserOption } from '@/components/attendance/AssignmentEditor'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { bogotaTime, dateToBogotaInput, describe, shiftPhase, type ShiftPhase } from '@/lib/attendance/shifts'
import { cn } from '@/lib/utils/cn'

type Shift = { id: string; startsAt: string; endsAt: string }
type Assignment = EditableAssignment & {
  user: { id: string; name: string | null; email: string; cedula: string | null; isActive: boolean } | null
  team: { id: string; name: string; color: string | null; _count: { members: number } } | null
  shifts: Shift[]
}
type AreaDetail = {
  id: string
  name: string
  description: string | null
  latitude: number
  longitude: number
  radiusMeters: number
  isActive: boolean
  project: { id: string; title: string } | null
  createdBy: { name: string | null; email: string } | null
  createdAt: string
  assignments: Assignment[]
}
type Options = { users: UserOption[]; teams: TeamOption[]; projects: { id: string; title: string; client?: { name: string } | null }[] }

const PHASE: Record<ShiftPhase, { label: string; className: string }> = {
  open: { label: 'Ventana abierta', className: 'bg-green-500/10 text-green-300' },
  upcoming: { label: 'Próximo', className: 'bg-orange-500/10 text-orange-300' },
  expired: { label: 'Vencido', className: 'bg-white/5 text-gray-500' },
}

const MAX_SHIFTS_SHOWN = 6

function ShiftList({ shifts }: { shifts: Shift[] }) {
  const [all, setAll] = useState(false)
  const now = new Date()
  const items = shifts.map((s) => {
    const startsAt = new Date(s.startsAt)
    const endsAt = new Date(s.endsAt)
    return { ...s, startsAt, endsAt, phase: shiftPhase({ startsAt, endsAt }, now) }
  })
  // Primero lo vigente y lo próximo; los vencidos al final
  const ordered = [...items.filter((s) => s.phase !== 'expired'), ...items.filter((s) => s.phase === 'expired').reverse()]
  const shown = all ? ordered : ordered.slice(0, MAX_SHIFTS_SHOWN)
  const expired = items.filter((s) => s.phase === 'expired').length

  return (
    <div className="space-y-1">
      {shown.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className={cn('rounded-full px-2 py-0.5 text-[11px]', PHASE[s.phase].className)}>{PHASE[s.phase].label}</span>
          <span className={s.phase === 'expired' ? 'text-gray-500' : 'text-gray-300'}>
            {describe(s.startsAt)} – {bogotaTime(s.endsAt)}
            {dateToBogotaInput(s.endsAt).slice(0, 10) !== dateToBogotaInput(s.startsAt).slice(0, 10) && ' (día siguiente)'}
          </span>
        </div>
      ))}
      {ordered.length > MAX_SHIFTS_SHOWN && (
        <button type="button" onClick={() => setAll(!all)} className="text-xs text-orange-300 hover:underline">
          {all ? 'Ver menos' : `Ver los ${ordered.length} turnos`}
        </button>
      )}
      {expired > 0 && expired === items.length && <p className="text-xs text-gray-500">Todos los turnos ya vencieron: la persona ya no ve esta área en la app.</p>}
    </div>
  )
}

export default function AttendanceAreaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [area, setArea] = useState<AreaDetail | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [mapStyleUrl, setMapStyleUrl] = useState('')
  const [options, setOptions] = useState<Options | null>(null)
  const [editing, setEditing] = useState<{ assignment: EditableAssignment | null } | null>(null)
  const [deleting, setDeleting] = useState<'area' | Assignment | null>(null)
  const [busy, setBusy] = useState(false)
  const [formKey, setFormKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/attendance/areas/${id}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Error al cargar el área')
      setArea(body.area)
      setCanEdit(body.canEdit)
      setMapStyleUrl(body.mapStyleUrl)
      if (body.canEdit && !options) {
        const opt = await fetch('/api/attendance/options')
        if (opt.ok) setOptions(await opt.json())
      }
    } catch (e: any) {
      toast.error(e.message)
      router.replace('/dashboard/asistencia/areas')
    }
  }, [id, options, router])

  useEffect(() => {
    void load()
    // Solo al entrar o cambiar de área
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const save = async (values: AreaFormValues) => {
    try {
      const response = await fetch(`/api/attendance/areas/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Error al guardar')
      toast.success('Área guardada')
      await load()
      setFormKey((k) => k + 1)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      const url = deleting === 'area' ? `/api/attendance/areas/${id}` : `/api/attendance/assignments/${deleting.id}`
      const response = await fetch(url, { method: 'DELETE' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Error al eliminar')
      if (deleting === 'area') {
        toast.success('Área eliminada')
        router.replace('/dashboard/asistencia/areas')
        return
      }
      toast.success('Asignación eliminada')
      setDeleting(null)
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!area) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/dashboard/asistencia/areas" className="mb-2 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
            <ArrowLeft className="h-4 w-4" /> Áreas
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <MapPinned className="h-7 w-7 text-orange-400" />
            {area.name}
            {!area.isActive && <span className="rounded-full bg-white/5 px-2 py-0.5 text-sm font-normal text-gray-400">Inactiva</span>}
          </h1>
          {area.createdBy && <p className="mt-1 text-xs text-gray-500">Creada por {area.createdBy.name || area.createdBy.email}</p>}
        </div>
        {canEdit && (
          <Button variant="danger" onClick={() => setDeleting('area')}>
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar área
          </Button>
        )}
      </div>

      <section className="rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-4 sm:p-6">
        <AreaForm
          key={formKey}
          initial={area}
          projects={options?.projects ?? []}
          mapStyleUrl={mapStyleUrl}
          readOnly={!canEdit}
          submitLabel="Guardar cambios"
          onSubmit={save}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Asignaciones</h2>
            <p className="text-sm text-gray-400">Quién puede marcar en esta área y en qué horarios.</p>
          </div>
          {canEdit && options && (
            <Button onClick={() => setEditing({ assignment: null })}>
              <Plus className="mr-2 h-4 w-4" />
              Asignar
            </Button>
          )}
        </div>

        {area.assignments.length === 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-8 text-center text-gray-400">
            Nadie tiene asignada esta área todavía{canEdit ? '. Usa "Asignar" para elegir una persona o un equipo y sus turnos.' : '.'}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {area.assignments.map((a) => (
            <div key={a.id} className="rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {a.user ? (
                    <>
                      <p className="flex items-center gap-2 font-semibold">
                        <User className="h-4 w-4 text-orange-400" />
                        <span className="truncate">{a.user.name || a.user.email}</span>
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {a.user.email}
                        {a.user.cedula && ` · ${a.user.cedula}`}
                      </p>
                      {!a.user.isActive && <p className="text-xs text-red-400">Usuario desactivado</p>}
                    </>
                  ) : (
                    <>
                      <p className="flex items-center gap-2 font-semibold">
                        <Users className="h-4 w-4 text-orange-400" />
                        <span className="truncate">Equipo {a.team?.name}</span>
                      </p>
                      <p className="text-xs text-gray-500">{a.team?._count.members ?? 0} integrantes</p>
                    </>
                  )}
                </div>
                {canEdit && options && (
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => setEditing({ assignment: a })} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-gray-200" aria-label="Editar asignación">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setDeleting(a)} className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400" aria-label="Eliminar asignación">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {a.notes && <p className="mt-2 text-sm text-gray-400">{a.notes}</p>}
              <div className="mt-3">
                <ShiftList shifts={a.shifts} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {options && (
        <AssignmentEditor
          isOpen={!!editing}
          onClose={() => setEditing(null)}
          areaId={area.id}
          areaName={area.name}
          assignment={editing?.assignment ?? null}
          users={options.users}
          teams={options.teams}
          onSaved={load}
        />
      )}

      <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} title={deleting === 'area' ? 'Eliminar área' : 'Eliminar asignación'} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            {deleting === 'area'
              ? `Se eliminará "${area.name}" con sus ${area.assignments.length} asignaciones y todos sus turnos. Si solo quieres que deje de aparecer en la app, desmárcala como activa.`
              : deleting
                ? `${deleting.user ? deleting.user.name || deleting.user.email : `El equipo ${deleting.team?.name}`} dejará de ver esta área en la app. Se eliminan sus ${deleting.shifts.length} turnos.`
                : ''}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete} isLoading={busy}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
