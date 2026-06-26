'use client'

import { useState } from 'react'
import Link from 'next/link'
import { InventoryItem } from '@/lib/validations/inventory'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { ProductThumbnail } from '@/components/ui/ProductThumbnail'
import { PanoramaLocationModal } from '@/components/locations/PanoramaLocationModal'
import { Eye, Edit, Trash2, ArrowDownToLine, ArrowUpFromLine, Tags, MapPin } from 'lucide-react'

interface InventoryItemsTableProps {
  items: InventoryItem[]
  onDelete: (id: string) => void
  onCheckIn?: (id: string) => void
  onCheckOut?: (id: string) => void
}

const statusConfig = {
  IN: { label: 'En Bodega', className: 'bg-green-500/10 text-green-400' },
  OUT: { label: 'Afuera', className: 'bg-blue-500/10 text-blue-400' },
  MAINTENANCE: { label: 'Mantenimiento', className: 'bg-amber-500/10 text-amber-400' },
  LOST: { label: 'Perdido', className: 'bg-red-500/10 text-red-400' },
}

const typeConfig = {
  UNIT: { label: 'Unidad', className: 'bg-orange-500/10 text-orange-400' },
  CONTAINER: { label: 'Contenedor', className: 'bg-cyan-500/10 text-cyan-400' },
  BULK: { label: 'Bulk', className: 'bg-gray-500/10 text-gray-400' },
}

export function InventoryItemsTable({ items, onDelete, onCheckIn, onCheckOut }: InventoryItemsTableProps) {
  const [view360LocationId, setView360LocationId] = useState<string | null>(null)

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Tags className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No hay items de inventario</p>
        <p className="text-sm text-gray-500 mt-2">
          Agrega tu primer item para comenzar
        </p>
      </div>
    )
  }

  const actions = (item: InventoryItem) => (
    <>
      {item.status !== 'IN' && onCheckIn && (
        <Button
          variant="ghost"
          size="sm"
          className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
          onClick={() => onCheckIn(item.id)}
          title="Check In"
        >
          <ArrowDownToLine className="w-4 h-4" />
        </Button>
      )}
      {item.status === 'IN' && onCheckOut && (
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
          onClick={() => onCheckOut(item.id)}
          title="Check Out"
        >
          <ArrowUpFromLine className="w-4 h-4" />
        </Button>
      )}
      {item.locationId && (
        <Button
          variant="ghost"
          size="sm"
          className="text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
          onClick={() => setView360LocationId(item.locationId)}
          title="Ver ubicación en 360°"
        >
          <MapPin className="w-4 h-4" />
        </Button>
      )}
      <Link href={`/dashboard/inventario/items/${item.id}`}>
        <Button variant="ghost" size="sm" title="Ver detalles">
          <Eye className="w-4 h-4" />
        </Button>
      </Link>
      <Link href={`/dashboard/inventario/items/${item.id}/editar`}>
        <Button variant="ghost" size="sm" title="Editar">
          <Edit className="w-4 h-4" />
        </Button>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        onClick={() => {
          if (confirm('¿Estás seguro de que deseas eliminar este item?')) {
            onDelete(item.id)
          }
        }}
        title="Eliminar"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </>
  )

  return (
    <>
      {/* Mobile: tarjetas */}
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <div className="flex items-start gap-3">
              <ProductThumbnail
                imageUrl={item.product?.imageUrl}
                productName={item.product?.name || 'Producto'}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-100 truncate">{item.product?.name || 'N/A'}</p>
                <p className="font-mono text-xs text-gray-500 truncate">
                  {item.serialNumber || item.id.slice(-8)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[item.status].className}`}>
                    {statusConfig[item.status].label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig[item.type].className}`}>
                    {typeConfig[item.type].label}
                  </span>
                  {item.rfidTag && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                      RFID
                    </span>
                  )}
                </div>
              </div>
            </div>
            {item.location && (
              <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-gray-500" /> {item.location}
              </p>
            )}
            <div className="mt-3 flex items-center justify-end gap-1 border-t border-gray-800 pt-2">
              {actions(item)}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden md:block overflow-x-auto">
      <Table>
        <thead>
          <tr>
            <th>ID / Serie</th>
            <th>Producto</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Ubicación</th>
            <th>RFID</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <span className="font-mono text-sm font-medium">
                  {item.serialNumber || item.id.slice(-8)}
                </span>
              </td>
              <td>
                <div className="flex items-center gap-3">
                  <ProductThumbnail
                    imageUrl={item.product?.imageUrl}
                    productName={item.product?.name || 'Producto'}
                    size="sm"
                  />
                  <div>
                    <span className="font-medium">{item.product?.name || 'N/A'}</span>
                    {item.product?.brand && (
                      <p className="text-xs text-gray-500">
                        {[item.product.brand, item.product.model].filter(Boolean).join(' ')}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeConfig[item.type].className}`}>
                  {typeConfig[item.type].label}
                </span>
              </td>
              <td>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig[item.status].className}`}>
                  {statusConfig[item.status].label}
                </span>
              </td>
              <td className="text-gray-400">{item.location || '-'}</td>
              <td>
                {item.rfidTag ? (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                    Vinculado
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
                    Sin Tag
                  </span>
                )}
              </td>
              <td>
                <div className="flex items-center gap-1">{actions(item)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      </div>

      <PanoramaLocationModal
        isOpen={!!view360LocationId}
        onClose={() => setView360LocationId(null)}
        locationId={view360LocationId}
      />
    </>
  )
}
