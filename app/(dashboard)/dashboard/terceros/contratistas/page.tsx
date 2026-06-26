'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSuppliers } from '@/hooks/useSuppliers'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Plus, Search, Users, Eye, Edit, Trash2 } from 'lucide-react'
import { Supplier } from '@/lib/validations/supplier'

function ContractorsTable({ contractors, onDelete }: { contractors: Supplier[], onDelete: (id: string) => void }) {
  if (contractors.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No hay contratistas registrados</p>
        <p className="text-sm text-gray-500 mt-2">
          Crea tu primer contratista para comenzar
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>NIT</th>
            <th>Contacto</th>
            <th>Email</th>
            <th>Telefono</th>
            <th>Productos</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {contractors.map((contractor) => (
            <tr key={contractor.id}>
              <td>
                <span className="font-medium">{contractor.name}</span>
              </td>
              <td className="text-gray-400 font-mono text-sm">{contractor.nit || '-'}</td>
              <td className="text-gray-400">{contractor.contactName || '-'}</td>
              <td className="text-gray-400">{contractor.email || '-'}</td>
              <td className="text-gray-400">{contractor.phone || '-'}</td>
              <td>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400">
                  {contractor._count?.products || 0} productos
                </span>
              </td>
              <td>
                <div className="flex items-center gap-1">
                  <Link href={`/dashboard/terceros/contratistas/${contractor.id}`}>
                    <Button variant="ghost" size="sm" title="Ver detalles">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href={`/dashboard/terceros/contratistas/${contractor.id}/editar`}>
                    <Button variant="ghost" size="sm" title="Editar">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => {
                      if (confirm('¿Estás seguro de que deseas eliminar este contratista?')) {
                        onDelete(contractor.id)
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

export default function ContractorsPage() {
  const { suppliers, isLoading, searchQuery, setSearchQuery, fetchSuppliers, deleteSupplier } = useSuppliers()
  const [localSearch, setLocalSearch] = useState(searchQuery)

  useEffect(() => {
    fetchSuppliers(searchQuery)
  }, [fetchSuppliers, searchQuery])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(localSearch)
  }

  const handleDelete = async (id: string) => {
    const success = await deleteSupplier(id)
    if (success) {
      fetchSuppliers(searchQuery)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Users className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Contratistas</h1>
              <p className="text-gray-400 mt-1">
                Gestiona tus contratistas y proveedores de servicios
              </p>
            </div>
          </div>
        </div>
        <Link href="/dashboard/terceros/contratistas/nuevo">
          <Button variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Contratista
          </Button>
        </Link>
      </div>

      <Card>
        <Card.Header>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre, contacto o email..."
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
              <p className="text-gray-400 mt-4">Cargando contratistas...</p>
            </div>
          ) : (
            <ContractorsTable contractors={suppliers} onDelete={handleDelete} />
          )}
        </Card.Content>
      </Card>
    </div>
  )
}
