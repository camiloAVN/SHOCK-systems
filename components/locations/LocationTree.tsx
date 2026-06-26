'use client'

import { useState } from 'react'
import {
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Boxes,
  MapPin,
  Globe,
  Eye,
  Pin,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  LocationNode,
  LocationType,
  locationTypeLabels,
  allowedChildTypes,
} from '@/lib/validations/location'

// Colores por tipo para el badge
const typeStyles: Record<LocationType, string> = {
  SECTOR: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CUADRANTE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  RACK: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  NIVEL: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  POSICION: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
}

interface LocationTreeCallbacks {
  onAddChild: (parent: LocationNode) => void
  onEdit: (node: LocationNode) => void
  onDelete: (node: LocationNode) => void
  onManage360: (node: LocationNode) => void
  onView360: (node: LocationNode) => void
}

interface LocationTreeProps extends LocationTreeCallbacks {
  nodes: LocationNode[]
  depth?: number
  /** Algún ancestro tiene panorámica (para habilitar "Ver 360" heredado). */
  ancestorHasPanorama?: boolean
}

export function LocationTree({
  nodes,
  depth = 0,
  ancestorHasPanorama = false,
  ...callbacks
}: LocationTreeProps) {
  return (
    <ul className={cn(depth > 0 && 'border-l border-gray-800 ml-4')}>
      {nodes.map((node) => (
        <LocationTreeRow
          key={node.id}
          node={node}
          depth={depth}
          ancestorHasPanorama={ancestorHasPanorama}
          {...callbacks}
        />
      ))}
    </ul>
  )
}

function LocationTreeRow({
  node,
  depth,
  ancestorHasPanorama,
  ...callbacks
}: { node: LocationNode; depth: number; ancestorHasPanorama: boolean } & LocationTreeCallbacks) {
  const { onAddChild, onEdit, onDelete, onManage360, onView360 } = callbacks
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = node.children.length > 0
  const canHaveChildren = allowedChildTypes(node.type).length > 0
  const itemCount = node._count?.items ?? 0

  const hasOwnPano = !!node.panoramaUrl
  const hasMarker = node.markerYaw !== null && node.markerPitch !== null
  const canView360 = hasOwnPano || ancestorHasPanorama || hasMarker

  return (
    <li className="py-0.5">
      <div className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-gray-900/60 transition-colors">
        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'p-0.5 rounded text-gray-500 hover:text-gray-300 transition-transform',
            !hasChildren && 'invisible',
            expanded && 'rotate-90'
          )}
          aria-label={expanded ? 'Colapsar' : 'Expandir'}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Type badge */}
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium shrink-0',
            typeStyles[node.type]
          )}
        >
          {locationTypeLabels[node.type]}
        </span>

        {/* Code */}
        <span className="font-semibold text-gray-100 shrink-0">{node.code}</span>

        {/* 360 / marker indicators */}
        {hasOwnPano && (
          <span title="Tiene imagen 360" className="text-sky-400 shrink-0">
            <Globe className="w-3.5 h-3.5" />
          </span>
        )}
        {hasMarker && (
          <span title="Marcador colocado" className="text-orange-400 shrink-0">
            <Pin className="w-3.5 h-3.5" />
          </span>
        )}

        {/* Description */}
        {node.description && (
          <span className="text-sm text-gray-400 truncate">— {node.description}</span>
        )}

        {/* Item count */}
        {itemCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400 shrink-0">
            <Boxes className="w-3.5 h-3.5" />
            {itemCount}
          </span>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canView360 && (
            <button
              type="button"
              onClick={() => onView360(node)}
              className="p-1.5 rounded-md text-gray-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
              title="Ver en 360"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onManage360(node)}
            className="p-1.5 rounded-md text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            title="Imagen 360 y marcador"
          >
            <Globe className="w-4 h-4" />
          </button>
          {canHaveChildren && (
            <button
              type="button"
              onClick={() => onAddChild(node)}
              className="p-1.5 rounded-md text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Agregar dentro"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(node)}
            className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node)}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="ml-2">
          <LocationTree
            nodes={node.children}
            depth={depth + 1}
            ancestorHasPanorama={ancestorHasPanorama || hasOwnPano}
            {...callbacks}
          />
        </div>
      )}

      {/* Empty leaf hint when expanded but no children */}
      {!hasChildren && expanded && canHaveChildren && depth === 0 && itemCount === 0 && (
        <div className="ml-10 py-1 text-xs text-gray-600 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Sin sub-ubicaciones
        </div>
      )}
    </li>
  )
}
