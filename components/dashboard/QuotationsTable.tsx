'use client'

import Link from 'next/link'
import { Quotation, statusLabels, statusColors } from '@/lib/validations/quotation'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Eye, Edit, Trash2, Download } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface QuotationsTableProps {
  quotations: Quotation[]
  onDelete: (id: string) => void
  onDownloadPdf: (id: string, quotationNumber: string) => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount)
}

export function QuotationsTable({ quotations, onDelete, onDownloadPdf }: QuotationsTableProps) {
  if (quotations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No hay cotizaciones registradas</p>
        <p className="text-sm text-gray-500 mt-2">
          Crea tu primera cotización para comenzar
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table className="table-cards">
        <thead>
          <tr>
            <th>Número</th>
            <th>Título</th>
            <th>Cliente</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Válida hasta</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {quotations.map((quotation) => (
            <tr key={quotation.id}>
              <td className="font-mono text-sm text-orange-400">
                {quotation.quotationNumber}
              </td>
              <td className="font-medium">{quotation.title}</td>
              <td>
                <div>
                  <p className="font-medium">{quotation.client?.name || '-'}</p>
                  {quotation.client?.company && (
                    <p className="text-sm text-gray-500">{quotation.client.company}</p>
                  )}
                </div>
              </td>
              <td className="font-medium text-green-400">
                {formatCurrency(Number(quotation.total))}
              </td>
              <td>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    statusColors[quotation.status]
                  }`}
                >
                  {statusLabels[quotation.status]}
                </span>
              </td>
              <td>
                {format(new Date(quotation.validUntil), 'dd MMM yyyy', {
                  locale: es,
                })}
              </td>
              <td>
                <div className="flex items-center gap-1">
                  <Link href={`/dashboard/cotizaciones/${quotation.id}`}>
                    <Button variant="ghost" size="sm" title="Ver detalles">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href={`/dashboard/cotizaciones/${quotation.id}/editar`}>
                    <Button variant="ghost" size="sm" title="Editar">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Descargar PDF"
                    onClick={() => onDownloadPdf(quotation.id, quotation.quotationNumber)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => {
                      if (
                        confirm(
                          '¿Estás seguro de que deseas eliminar esta cotización?'
                        )
                      ) {
                        onDelete(quotation.id)
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
