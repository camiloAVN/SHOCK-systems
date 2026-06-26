'use client'

import { useRouter } from 'next/navigation'
import { useClients } from '@/hooks/useClients'
import { ClientForm } from '@/components/forms/ClientForm'
import { Card } from '@/components/ui/Card'
import { ClientFormData } from '@/lib/validations/client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewClientPage() {
  const router = useRouter()
  const { createClient, isLoading } = useClients()

  const handleSubmit = async (data: ClientFormData) => {
    const client = await createClient(data)
    if (client) {
      router.push('/dashboard/clientes')
    }
  }

  const handleCancel = () => {
    router.push('/dashboard/clientes')
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/clientes"
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a clientes
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Nuevo Cliente</h1>
        <p className="text-gray-400 mt-1">
          Agrega un nuevo cliente a tu cartera
        </p>
      </div>

      <Card>
        <Card.Header>
          <h2 className="text-xl font-semibold">Información del Cliente</h2>
        </Card.Header>
        <Card.Content>
          <ClientForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isLoading}
          />
        </Card.Content>
      </Card>
    </div>
  )
}
