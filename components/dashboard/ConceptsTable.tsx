'use client'

import Link from 'next/link'
import { Concept, conceptCategories } from '@/lib/validations/concept'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Eye, Edit, Trash2, FileText, User } from 'lucide-react'

interface ConceptsTableProps {
  concepts: Concept[]
  onDelete: (id: string) => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function ConceptsTable({ concepts, onDelete }: ConceptsTableProps) {
  if (concepts.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No hay conceptos registrados</p>
        <p className="text-sm text-gray-500 mt-2">
          Crea tu primer concepto para comenzar
        </p>
      </div>
    )
  }

  const getCategoryLabel = (category: string | null) => {
    if (!category) return '-'
    const found = conceptCategories.find(c => c.value === category)
    return found?.label || category
  }

  return (
    <div className="overflow-x-auto">
      <Table className="table-cards">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Categoria</th>
            <th>Contratista</th>
            <th>Precio Ref.</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {concepts.map((concept) => (
            <tr key={concept.id}>
              <td>
                <div>
                  <span className="font-medium">{concept.name}</span>
                  {concept.description && (
                    <p className="text-xs text-gray-500 truncate max-w-xs">
                      {concept.description}
                    </p>
                  )}
                </div>
              </td>
              <td>
                {concept.category ? (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-orange-400">
                    {getCategoryLabel(concept.category)}
                  </span>
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </td>
              <td>
                {concept.supplier ? (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <div>
                      <span className="text-gray-200">{concept.supplier.name}</span>
                      {concept.supplier.contactName && (
                        <p className="text-xs text-gray-500">{concept.supplier.contactName}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-500">Sin asignar</span>
                )}
              </td>
              <td>
                {concept.unitPrice ? (
                  <span className="text-green-400 font-medium">
                    {formatCurrency(Number(concept.unitPrice))}
                  </span>
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </td>
              <td>
                {concept.isActive ? (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                    Activo
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
                    Inactivo
                  </span>
                )}
              </td>
              <td>
                <div className="flex items-center gap-1">
                  <Link href={`/dashboard/terceros/conceptos/${concept.id}`}>
                    <Button variant="ghost" size="sm" title="Ver detalles">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href={`/dashboard/terceros/conceptos/${concept.id}/editar`}>
                    <Button variant="ghost" size="sm" title="Editar">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => {
                      if (confirm('¿Estás seguro de que deseas eliminar este concepto?')) {
                        onDelete(concept.id)
                      }
                    }}
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}
