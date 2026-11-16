'use client'

import { useState } from 'react'
import { Crosshair, MapPin, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { parseCoordinates, type LatLng } from '@/lib/attendance/geo'
import { cn } from '@/lib/utils/cn'
import { AreaMapLazy } from './AreaMapLazy'

export type AreaFormValues = {
  name: string
  description: string | null
  latitude: number | null
  longitude: number | null
  radiusMeters: number
  isActive: boolean
  projectId: string | null
}

type ProjectOption = { id: string; title: string; client?: { name: string } | null }

type Props = {
  initial?: Partial<AreaFormValues> & { project?: { id: string; title: string } | null }
  projects: ProjectOption[]
  mapStyleUrl: string
  readOnly?: boolean
  submitLabel: string
  onSubmit: (values: AreaFormValues) => Promise<void>
}

const { minAreaRadiusMeters, maxAreaRadiusMeters } = ATTENDANCE_CONFIG.geo
const RADIUS_PRESETS = [30, 50, 100, 200, 500]

const fmtCoord = (c: LatLng) => `${c.latitude.toFixed(6)}, ${c.longitude.toFixed(6)}`

export function AreaForm({ initial, projects, mapStyleUrl, readOnly, submitLabel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [center, setCenter] = useState<LatLng | null>(
    initial?.latitude != null && initial?.longitude != null ? { latitude: initial.latitude, longitude: initial.longitude } : null
  )
  const [radius, setRadius] = useState(initial?.radiusMeters ?? 50)
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [projectId, setProjectId] = useState(initial?.projectId ?? initial?.project?.id ?? '')
  const [coordText, setCoordText] = useState(center ? fmtCoord(center) : '')
  const [fitKey, setFitKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)

  const moveCenter = (c: LatLng, refit = false) => {
    setCenter(c)
    setCoordText(fmtCoord(c))
    if (refit) setFitKey((k) => k + 1)
  }

  const applyCoordText = () => {
    const c = parseCoordinates(coordText)
    if (!c) {
      toast.error('No se reconocen las coordenadas. Ejemplo: 4.6097, -74.0817')
      return
    }
    moveCenter(c, true)
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Este navegador no permite obtener la ubicación')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        moveCenter({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }, true)
        toast.success(`Ubicación obtenida (precisión ±${Math.round(pos.coords.accuracy)} m)`)
      },
      (err) => {
        setLocating(false)
        toast.error(err.code === err.PERMISSION_DENIED ? 'Permiso de ubicación denegado en el navegador' : 'No se pudo obtener la ubicación')
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!center) {
      toast.error('Ubica el centro del área: haz clic en el mapa, pega coordenadas o usa tu ubicación')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        latitude: center.latitude,
        longitude: center.longitude,
        radiusMeters: radius,
        isActive,
        projectId: projectId || null,
      })
    } finally {
      setSaving(false)
    }
  }

  // El proyecto actual puede no estar en la lista (p. ej. ya terminado): se agrega para no perderlo
  const projectOptions = [
    { value: '', label: 'Sin proyecto' },
    ...(initial?.project && !projects.some((p) => p.id === initial.project!.id) ? [{ value: initial.project.id, label: initial.project.title }] : []),
    ...projects.map((p) => ({ value: p.id, label: p.client?.name ? `${p.title} — ${p.client.name}` : p.title })),
  ]

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="space-y-4">
        <Input label="Nombre *" placeholder="Ej.: Bodega principal, Coliseo Movistar Arena" value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} maxLength={100} required />
        <Textarea
          label="Dirección o indicaciones"
          placeholder="Ej.: Calle 80 # 69-70, entrada por la puerta 3"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={readOnly}
          maxLength={500}
          rows={2}
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-300">Radio del área: {radius} m</label>
          <input
            type="range"
            min={minAreaRadiusMeters}
            max={1000}
            step={5}
            value={Math.min(radius, 1000)}
            onChange={(e) => setRadius(Number(e.target.value))}
            disabled={readOnly}
            className="w-full accent-orange-500"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {RADIUS_PRESETS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={readOnly}
                onClick={() => setRadius(r)}
                className={cn(
                  'rounded-lg border px-3 py-1 text-xs',
                  radius === r ? 'border-orange-500/50 bg-orange-500/10 text-orange-300' : 'border-white/[0.07] text-gray-400 hover:text-gray-200'
                )}
              >
                {r} m
              </button>
            ))}
            <input
              type="number"
              min={minAreaRadiusMeters}
              max={maxAreaRadiusMeters}
              value={radius}
              onChange={(e) => setRadius(Math.round(Number(e.target.value) || 0))}
              disabled={readOnly}
              className="w-24 rounded-lg border border-white/[0.07] bg-gray-900/50 px-2 py-1 text-sm text-gray-100"
              aria-label="Radio en metros"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Mínimo {minAreaRadiusMeters} m: el GPS de un teléfono suele tener un error de 10 a 30 m. Para un edificio grande, cubre todo el lugar donde trabajará la persona.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-300">Centro del área</label>
          <div className="flex gap-2">
            <Input
              placeholder="Pega coordenadas: 4.6097, -74.0817"
              value={coordText}
              onChange={(e) => setCoordText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyCoordText()
                }
              }}
              disabled={readOnly}
              leftIcon={<MapPin className="h-4 w-4" />}
            />
            {!readOnly && (
              <Button type="button" variant="outline" onClick={applyCoordText}>
                Ir
              </Button>
            )}
          </div>
          {!readOnly && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={useMyLocation} isLoading={locating}>
                <Crosshair className="mr-1 h-4 w-4" />
                Usar mi ubicación
              </Button>
              <span className="text-xs text-gray-500">o haz clic en el mapa / arrastra el marcador</span>
            </div>
          )}
        </div>

        <Select label="Proyecto (opcional)" options={projectOptions} value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={readOnly} />

        <label className="flex items-center gap-3 text-sm text-gray-300">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={readOnly} className="h-4 w-4 accent-orange-500" />
          Área activa (si se desactiva, desaparece de la app de los empleados)
        </label>

        {!readOnly && (
          <Button type="submit" isLoading={saving} className="w-full sm:w-auto">
            <Save className="mr-2 h-4 w-4" />
            {submitLabel}
          </Button>
        )}
      </div>

      <AreaMapLazy
        styleUrl={mapStyleUrl}
        circles={[]}
        fitKey={fitKey}
        editor={{ center, radiusMeters: radius, onCenterChange: (c) => moveCenter(c), readOnly }}
        className="h-[360px] w-full overflow-hidden rounded-2xl border border-white/[0.07] lg:h-full lg:min-h-[480px]"
      />
    </form>
  )
}
