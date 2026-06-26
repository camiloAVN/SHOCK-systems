'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useConcepts } from '@/hooks/useConcepts'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ArrowLeft, Edit, Trash2, FileText, User, Calendar, DollarSign } from 'lucide-react'
import { conceptCategories } from '@/lib/validations/concept'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount)
}

export default function ConceptDetailPage() {
  const params = useParams()
  const router = useRouter()
  const conceptId = params.id as string
  const { currentConcept, isLoading, fetchConcept, deleteConcept } = useConcepts()

  useEffect(() => {
    if (conceptId) {
      fetchConcept(conceptId)
    }
  }, [conceptId, fetchConcept])

  const handleDelete = async () => {
    if (confirm('¿Estás seguro de que deseas eliminar este concepto?')) {
      const success = await deleteConcept(conceptId)
      if (success) {
        router.push('/dashboard/terceros/conceptos')
      }
    }
  }

  const getCategoryLabel = (category: string | null) => {
    if (!category) return '-'
    const found = conceptCategories.find(c => c.value === category)
    return found?.label || category
  }

  if (isLoading && !currentConcept) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 mt-4">Cargando concepto...</p>
        </div>
      </div>
    )
  }

  if (!currentConcept) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Concepto no encontrado</p>
        <Link href="/dashboard/terceros/conceptos" className="text-orange-400 hover:underline mt-2 inline-block">
          Volver a conceptos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/terceros/conceptos">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10">
            <FileText className="w-8 h-8 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold">{currentConcept.name}</h1>
              {currentConcept.isActive ? (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                  Activo
                </span>
              ) : (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
                  Inactivo
                </span>
              )}
            </div>
            {currentConcept.description && (
              <p className="text-gray-400 mt-2 max-w-2xl">{currentConcept.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Creado {new Date(currentConcept.createdAt).toLocaleDateString('es-CO')}
              </span>
              {currentConcept.category && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-orange-400 font-medium">
                  {getCategoryLabel(currentConcept.category)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/terceros/conceptos/${conceptId}/editar`}>
            <Button variant="outline">
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          </Link>
          <Button
            variant="outline"
            className="text-red-400 hover:text-red-300 hover:border-red-500"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar
          </Button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pricing */}
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Precio de Referencia
            </Card.Title>
          </Card.Header>
          <Card.Content>
            {currentConcept.unitPrice ? (
              <p className="text-2xl sm:text-3xl font-bold text-green-400">
                {formatCurrency(Number(currentConcept.unitPrice))}
              </p>
            ) : (
              <p className="text-gray-400">Sin precio definido</p>
            )}
          </Card.Content>
        </Card>

        {/* Contractor */}
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <User className="w-5 h-5 text-orange-400" />
              Contratista Asociado
            </Card.Title>
          </Card.Header>
          <Card.Content>
            {currentConcept.supplier ? (
              <div className="space-y-2">
                <p className="text-lg font-medium">{currentConcept.supplier.name}</p>
                {currentConcept.supplier.contactName && (
                  <p className="text-gray-400">Contacto: {currentConcept.supplier.contactName}</p>
                )}
                {currentConcept.supplier.email && (
                  <p className="text-gray-400">{currentConcept.supplier.email}</p>
                )}
                {currentConcept.supplier.phone && (
                  <p className="text-gray-400">{currentConcept.supplier.phone}</p>
                )}
                <Link href={`/dashboard/terceros/contratistas/${currentConcept.supplier.id}`}>
                  <Button variant="outline" size="sm" className="mt-2">
                    Ver Contratista
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-gray-400">Sin contratista asignado</p>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* Notes */}
      {currentConcept.notes && (
        <Card>
          <Card.Header>
            <Card.Title>Notas</Card.Title>
          </Card.Header>
          <Card.Content>
            <p className="text-gray-300 whitespace-pre-wrap">{currentConcept.notes}</p>
          </Card.Content>
        </Card>
      )}
    </div>
  )
}
