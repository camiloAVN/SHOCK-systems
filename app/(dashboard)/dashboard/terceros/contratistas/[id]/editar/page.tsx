'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useSuppliers } from '@/hooks/useSuppliers'
import { SupplierForm } from '@/components/forms/SupplierForm'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SupplierFormData } from '@/lib/validations/supplier'
import { ArrowLeft, Users } from 'lucide-react'

export default function EditContractorPage() {
  const router = useRouter()
  const params = useParams()
  const contractorId = params.id as string
  const { currentSupplier: contractor, isLoading, fetchSupplier, editSupplier } = useSuppliers()
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (contractorId) {
      fetchSupplier(contractorId)
    }
  }, [contractorId, fetchSupplier])

  const handleSubmit = async (data: SupplierFormData) => {
    setIsSubmitting(true)
    try {
      const result = await editSupplier(contractorId, data)
      if (result) {
        router.push(`/dashboard/terceros/contratistas/${contractorId}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push(`/dashboard/terceros/contratistas/${contractorId}`)
  }

  if (isLoading && !contractor) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/terceros/contratistas/${contractorId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <Users className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Editar Contratista</h1>
          <p className="text-gray-400 mt-1">
            Modificar &quot;{contractor.name}&quot;
          </p>
        </div>
      </div>

      <Card>
        <Card.Content className="pt-6">
          <SupplierForm
            supplier={contractor}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            isContractor={true}
          />
        </Card.Content>
      </Card>
    </div>
  )
}
