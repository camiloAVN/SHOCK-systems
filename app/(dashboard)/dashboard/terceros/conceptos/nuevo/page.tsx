'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useConcepts } from '@/hooks/useConcepts'
import { ConceptForm } from '@/components/forms/ConceptForm'
import { Button } from '@/components/ui/Button'
import { ConceptFormData } from '@/lib/validations/concept'
import { ArrowLeft, FileText } from 'lucide-react'

export default function NewConceptPage() {
  const router = useRouter()
  const { createConcept, isLoading } = useConcepts()

  const handleSubmit = async (data: ConceptFormData) => {
    const result = await createConcept(data)
    if (result) {
      router.push('/dashboard/terceros/conceptos')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/terceros/conceptos">
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
          <h1 className="text-2xl sm:text-3xl font-bold">Nuevo Concepto</h1>
          <p className="text-gray-400 mt-1">
            Crea un nuevo servicio o concepto de contratista
          </p>
        </div>
      </div>

      <div className="max-w-3xl">
        <ConceptForm
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
