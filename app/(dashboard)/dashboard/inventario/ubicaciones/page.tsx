'use client'

import { useEffect, useState } from 'react'
import { MapPin, Plus, FolderTree } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LocationTree } from '@/components/locations/LocationTree'
import { LocationFormModal } from '@/components/locations/LocationFormModal'
import { useLocations } from '@/hooks/useLocations'
import { Location, LocationNode, LocationType } from '@/lib/validations/location'

export default function UbicacionesPage() {
  const { tree, isLoading, fetchTree, createLocation, editLocation, deleteLocation } =
    useLocations()

  const [formOpen, setFormOpen] = useState(false)
  const [formParent, setFormParent] = useState<Location | null>(null)
  const [formEditing, setFormEditing] = useState<Location | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<LocationNode | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchTree({ silent: true })
  }, [fetchTree])

  const openCreateRoot = () => {
    setFormEditing(null)
    setFormParent(null)
    setFormOpen(true)
  }

  const openAddChild = (parent: LocationNode) => {
    setFormEditing(null)
    setFormParent(parent)
    setFormOpen(true)
  }

  const openEdit = (node: LocationNode) => {
    setFormParent(null)
    setFormEditing(node)
    setFormOpen(true)
  }

  const handleSubmit = async (data: {
    type: LocationType
    code: string
    description?: string
  }) => {
    setIsSubmitting(true)
    try {
      if (formEditing) {
        return await editLocation(formEditing.id, {
          code: data.code,
          description: data.description ?? null,
        })
      }
      return await createLocation({
        type: data.type,
        code: data.code,
        description: data.description,
        parentId: formParent?.id ?? null,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const ok = await deleteLocation(deleteTarget.id)
      if (ok) setDeleteTarget(null)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <MapPin className="w-7 h-7 text-emerald-400" />
            <span className="text-gradient">Ubicaciones</span>
          </h1>
          <p className="text-gray-400">
            Organiza la bodega en sectores, cuadrantes, racks, niveles y posiciones
          </p>
        </div>
        <Button onClick={openCreateRoot}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Sector
        </Button>
      </div>

      {/* Tree */}
      <Card variant="glass">
        <CardContent>
          {isLoading && tree.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderTree className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-300 font-medium">No hay ubicaciones todavía</p>
              <p className="text-gray-500 text-sm mb-4">
                Crea tu primer sector para empezar a organizar la bodega
              </p>
              <Button variant="outline" onClick={openCreateRoot}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Sector
              </Button>
            </div>
          ) : (
            <LocationTree
              nodes={tree}
              onAddChild={openAddChild}
              onEdit={openEdit}
              onDelete={(n) => setDeleteTarget(n)}
            />
          )}
        </CardContent>
      </Card>

      {/* Create / Edit modal */}
      <LocationFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        parent={formParent}
        editing={formEditing}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar ubicación"
        size="sm"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-gray-300">
              ¿Seguro que deseas eliminar{' '}
              <span className="font-semibold text-white">{deleteTarget.fullPath}</span>?
            </p>
            {(deleteTarget.children.length > 0 || (deleteTarget._count?.items ?? 0) > 0) && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">
                {deleteTarget.children.length > 0 && (
                  <p>
                    Se eliminarán también todas sus sub-ubicaciones.
                  </p>
                )}
                {(deleteTarget._count?.items ?? 0) > 0 && (
                  <p>
                    {deleteTarget._count?.items} item(s) quedarán sin ubicación asignada.
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="danger" isLoading={isDeleting} onClick={confirmDelete}>
                Eliminar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
