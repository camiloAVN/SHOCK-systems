'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useConcepts } from '@/hooks/useConcepts'
import { ConceptForm } from '@/components/forms/ConceptForm'
import { Button } from '@/components/ui/Button'
import { ConceptFormData } from '@/lib/validations/concept'
import { ArrowLeft, FileText } from 'lucide-react'

export default function EditConceptPage() {
  const router = useRouter()
  const params = useParams()
  const conceptId = params.id as string
  const { currentConcept, isLoading, fetchConcept, editConcept } = useConcepts()

  useEffect(() => {
    if (conceptId) {
      fetchConcept(conceptId)
    }
  }, [conceptId, fetchConcept])

  const handleSubmit = async (data: ConceptFormData) => {
    const result = await editConcept(conceptId, data)
    if (result) {
      router.push(`/dashboard/terceros/conceptos/${conceptId}`)
    }
  }

  if (isLoading && !currentConcept) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 mt-4">Cargando concepto...</p>
        </div>
      </div>
    )
  }

  if (!currentConcept) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Concepto no encontrado</p>
        <Link href="/dashboard/terceros/conceptos" className="text-orange-400 hover:underline mt-2 inline-block">
          Volver a conceptos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/terceros/conceptos/${conceptId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <FileText className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Editar Concepto</h1>
          <p className="text-gray-400 mt-1">
            Modificar &quot;{currentConcept.name}&quot;
          </p>
        </div>
      </div>

      <div className="max-w-3xl">
        <ConceptForm
          initialData={currentConcept}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
