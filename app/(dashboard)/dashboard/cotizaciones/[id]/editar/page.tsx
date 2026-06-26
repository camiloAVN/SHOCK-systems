'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuotations } from '@/hooks/useQuotations'
import { QuotationForm } from '@/components/forms/QuotationForm'
import { QuotationFormData, Quotation } from '@/lib/validations/quotation'
import { ArrowLeft } from 'lucide-react'

export default function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  const { currentQuotation, isLoading, fetchQuotation, editQuotation } = useQuotations()
  const [quotationData, setQuotationData] = useState<Quotation | null>(null)

  useEffect(() => {
    const loadQuotation = async () => {
      const data = await fetchQuotation(id)
      setQuotationData(data)
    }
    loadQuotation()
  }, [id, fetchQuotation])

  const handleSubmit = async (data: QuotationFormData) => {
    const updated = await editQuotation(id, data)
    if (updated) {
      router.push(`/dashboard/cotizaciones/${id}`)
    }
  }

  const handleCancel = () => {
    router.push(`/dashboard/cotizaciones/${id}`)
  }

  if (isLoading || !quotationData) {
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
          href={`/dashboard/cotizaciones/${id}`}
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a la cotizacion
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Editar Cotizacion</h1>
        <p className="text-gray-400 mt-1">
          Actualiza la informacion de la cotizacion
        </p>
      </div>

      <QuotationForm
        quotation={quotationData}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isLoading}
      />
    </div>
  )
}
