'use client'

import Link from 'next/link'
import { ItemGroup } from '@/lib/validations/itemGroup'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Eye, Edit, Trash2, Package2 } from 'lucide-react'

interface ItemGroupsTableProps {
  groups: ItemGroup[]
  onDelete: (id: string) => void
}

export function ItemGroupsTable({ groups, onDelete }: ItemGroupsTableProps) {
  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <Package2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No hay grupos de items</p>
        <p className="text-sm text-gray-500 mt-2">
          Crea tu primer grupo para organizar tus equipos
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table className="table-cards">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Descripcion</th>
            <th>Items</th>
            <th>Categorias</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            // Get unique categories from items
            const categories = new Set<string>()
            group.items?.forEach((item) => {
              if (item.inventoryItem?.product?.category?.name) {
                categories.add(item.inventoryItem.product.category.name)
              }
            })

            return (
              <tr key={group.id}>
                <td>
                  <div>
                    <span className="font-medium">{group.name}</span>
                  </div>
                </td>
                <td className="text-gray-400 max-w-xs truncate">
                  {group.description || '-'}
                </td>
                <td>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400">
                    {group._count?.items || 0} items
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(categories).slice(0, 3).map((cat) => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300"
                      >
                        {cat}
                      </span>
                    ))}
                    {categories.size > 3 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                        +{categories.size - 3}
                      </span>
                    )}
                    {categories.size === 0 && (
                      <span className="text-gray-500">-</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/inventario/grupos/${group.id}`}>
                      <Button variant="ghost" size="sm" title="Ver detalles">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href={`/dashboard/inventario/grupos/${group.id}/editar`}>
                      <Button variant="ghost" size="sm" title="Editar">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => {
                        if (confirm('¿Estás seguro de que deseas eliminar este grupo?')) {
                          onDelete(group.id)
                        }
                      }}
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}
