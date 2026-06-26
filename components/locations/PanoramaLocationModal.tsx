'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, ImageOff } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useLocations } from '@/hooks/useLocations'
import { PanoramaContext } from '@/lib/validations/location'

const PanoramaViewer = dynamic(() => import('./PanoramaViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[60vh] bg-gray-950">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

interface PanoramaLocationModalProps {
  isOpen: boolean
  onClose: () => void
  locationId: string | null
  title?: string
}

export function PanoramaLocationModal({
  isOpen,
  onClose,
  locationId,
  title,
}: PanoramaLocationModalProps) {
  const { fetchPanoramaContext } = useLocations()
  const [context, setContext] = useState<PanoramaContext | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !locationId) {
      setContext(null)
      return
    }
    let active = true
    setLoading(true)
    fetchPanoramaContext(locationId).then((ctx) => {
      if (active) {
        setContext(ctx)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [isOpen, locationId, fetchPanoramaContext])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || 'Ubicación en 360°'}
      size="xl"
    >
      {loading ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : context?.panoramaUrl ? (
        <div className="space-y-3">
          {context.target && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <MapPin className="w-4 h-4 text-orange-400" />
              <span className="font-medium text-white">{context.target.label}</span>
              <span className="text-gray-500">— el marcador señala la posición exacta</span>
            </div>
          )}
          <PanoramaViewer
            panoramaUrl={context.panoramaUrl}
            markers={context.markers}
            initialPosition={context.target}
            className="w-full h-[60vh] rounded-lg overflow-hidden bg-gray-950"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[40vh] text-center">
          <ImageOff className="w-12 h-12 text-gray-600 mb-3" />
          <p className="text-gray-300 font-medium">Sin imagen 360 para esta ubicación</p>
          <p className="text-gray-500 text-sm">
            Sube una panorámica a esta ubicación (o a un sector superior) desde la ventana
            de Ubicaciones.
          </p>
        </div>
      )}
    </Modal>
  )
}
