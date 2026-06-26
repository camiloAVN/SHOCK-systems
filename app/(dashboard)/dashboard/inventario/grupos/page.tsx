'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useItemGroups } from '@/hooks/useItemGroups'
import { ItemGroupsTable } from '@/components/dashboard/inventory/ItemGroupsTable'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Plus, Search, Package2 } from 'lucide-react'

export default function ItemGroupsPage() {
  const { groups, isLoading, filters, setFilters, fetchGroups, deleteGroup } = useItemGroups()
  const [localSearch, setLocalSearch] = useState(filters.search)

  useEffect(() => {
    fetchGroups(filters)
  }, [fetchGroups, filters])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters({ search: localSearch })
  }

  const handleDelete = async (id: string) => {
    const success = await deleteGroup(id)
    if (success) {
      fetchGroups(filters)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Package2 className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Grupos de Items</h1>
              <p className="text-gray-400 mt-1">
                Organiza tus equipos en paquetes predefinidos
              </p>
            </div>
          </div>
        </div>
        <Link href="/dashboard/inventario/grupos/nuevo">
          <Button variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Grupo
          </Button>
        </Link>
      </div>

      <Card>
        <Card.Header>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre o descripcion..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <Button type="submit" variant="outline">
              Buscar
            </Button>
          </form>
        </Card.Header>
        <Card.Content>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 mt-4">Cargando grupos...</p>
            </div>
          ) : (
            <ItemGroupsTable
              groups={groups}
              onDelete={handleDelete}
            />
          )}
        </Card.Content>
      </Card>
    </div>
  )
}
