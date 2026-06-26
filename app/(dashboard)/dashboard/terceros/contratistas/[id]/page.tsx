'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSuppliers } from '@/hooks/useSuppliers'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import {
  ArrowLeft,
  Edit,
  Users,
  Mail,
  Phone,
  MapPin,
  Globe,
  User,
  Package,
  Calendar,
  FileText,
  Building2,
  FileDown,
} from 'lucide-react'

export default function ContractorDetailPage() {
  const params = useParams()
  const { currentSupplier: contractor, isLoading, fetchSupplier } = useSuppliers()

  const contractorId = params.id as string

  useEffect(() => {
    if (contractorId) {
      fetchSupplier(contractorId)
    }
  }, [contractorId, fetchSupplier])

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 mt-4">Cargando contratista...</p>
        </div>
      </div>
    )
  }

  if (!contractor) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">Contratista no encontrado</p>
        <Link href="/dashboard/terceros/contratistas">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a contratistas
          </Button>
        </Link>
      </div>
    )
  }

  const products = contractor.products || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/terceros/contratistas">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Users className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{contractor.name}</h1>
              {contractor.city && (
                <p className="text-gray-400 mt-1 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {[contractor.city, contractor.country].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
        <Link href={`/dashboard/terceros/contratistas/${contractor.id}/editar`}>
          <Button variant="primary">
            <Edit className="w-4 h-4 mr-2" />
            Editar Contratista
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <Card>
            <Card.Header>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-orange-400" />
                <h2 className="text-lg font-semibold">Informacion de Contacto</h2>
              </div>
            </Card.Header>
            <Card.Content>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm text-gray-400">Persona de Contacto</label>
                  <p className="mt-1">{contractor.contactName || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Email</label>
                  <p className="mt-1">
                    {contractor.email ? (
                      <a
                        href={`mailto:${contractor.email}`}
                        className="text-orange-400 hover:text-orange-300 flex items-center gap-2"
                      >
                        <Mail className="w-4 h-4" />
                        {contractor.email}
                      </a>
                    ) : (
                      '-'
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Telefono</label>
                  <p className="mt-1">
                    {contractor.phone ? (
                      <a
                        href={`tel:${contractor.phone}`}
                        className="text-gray-200 flex items-center gap-2"
                      >
                        <Phone className="w-4 h-4" />
                        {contractor.phone}
                      </a>
                    ) : (
                      '-'
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Sitio Web</label>
                  <p className="mt-1">
                    {contractor.website ? (
                      <a
                        href={contractor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-400 hover:text-orange-300 flex items-center gap-2"
                      >
                        <Globe className="w-4 h-4" />
                        {contractor.website}
                      </a>
                    ) : (
                      '-'
                    )}
                  </p>
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* Address */}
          <Card>
            <Card.Header>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-orange-400" />
                <h2 className="text-lg font-semibold">Direccion</h2>
              </div>
            </Card.Header>
            <Card.Content>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label className="text-sm text-gray-400">Direccion</label>
                  <p className="mt-1">{contractor.address || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Ciudad</label>
                  <p className="mt-1">{contractor.city || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Pais</label>
                  <p className="mt-1">{contractor.country || '-'}</p>
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* Products */}
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-orange-400" />
                  <h2 className="text-lg font-semibold">Productos Suministrados</h2>
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400">
                    {contractor._count?.products || 0}
                  </span>
                </div>
              </div>
            </Card.Header>
            <Card.Content>
              {products.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Producto</th>
                        <th>SKU Contratista</th>
                        <th>Costo</th>
                        <th>Preferido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((ps) => (
                        <tr key={ps.productId}>
                          <td className="font-mono text-sm">{ps.product.sku}</td>
                          <td>
                            <Link
                              href={`/dashboard/inventario/productos/${ps.product.id}`}
                              className="text-orange-400 hover:text-orange-300"
                            >
                              {ps.product.name}
                            </Link>
                            {ps.product.brand && (
                              <p className="text-xs text-gray-500">{ps.product.brand}</p>
                            )}
                          </td>
                          <td className="font-mono text-sm text-gray-400">
                            {ps.supplierSku || '-'}
                          </td>
                          <td>{formatPrice(ps.cost)}</td>
                          <td>
                            {ps.isPreferred && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                                Preferido
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No hay productos asociados</p>
                </div>
              )}
            </Card.Content>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Notes */}
          {contractor.notes && (
            <Card>
              <Card.Header>
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-400" />
                  <h2 className="text-lg font-semibold">Notas</h2>
                </div>
              </Card.Header>
              <Card.Content>
                <p className="text-gray-300 whitespace-pre-wrap">{contractor.notes}</p>
              </Card.Content>
            </Card>
          )}

          {/* Fiscal Info */}
          <Card>
            <Card.Header>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-orange-400" />
                <h2 className="text-lg font-semibold">Informacion Fiscal</h2>
              </div>
            </Card.Header>
            <Card.Content>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">NIT / Documento</label>
                  <p className="mt-1 font-mono">{contractor.nit || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">RUT</label>
                  {contractor.rutUrl ? (
                    <a href={contractor.rutUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <FileDown className="w-4 h-4 mr-2" />
                        Descargar RUT
                      </Button>
                    </a>
                  ) : (
                    <p className="text-gray-500 text-sm">No adjunto</p>
                  )}
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* Metadata */}
          <Card>
            <Card.Header>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-400" />
                <h2 className="text-lg font-semibold">Detalles</h2>
              </div>
            </Card.Header>
            <Card.Content>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Productos</span>
                  <span className="font-semibold">{contractor._count?.products || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Creado</span>
                  <span>{formatDate(contractor.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Actualizado</span>
                  <span>{formatDate(contractor.updatedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">ID</span>
                  <span className="font-mono text-xs text-gray-500">{contractor.id}</span>
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* Quick Actions */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold">Acciones Rapidas</h2>
            </Card.Header>
            <Card.Content className="space-y-3">
              {contractor.email && (
                <a href={`mailto:${contractor.email}`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Mail className="w-4 h-4 mr-2" />
                    Enviar Email
                  </Button>
                </a>
              )}
              {contractor.phone && (
                <a href={`tel:${contractor.phone}`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Phone className="w-4 h-4 mr-2" />
                    Llamar
                  </Button>
                </a>
              )}
              {contractor.website && (
                <a href={contractor.website} target="_blank" rel="noopener noreferrer" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Globe className="w-4 h-4 mr-2" />
                    Visitar Sitio Web
                  </Button>
                </a>
              )}
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  )
}
