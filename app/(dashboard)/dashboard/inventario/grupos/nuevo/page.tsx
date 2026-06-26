'use client'

import { useRouter } from 'next/navigation'
import { useItemGroups } from '@/hooks/useItemGroups'
import { ItemGroupForm } from '@/components/forms/ItemGroupForm'
import { Card } from '@/components/ui/Card'
import { ItemGroupFormData } from '@/lib/validations/itemGroup'
import { ArrowLeft, Package2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function NewItemGroupPage() {
  const router = useRouter()
  const { createGroup, isLoading } = useItemGroups()

  const handleSubmit = async (data: ItemGroupFormData) => {
    const result = await createGroup(data)
    if (result) {
      router.push(`/dashboard/inventario/grupos/${result.id}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/inventario/grupos">
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
          <h1 className="text-2xl sm:text-3xl font-bold">Nuevo Grupo de Items</h1>
          <p className="text-gray-400 mt-1">
            Crea un paquete de equipos para organizar tu inventario
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <Card.Header>
          <Card.Title>Informacion del Grupo</Card.Title>
          <Card.Description>
            Define el nombre y descripcion del grupo. Luego podras agregar items.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ItemGroupForm
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </Card.Content>
      </Card>
    </div>
  )
}
