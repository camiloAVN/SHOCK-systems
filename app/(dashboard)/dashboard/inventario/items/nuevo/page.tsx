'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useInventory } from '@/hooks/useInventory'
import { useProducts } from '@/hooks/useProducts'
import { useLocations } from '@/hooks/useLocations'
import { InventoryItemForm } from '@/components/forms/InventoryItemForm'
import { Card } from '@/components/ui/Card'
import { InventoryItemFormData } from '@/lib/validations/inventory'

export default function NewInventoryItemPage() {
  const router = useRouter()
  const { createItem, items, fetchItems } = useInventory()
  const { products, fetchProducts } = useProducts()
  const { flatList: locations, fetchTree } = useLocations()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [defaultProductId, setDefaultProductId] = useState<string | null>(null)

  useEffect(() => {
    setDefaultProductId(new URLSearchParams(window.location.search).get('productId'))
  }, [])

  const backHref = defaultProductId
    ? `/dashboard/inventario/productos?productId=${defaultProductId}`
    : '/dashboard/inventario/items'

  useEffect(() => {
    fetchProducts()
    fetchItems({ type: 'CONTAINER' })
    fetchTree({ silent: true })
  }, [fetchProducts, fetchItems, fetchTree])

  const containers = items.filter((item) => item.type === 'CONTAINER')

  const handleSubmit = async (data: InventoryItemFormData) => {
    setIsSubmitting(true)
    try {
      const item = await createItem(data)
      if (item) {
        router.push(
          data.productId
            ? `/dashboard/inventario/productos?productId=${data.productId}`
            : '/dashboard/inventario/items'
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push(backHref)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Agregar unidad</h1>
        <p className="text-gray-400 mt-1">
          Registra un equipo físico (con su serie, estado y ubicación) de un producto del catálogo.
        </p>
      </div>

      <Card>
        <Card.Content className="pt-6">
          <InventoryItemForm
            products={products}
            containers={containers}
            locations={locations}
            defaultProductId={defaultProductId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        </Card.Content>
      </Card>
    </div>
  )
}
