'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useConcepts } from '@/hooks/useConcepts'
import { ConceptsTable } from '@/components/dashboard/ConceptsTable'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Plus, Search, FileText } from 'lucide-react'
import { conceptCategories } from '@/lib/validations/concept'

export default function ConceptsPage() {
  const { concepts, isLoading, filters, setFilters, fetchConcepts, deleteConcept } = useConcepts()
  const [localSearch, setLocalSearch] = useState(filters.search)

  useEffect(() => {
    fetchConcepts(filters)
  }, [fetchConcepts, filters])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters({ search: localSearch })
  }

  const handleDelete = async (id: string) => {
    const success = await deleteConcept(id)
    if (success) {
      fetchConcepts(filters)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <FileText className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Conceptos</h1>
              <p className="text-gray-400 mt-1">
                Servicios y conceptos de contratistas
              </p>
            </div>
          </div>
        </div>
        <Link href="/dashboard/terceros/conceptos/nuevo">
          <Button variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Concepto
          </Button>
        </Link>
      </div>

      <Card>
        <Card.Header>
          <div className="flex flex-col md:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por nombre, descripcion, contratista..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
              <Button type="submit" variant="outline">
                Buscar
              </Button>
            </form>
            <div className="flex gap-2">
              <select
                className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={filters.category}
                onChange={(e) => setFilters({ category: e.target.value })}
              >
                <option value="">Todas las categorias</option>
                {conceptCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <select
                className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={filters.isActive}
                onChange={(e) => setFilters({ isActive: e.target.value })}
              >
                <option value="">Todos los estados</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 mt-4">Cargando conceptos...</p>
            </div>
          ) : (
            <ConceptsTable
              concepts={concepts}
              onDelete={handleDelete}
            />
          )}
        </Card.Content>
      </Card>
    </div>
  )
}
