'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuotations } from '@/hooks/useQuotations'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Download,
  User,
  Building2,
  Mail,
  Calendar,
  FileText,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { statusLabels, statusColors, Quotation } from '@/lib/validations/quotation'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount)
}

export default function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  const { currentQuotation, isLoading, fetchQuotation, deleteQuotation, downloadPDF } =
    useQuotations()
  const [quotationData, setQuotationData] = useState<Quotation | null>(null)

  useEffect(() => {
    const loadQuotation = async () => {
      const data = await fetchQuotation(id)
      setQuotationData(data)
    }
    loadQuotation()
  }, [id, fetchQuotation])

  const handleDelete = async () => {
    if (confirm('¿Estas seguro de que deseas eliminar esta cotizacion?')) {
      const success = await deleteQuotation(id)
      if (success) {
        router.push('/dashboard/cotizaciones')
      }
    }
  }

  const handleDownloadPdf = () => {
    if (quotationData) {
      downloadPDF(id, quotationData.quotationNumber)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!quotationData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Cotizacion no encontrada</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/cotizaciones"
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a cotizaciones
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold">{quotationData.title}</h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  statusColors[quotationData.status]
                }`}
              >
                {statusLabels[quotationData.status]}
              </span>
            </div>
            <p className="text-orange-400 font-mono mt-1">
              {quotationData.quotationNumber}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download className="w-4 h-4 mr-2" />
              Descargar PDF
            </Button>
            <Link href={`/dashboard/cotizaciones/${id}/editar`}>
              <Button variant="outline">
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </Link>
            <Button
              variant="outline"
              className="text-red-400 hover:text-red-300 hover:border-red-500/50"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {quotationData.description && (
            <Card>
              <Card.Header>
                <h2 className="text-xl font-semibold">Descripcion</h2>
              </Card.Header>
              <Card.Content>
                <p className="text-gray-300">{quotationData.description}</p>
              </Card.Content>
            </Card>
          )}

          {/* Items */}
          <Card>
            <Card.Header>
              <h2 className="text-xl font-semibold">Conceptos</h2>
            </Card.Header>
            <Card.Content>
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <th className="w-1/2">Descripcion</th>
                      <th className="text-right">Cantidad</th>
                      <th className="text-right">Precio Unit.</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotationData.items.map((item, index) => (
                      <tr key={item.id || index}>
                        <td>{item.description}</td>
                        <td className="text-right">{item.quantity}</td>
                        <td className="text-right">
                          {formatCurrency(Number(item.unitPrice))}
                        </td>
                        <td className="text-right font-medium text-green-400">
                          {formatCurrency(Number(item.total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Totals */}
              <div className="mt-6 pt-6 border-t border-gray-800">
                <div className="max-w-xs ml-auto space-y-2">
                  <div className="flex justify-between text-gray-400">
                    <span>Subtotal</span>
                    <span>{formatCurrency(Number(quotationData.subtotal))}</span>
                  </div>
                  {Number(quotationData.discount) > 0 && (
                    <div className="flex justify-between text-gray-400">
                      <span>Descuento</span>
                      <span>-{formatCurrency(Number(quotationData.discount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-400">
                    <span>IVA</span>
                    <span>+{formatCurrency(Number(quotationData.tax))}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-700 text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-green-400">
                      {formatCurrency(Number(quotationData.total))}
                    </span>
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* Notes and Terms */}
          {(quotationData.notes || quotationData.terms) && (
            <Card>
              <Card.Header>
                <h2 className="text-xl font-semibold">Informacion Adicional</h2>
              </Card.Header>
              <Card.Content>
                <div className="space-y-4">
                  {quotationData.notes && (
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Notas</p>
                      <p className="text-gray-300">{quotationData.notes}</p>
                    </div>
                  )}
                  {quotationData.terms && (
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Terminos y Condiciones</p>
                      <p className="text-gray-300">{quotationData.terms}</p>
                    </div>
                  )}
                </div>
              </Card.Content>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Info */}
          <Card>
            <Card.Header>
              <h2 className="text-xl font-semibold">Cliente</h2>
            </Card.Header>
            <Card.Content>
              {quotationData.client ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-orange-400 mt-0.5" />
                    <div>
                      <p className="font-medium">{quotationData.client.name}</p>
                      {quotationData.client.company && (
                        <p className="text-sm text-gray-400">
                          {quotationData.client.company}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-orange-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-400">Email</p>
                      <p className="font-medium">{quotationData.client.email}</p>
                    </div>
                  </div>
                  <Link href={`/dashboard/clientes/${quotationData.client.id}`}>
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      Ver perfil del cliente
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-gray-400">Sin cliente asignado</p>
              )}
            </Card.Content>
          </Card>

          {/* Project Info */}
          {quotationData.project && (
            <Card>
              <Card.Header>
                <h2 className="text-xl font-semibold">Proyecto</h2>
              </Card.Header>
              <Card.Content>
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-orange-400 mt-0.5" />
                  <div>
                    <p className="font-medium">{quotationData.project.title}</p>
                  </div>
                </div>
                <Link href={`/dashboard/proyectos/${quotationData.project.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-4">
                    Ver proyecto
                  </Button>
                </Link>
              </Card.Content>
            </Card>
          )}

          {/* Dates */}
          <Card>
            <Card.Header>
              <h2 className="text-xl font-semibold">Fechas</h2>
            </Card.Header>
            <Card.Content>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-orange-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Fecha de Creacion</p>
                    <p className="font-medium">
                      {format(new Date(quotationData.createdAt), 'dd MMMM yyyy', {
                        locale: es,
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-orange-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Valida hasta</p>
                    <p className="font-medium">
                      {format(new Date(quotationData.validUntil), 'dd MMMM yyyy', {
                        locale: es,
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Ultima Actualizacion</p>
                    <p className="font-medium">
                      {format(new Date(quotationData.updatedAt), 'dd MMMM yyyy', {
                        locale: es,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* Created By */}
          {quotationData.createdByUser && (
            <Card>
              <Card.Header>
                <h2 className="text-xl font-semibold">Creada por</h2>
              </Card.Header>
              <Card.Content>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {quotationData.createdByUser.name || 'Usuario'}
                    </p>
                    <p className="text-sm text-gray-400">
                      {quotationData.createdByUser.email}
                    </p>
                  </div>
                </div>
              </Card.Content>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
