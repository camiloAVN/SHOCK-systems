'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PanoramaLocationModal } from './PanoramaLocationModal'

type MiniItem = {
  id: string
  serialNumber: string | null
  assetTag: string | null
  locationId: string | null
  location: string | null
}

interface ProductPanoramaButtonProps {
  productId: string
  productName?: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  iconOnly?: boolean
}

export function ProductPanoramaButton({
  productId,
  productName,
  variant = 'ghost',
  size = 'sm',
  className,
  iconOnly = false,
}: ProductPanoramaButtonProps) {
  const [loading, setLoading] = useState(false)
  const [located, setLocated] = useState<MiniItem[] | null>(null)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [viewLocationId, setViewLocationId] = useState<string | null>(null)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    try {
      let items = located
      if (!items) {
        const res = await fetch(`/api/inventory?productId=${productId}`)
        if (!res.ok) throw new Error('No se pudieron cargar los items')
        const data: MiniItem[] = await res.json()
        items = data.filter((i) => i.locationId)
        setLocated(items)
      }

      if (items.length === 0) {
        toast.error('Este producto no tiene items con ubicación asignada')
      } else if (items.length === 1) {
        setViewLocationId(items[0].locationId)
      } else {
        setChooserOpen(true)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        isLoading={loading}
        title="Ver ubicación en 360°"
      >
        <MapPin className={iconOnly ? 'w-4 h-4' : 'w-4 h-4 mr-2'} />
        {!iconOnly && '360°'}
      </Button>

      {/* Selector cuando hay varios items ubicados */}
      <Modal
        isOpen={chooserOpen}
        onClose={() => setChooserOpen(false)}
        title="Elige el item a localizar"
        size="md"
      >
        <div className="space-y-2">
          {(located ?? []).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setViewLocationId(item.locationId)
                setChooserOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-800/60 hover:bg-gray-800 border border-gray-700 text-left transition-colors"
            >
              <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-100">
                  {item.serialNumber || item.assetTag || item.id.slice(-8)}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {item.location || 'Ubicación asignada'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      <PanoramaLocationModal
        isOpen={!!viewLocationId}
        onClose={() => setViewLocationId(null)}
        locationId={viewLocationId}
        title={productName ? `Ubicación 360° — ${productName}` : 'Ubicación en 360°'}
      />
    </>
  )
}
