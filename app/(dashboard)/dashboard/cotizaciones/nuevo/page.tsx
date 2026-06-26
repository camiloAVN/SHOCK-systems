'use client'

import { useRouter } from 'next/navigation'
import { useQuotations } from '@/hooks/useQuotations'
import { QuotationForm } from '@/components/forms/QuotationForm'
import { QuotationFormData } from '@/lib/validations/quotation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewQuotationPage() {
  const router = useRouter()
  const { createQuotation, isLoading } = useQuotations()

  const handleSubmit = async (data: QuotationFormData) => {
    const quotation = await createQuotation(data)
    if (quotation) {
      router.push('/dashboard/cotizaciones')
    }
  }

  const handleCancel = () => {
    router.push('/dashboard/cotizaciones')
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
        <h1 className="text-2xl sm:text-3xl font-bold">Nueva Cotizacion</h1>
        <p className="text-gray-400 mt-1">
          Crea una nueva cotizacion para tus clientes
        </p>
      </div>

      <QuotationForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isLoading}
      />
    </div>
  )
}
