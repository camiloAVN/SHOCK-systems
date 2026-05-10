'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { inventoryItemSchema, InventoryItemFormData, InventoryItem } from '@/lib/validations/inventory'
import { Product } from '@/lib/validations/product'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Search, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface InventoryItemFormProps {
  item?: InventoryItem | null
  products: Product[]
  containers?: InventoryItem[]
  onSubmit: (data: InventoryItemFormData) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export function InventoryItemForm({
  item,
  products,
  containers = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventoryItemFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InventoryItemFormData>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: item
      ? {
          productId: item.productId,
          serialNumber: item.serialNumber || '',
          type: item.type,
          status: item.status,
          condition: item.condition || '',
          location: item.location || '',
          containerId: item.containerId || '',
          purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : '',
          purchasePrice: item.purchasePrice as number | undefined,
          warrantyExpiry: item.warrantyExpiry ? new Date(item.warrantyExpiry).toISOString().split('T')[0] : '',
          notes: item.notes || '',
        }
      : {
          type: 'UNIT',
          status: 'IN',
        },
  })

  const selectedType = watch('type')
  const productIdValue = watch('productId')

  // ── Product search state ────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    item ? (products.find((p) => p.id === item.productId) ?? null) : null
  )
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Unique categories derived from product list
  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string | null }>()
    products.forEach((p) => {
      if (p.category && !map.has(p.category.id)) {
        map.set(p.category.id, p.category)
      }
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [products])

  // Filtered product results
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return products
      .filter((p) => {
        const matchesSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.brand?.toLowerCase().includes(q) ?? false)
        const matchesCategory = !filterCategory || p.categoryId === filterCategory
        return matchesSearch && matchesCategory && p.status === 'ACTIVE'
      })
      .slice(0, 25)
  }, [products, searchQuery, filterCategory])

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product)
    setValue('productId', product.id, { shouldValidate: true })
    setDropdownOpen(false)
    setSearchQuery('')
  }

  const handleClearProduct = () => {
    setSelectedProduct(null)
    setValue('productId', '', { shouldValidate: true })
    setSearchQuery('')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Product search ─────────────────────────────────────────────────── */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Producto *
          </label>

          {selectedProduct ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-800 border border-emerald-500/40">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{selectedProduct.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {[selectedProduct.brand, selectedProduct.model].filter(Boolean).join(' · ')}
                  {selectedProduct.category && (
                    <span
                      className="ml-2 inline-flex items-center gap-1"
                      style={{ color: selectedProduct.category.color || '#9ca3af' }}
                    >
                      ● {selectedProduct.category.name}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearProduct}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div ref={containerRef} className="relative">
              {/* Filters row */}
              <div className="flex gap-2 mb-2">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setDropdownOpen(true)
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="Buscar por nombre o marca..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Dropdown results */}
              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg bg-gray-900 border border-gray-700 shadow-xl">
                  {filteredProducts.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-500">Sin resultados</p>
                  ) : (
                    filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProduct(product)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-100 truncate">{product.name}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {[product.brand, product.model].filter(Boolean).join(' · ') || 'Sin marca'}
                            {product.category && (
                              <span
                                className="ml-2"
                                style={{ color: product.category.color || '#9ca3af' }}
                              >
                                ● {product.category.name}
                              </span>
                            )}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Hidden input for react-hook-form */}
          <input type="hidden" {...register('productId')} value={productIdValue || ''} />
          {errors.productId && (
            <p className="text-red-400 text-sm mt-1">{errors.productId.message}</p>
          )}
        </div>

        {/* ── Tipo ───────────────────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Tipo
          </label>
          <select
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            {...register('type')}
          >
            <option value="UNIT">Unidad</option>
            <option value="CONTAINER">Contenedor (Flight Case)</option>
          </select>
        </div>

        <Input
          label="Número de Serie"
          placeholder="SN-2024-001"
          error={errors.serialNumber?.message}
          {...register('serialNumber')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Estado
          </label>
          <select
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            {...register('status')}
          >
            <option value="IN">En Bodega</option>
            <option value="OUT">Afuera</option>
            <option value="MAINTENANCE">Mantenimiento</option>
            <option value="LOST">Perdido</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Condición
          </label>
          <select
            className={cn(
              'w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500'
            )}
            {...register('condition')}
          >
            <option value="">Seleccionar...</option>
            <option value="Excelente">Excelente</option>
            <option value="Bueno">Bueno</option>
            <option value="Regular">Regular</option>
            <option value="Malo">Malo</option>
          </select>
        </div>

        <Input
          label="Ubicación"
          placeholder="Bodega A - Estante 3"
          error={errors.location?.message}
          {...register('location')}
        />

        {selectedType === 'UNIT' && containers.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Contenedor
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              {...register('containerId')}
            >
              <option value="">Sin contenedor</option>
              {containers.map((cont) => (
                <option key={cont.id} value={cont.id}>
                  {cont.serialNumber || cont.id.slice(-8)}
                </option>
              ))}
            </select>
          </div>
        )}

        <Input
          label="Fecha de Compra"
          type="date"
          error={errors.purchaseDate?.message}
          {...register('purchaseDate')}
        />

        <Input
          label="Precio de Compra"
          type="number"
          placeholder="500000"
          error={errors.purchasePrice?.message}
          {...register('purchasePrice', { valueAsNumber: true })}
        />

        <Input
          label="Vencimiento Garantía"
          type="date"
          error={errors.warrantyExpiry?.message}
          {...register('warrantyExpiry')}
        />
      </div>

      <Textarea
        label="Notas"
        placeholder="Notas sobre el item..."
        rows={3}
        error={errors.notes?.message}
        {...register('notes')}
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {item ? 'Actualizar Item' : 'Crear Item'}
        </Button>
      </div>
    </form>
  )
}
