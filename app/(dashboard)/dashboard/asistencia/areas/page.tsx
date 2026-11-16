'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock, FolderKanban, MapPinned, Plus, RefreshCw, Search, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { AreaMapLazy } from '@/components/attendance/AreaMapLazy'
import { Button } from '@/components/ui/Button'
import { describe } from '@/lib/attendance/shifts'
import { cn } from '@/lib/utils/cn'

type AreaRow = {
  id: string
  name: string
  description: string | null
  latitude: number
  longitude: number
  radiusMeters: number
  isActive: boolean
  project: { id: string; title: string } | null
  assignmentCount: number
  nextShift: { startsAt: string; endsAt: string } | null
}

export default function AttendanceAreasPage() {
  const router = useRouter()
  const [areas, setAreas] = useState<AreaRow[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [mapStyleUrl, setMapStyleUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/attendance/areas')
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Error al cargar las áreas')
      setAreas(body.areas)
      setCanEdit(body.canEdit)
      setMapStyleUrl(body.mapStyleUrl)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return areas.filter(
      (a) => (showInactive || a.isActive) && (!q || [a.name, a.description, a.project?.title].some((v) => v?.toLowerCase().includes(q)))
    )
  }, [areas, search, showInactive])

  const inactiveCount = areas.filter((a) => !a.isActive).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <MapPinned className="h-7 w-7 text-orange-400" />
            Áreas de asistencia
          </h1>
          <p className="mt-1 text-sm text-gray-400">Lugares donde los empleados pueden marcar entrada y salida desde la app, y a quién le corresponde cada uno.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} isLoading={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          {canEdit && (
            <Link href="/dashboard/asistencia/areas/nueva">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva área
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar área o proyecto"
                className="w-full rounded-lg border border-white/[0.07] bg-gray-900/50 py-2 pl-9 pr-3 text-sm text-gray-100 placeholder:text-gray-500"
              />
            </div>
            {inactiveCount > 0 && (
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-orange-500" />
                Ver inactivas ({inactiveCount})
              </label>
            )}
          </div>

          {!loading && visible.length === 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-10 text-center text-gray-400">
              {areas.length === 0 ? (canEdit ? 'Aún no hay áreas. Crea la primera con "Nueva área".' : 'Aún no hay áreas creadas.') : 'Ninguna área coincide con la búsqueda.'}
            </div>
          )}

          {visible.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard/asistencia/areas/${a.id}`}
              className={cn(
                'block rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-4 transition-colors hover:border-orange-500/40',
                !a.isActive && 'opacity-60'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.name}</p>
                  {a.description && <p className="truncate text-sm text-gray-400">{a.description}</p>}
                </div>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs', a.isActive ? 'bg-orange-500/10 text-orange-300' : 'bg-white/5 text-gray-400')}>
                  {a.isActive ? `${a.radiusMeters} m` : 'Inactiva'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {a.assignmentCount === 0 ? 'Sin asignar' : `${a.assignmentCount} ${a.assignmentCount === 1 ? 'asignación' : 'asignaciones'}`}
                </span>
                {a.nextShift && (
                  <span className="flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Próximo turno: {describe(new Date(a.nextShift.startsAt))}
                  </span>
                )}
                {a.project && (
                  <span className="flex items-center gap-1">
                    <FolderKanban className="h-3.5 w-3.5" />
                    {a.project.title}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          {mapStyleUrl && (
            <AreaMapLazy
              styleUrl={mapStyleUrl}
              circles={visible.map((a) => ({ id: a.id, latitude: a.latitude, longitude: a.longitude, radiusMeters: a.radiusMeters, muted: !a.isActive }))}
              onCircleClick={(id) => router.push(`/dashboard/asistencia/areas/${id}`)}
              fitKey={visible.length}
              className="h-[360px] w-full overflow-hidden rounded-2xl border border-white/[0.07] lg:h-[560px]"
            />
          )}
        </div>
      </div>
    </div>
  )
}
