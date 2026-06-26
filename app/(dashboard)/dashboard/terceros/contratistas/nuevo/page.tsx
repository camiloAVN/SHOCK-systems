'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSuppliers } from '@/hooks/useSuppliers'
import { SupplierForm } from '@/components/forms/SupplierForm'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SupplierFormData } from '@/lib/validations/supplier'
import { ArrowLeft, Users } from 'lucide-react'

export default function NewContractorPage() {
  const router = useRouter()
  const { createSupplier } = useSuppliers()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: SupplierFormData) => {
    setIsSubmitting(true)
    try {
      const contractor = await createSupplier(data)
      if (contractor) {
        router.push('/dashboard/terceros/contratistas')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push('/dashboard/terceros/contratistas')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/terceros/contratistas">
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
          <h1 className="text-2xl sm:text-3xl font-bold">Nuevo Contratista</h1>
          <p className="text-gray-400 mt-1">
            Agrega un nuevo contratista o proveedor de servicios
          </p>
        </div>
      </div>

      <Card>
        <Card.Content className="pt-6">
          <SupplierForm
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
