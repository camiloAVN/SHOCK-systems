'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuotations } from '@/hooks/useQuotations'
import { QuotationsTable } from '@/components/dashboard/QuotationsTable'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Plus, Search, Filter, X } from 'lucide-react'
import { QuotationStatus, statusLabels } from '@/lib/validations/quotation'

export default function QuotationsPage() {
  const {
    quotations,
    isLoading,
    searchQuery,
    filters,
    setSearchQuery,
    setFilters,
    clearFilters,
    fetchQuotations,
    deleteQuotation,
    downloadPDF
  } = useQuotations()

  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchQuotations({ search: searchQuery, ...filters })
  }, [fetchQuotations, searchQuery, filters])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(localSearch)
  }

  const handleDelete = async (id: string) => {
    const success = await deleteQuotation(id)
    if (success) {
      fetchQuotations({ search: searchQuery, ...filters })
    }
  }

  const handleStatusFilter = (status: QuotationStatus | '') => {
    if (status === '') {
      clearFilters()
    } else {
      setFilters({ status })
    }
  }

  const hasActiveFilters = filters.status || filters.clientId || filters.projectId

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Cotizaciones</h1>
          <p className="text-gray-400 mt-1">
            Gestiona tus cotizaciones y propuestas
          </p>
        </div>
        <Link href="/dashboard/cotizaciones/nuevo">
          <Button variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Cotización
          </Button>
        </Link>
      </div>

      <Card>
        <Card.Header>
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por número o título..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
              <Button type="submit" variant="outline">
                Buscar
              </Button>
              <Button
                type="button"
                variant={showFilters ? 'primary' : 'outline'}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
              </Button>
            </form>

            {showFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-800">
                <span className="text-sm text-gray-400">Estado:</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={!filters.status ? 'primary' : 'outline'}
                    onClick={() => handleStatusFilter('')}
                  >
                    Todos
                  </Button>
                  {(Object.keys(statusLabels) as QuotationStatus[]).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={filters.status === status ? 'primary' : 'outline'}
                      onClick={() => handleStatusFilter(status)}
                    >
                      {statusLabels[status]}
                    </Button>
                  ))}
                </div>
                {hasActiveFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearFilters}
                    className="ml-auto text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Limpiar filtros
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card.Header>
        <Card.Content>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 mt-4">Cargando cotizaciones...</p>
            </div>
          ) : (
            <QuotationsTable
              quotations={quotations}
              onDelete={handleDelete}
              onDownloadPdf={downloadPDF}
            />
          )}
        </Card.Content>
      </Card>
    </div>
  )
}
