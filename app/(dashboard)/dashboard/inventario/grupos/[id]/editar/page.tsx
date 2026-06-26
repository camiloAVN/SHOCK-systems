'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useItemGroups } from '@/hooks/useItemGroups'
import { ItemGroupForm } from '@/components/forms/ItemGroupForm'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ItemGroupFormData } from '@/lib/validations/itemGroup'
import { ArrowLeft, Package2 } from 'lucide-react'

export default function EditItemGroupPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.id as string
  const { currentGroup, isLoading, fetchGroup, editGroup } = useItemGroups()

  useEffect(() => {
    if (groupId) {
      fetchGroup(groupId)
    }
  }, [groupId, fetchGroup])

  const handleSubmit = async (data: ItemGroupFormData) => {
    const result = await editGroup(groupId, data)
    if (result) {
      router.push(`/dashboard/inventario/grupos/${groupId}`)
    }
  }

  if (isLoading && !currentGroup) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 mt-4">Cargando grupo...</p>
        </div>
      </div>
    )
  }

  if (!currentGroup) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Grupo no encontrado</p>
        <Link href="/dashboard/inventario/grupos" className="text-orange-400 hover:underline mt-2 inline-block">
          Volver a grupos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/inventario/grupos/${groupId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <Package2 className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Editar Grupo</h1>
          <p className="text-gray-400 mt-1">
            Modifica la informacion del grupo &quot;{currentGroup.name}&quot;
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <Card.Header>
          <Card.Title>Informacion del Grupo</Card.Title>
          <Card.Description>
            Actualiza el nombre y descripcion del grupo.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ItemGroupForm
            initialData={currentGroup}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </Card.Content>
      </Card>
    </div>
  )
}
