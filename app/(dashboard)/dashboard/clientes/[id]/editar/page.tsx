'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClients } from '@/hooks/useClients'
import { ClientForm } from '@/components/forms/ClientForm'
import { Card } from '@/components/ui/Card'
import { ClientFormData } from '@/lib/validations/client'
import { ArrowLeft } from 'lucide-react'

export default function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  const { currentClient, isLoading, fetchClient, editClient } = useClients()
  const [clientData, setClientData] = useState<any>(null)

  useEffect(() => {
    const loadClient = async () => {
      const data = await fetchClient(id)
      setClientData(data)
    }
    loadClient()
  }, [id, fetchClient])

  const handleSubmit = async (data: ClientFormData) => {
    const updated = await editClient(id, data)
    if (updated) {
      router.push(`/dashboard/clientes/${id}`)
    }
  }

  const handleCancel = () => {
    router.push(`/dashboard/clientes/${id}`)
  }

  if (isLoading || !clientData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/clientes/${id}`}
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al cliente
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Editar Cliente</h1>
        <p className="text-gray-400 mt-1">
          Actualiza la información del cliente
        </p>
      </div>

      <Card>
        <Card.Header>
          <h2 className="text-xl font-semibold">Información del Cliente</h2>
        </Card.Header>
        <Card.Content>
          <ClientForm
            client={clientData}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isLoading}
          />
        </Card.Content>
      </Card>
    </div>
  )
}
