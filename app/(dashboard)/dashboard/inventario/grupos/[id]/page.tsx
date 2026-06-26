'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useItemGroups } from '@/hooks/useItemGroups'
import { GroupItemsList } from '@/components/dashboard/inventory/GroupItemsList'
import { ItemSelector } from '@/components/dashboard/inventory/ItemSelector'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ArrowLeft, Edit, Package2, Calendar } from 'lucide-react'

export default function ItemGroupDetailPage() {
  const params = useParams()
  const groupId = params.id as string
  const { currentGroup, isLoading, fetchGroup, addItemToGroup, removeItemFromGroup } = useItemGroups()

  useEffect(() => {
    if (groupId) {
      fetchGroup(groupId)
    }
  }, [groupId, fetchGroup])

  const handleAddItem = async (itemId: string) => {
    await addItemToGroup(groupId, { inventoryItemId: itemId, quantity: 1 })
  }

  const handleRemoveItem = async (itemId: string) => {
    await removeItemFromGroup(groupId, itemId)
  }

  if (isLoading && !currentGroup) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 mt-4">Cargando grupo...</p>
        </div>
      </div>
    )
  }

  if (!currentGroup) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Grupo no encontrado</p>
        <Link href="/dashboard/inventario/grupos" className="text-orange-400 hover:underline mt-2 inline-block">
          Volver a grupos
        </Link>
      </div>
    )
  }

  // Get item IDs already in the group
  const excludeItemIds = currentGroup.items?.map((item) => item.inventoryItemId) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/inventario/grupos">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-orange-500/10">
            <Package2 className="w-8 h-8 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{currentGroup.name}</h1>
            {currentGroup.description && (
              <p className="text-gray-400 mt-1 max-w-2xl">{currentGroup.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Creado {new Date(currentGroup.createdAt).toLocaleDateString('es-CO')}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-medium">
                {currentGroup._count?.items || 0} items
              </span>
            </div>
          </div>
        </div>
        <Link href={`/dashboard/inventario/grupos/${groupId}/editar`}>
          <Button variant="outline">
            <Edit className="w-4 h-4 mr-2" />
            Editar Grupo
          </Button>
        </Link>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Current items in group */}
        <div>
          <GroupItemsList
            items={currentGroup.items || []}
            onRemoveItem={handleRemoveItem}
            isLoading={isLoading}
          />
        </div>

        {/* Right: Item selector */}
        <div>
          <ItemSelector
            onAddItem={handleAddItem}
            excludeItemIds={excludeItemIds}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}
