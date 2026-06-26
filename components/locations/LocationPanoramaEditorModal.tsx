'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Crosshair, Save, X, Globe, Check, ImageOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useLocations } from '@/hooks/useLocations'
import { Location } from '@/lib/validations/location'

const PanoramaViewer = dynamic(() => import('./PanoramaViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[50vh] bg-gray-950">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

type PanoramaImage = { name: string; url: string }

interface LocationPanoramaEditorModalProps {
  isOpen: boolean
  onClose: () => void
  node: Location | null
  /** Ancestro con panorámica más cercano (host del marcador de este nodo). */
  host: Location | null
  onChanged: () => void
}

export function LocationPanoramaEditorModal({
  isOpen,
  onClose,
  node,
  host,
  onChanged,
}: LocationPanoramaEditorModalProps) {
  const { setPanorama, setMarker } = useLocations()
  const [images, setImages] = useState<PanoramaImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [savingUrl, setSavingUrl] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pending, setPending] = useState<{ yaw: number; pitch: number } | null>(null)

  // Cargar la galería de imágenes disponibles
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoadingImages(true)
    fetch('/api/locations/panoramas')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PanoramaImage[]) => {
        if (active) setImages(Array.isArray(data) ? data : [])
      })
      .catch(() => active && setImages([]))
      .finally(() => active && setLoadingImages(false))
    return () => {
      active = false
    }
  }, [isOpen])

  // Inicializar marcador pendiente con el existente (si está sobre el host actual)
  useEffect(() => {
    if (!isOpen || !node) {
      setPending(null)
      return
    }
    if (
      host &&
      node.markerOnLocationId === host.id &&
      node.markerYaw !== null &&
      node.markerPitch !== null
    ) {
      setPending({ yaw: node.markerYaw, pitch: node.markerPitch })
    } else {
      setPending(null)
    }
  }, [isOpen, node, host])

  if (!node) return null

  const handleSelectImage = async (url: string | null) => {
    setSavingUrl(url ?? '__clear__')
    try {
      const ok = await setPanorama(node.id, url)
      if (ok) onChanged()
    } finally {
      setSavingUrl(null)
    }
  }

  const handleSaveMarker = async () => {
    if (!host || !pending) return
    setIsSaving(true)
    try {
      const ok = await setMarker(node.id, {
        markerYaw: pending.yaw,
        markerPitch: pending.pitch,
        markerOnLocationId: host.id,
      })
      if (ok) {
        onChanged()
        onClose()
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveMarker = async () => {
    const ok = await setMarker(node.id, null)
    if (ok) {
      setPending(null)
      onChanged()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`360° — ${node.fullPath}`} size="xl">
      <div className="space-y-6">
        {/* Section A: elegir imagen 360 de la galería */}
        <div>
          <h3 className="text-sm font-semibold text-gray-200 mb-2 flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-400" />
            Imagen 360° de esta ubicación
            {node.panoramaUrl && (
              <button
                type="button"
                onClick={() => handleSelectImage(null)}
                className="ml-auto inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
              >
                <X className="w-3.5 h-3.5" /> Quitar
              </button>
            )}
          </h3>

          {loadingImages ? (
            <div className="flex items-center justify-center h-24">
              <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg bg-gray-800/50">
              <ImageOff className="w-8 h-8 text-gray-600 mb-2" />
              <p className="text-sm text-gray-300">No hay imágenes disponibles</p>
              <p className="text-xs text-gray-500">
                Agrega tus panorámicas 360° en <code>public/images/ubicaciones/</code>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img) => {
                const selected = node.panoramaUrl === img.url
                const saving = savingUrl === img.url
                return (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => handleSelectImage(img.url)}
                    disabled={!!savingUrl}
                    className={
                      'group relative aspect-video rounded-lg overflow-hidden border-2 transition-all ' +
                      (selected
                        ? 'border-sky-500 ring-2 ring-sky-500/40'
                        : 'border-gray-700 hover:border-gray-500')
                    }
                    title={img.name}
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                    {selected && (
                      <span className="absolute top-1 right-1 bg-sky-500 text-white rounded-full p-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {saving && (
                      <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </span>
                    )}
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-gray-200 px-1 py-0.5 truncate">
                      {img.name}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Section B: marcador */}
        <div>
          <h3 className="text-sm font-semibold text-gray-200 mb-2 flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-orange-400" />
            Marcar el punto exacto de esta ubicación
          </h3>

          {host ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Haz click sobre la imagen 360° de{' '}
                <span className="text-gray-200 font-medium">{host.fullPath}</span> para
                colocar el marcador de{' '}
                <span className="text-gray-200 font-medium">{node.fullPath}</span>.
              </p>
              <PanoramaViewer
                panoramaUrl={host.panoramaUrl!}
                onClick={(pos) => setPending(pos)}
                initialPosition={pending}
                markers={
                  pending
                    ? [{ id: 'pending', yaw: pending.yaw, pitch: pending.pitch, label: node.fullPath, highlight: true }]
                    : []
                }
                className="w-full h-[50vh] rounded-lg overflow-hidden bg-gray-950"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {pending
                    ? `Posición: yaw ${pending.yaw.toFixed(2)}, pitch ${pending.pitch.toFixed(2)}`
                    : 'Sin marcador colocado'}
                </span>
                <div className="flex gap-2">
                  {(node.markerOnLocationId || pending) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={handleRemoveMarker}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Quitar marcador
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveMarker}
                    isLoading={isSaving}
                    disabled={!pending}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Guardar marcador
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 rounded-lg bg-gray-800/50 p-3">
              Para colocar un marcador, primero asigna una imagen 360° a este nodo o a un
              sector/cuadrante superior.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
