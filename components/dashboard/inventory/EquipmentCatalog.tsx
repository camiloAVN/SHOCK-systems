'use client'

/**
 * Unified "Equipos" view.
 *
 *  PRODUCTO  = the catalog model (e.g. "Shure SM58"): name, brand, price, photo.
 *  UNIDAD    = each physical piece of that product (InventoryItem): serial,
 *              status, location, RFID.
 *
 * "Por producto" shows every product with its availability and lets you unfold
 * its units in place. "Todas las unidades" is the flat list of physical items.
 * Purely presentational — uses the existing /api/products and /api/inventory.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Boxes,
  ChevronDown,
  Edit,
  Eye,
  Info,
  MapPin,
  Package,
  Plus,
  Radio,
  Search,
  Tag,
  Trash2,
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  LayoutList,
  Layers,
} from 'lucide-react'
import { useProducts } from '@/hooks/useProducts'
import { useInventory } from '@/hooks/useInventory'
import { useCategories } from '@/hooks/useCategories'
import { usePermissions } from '@/hooks/usePermissions'
import { Product } from '@/lib/validations/product'
import { InventoryItem } from '@/lib/validations/inventory'
import { Button } from '@/components/ui/Button'
import { ProductThumbnail } from '@/components/ui/ProductThumbnail'
import { ProductPanoramaButton } from '@/components/locations/ProductPanoramaButton'
import { PanoramaLocationModal } from '@/components/locations/PanoramaLocationModal'
import { InventoryItemsTable } from '@/components/dashboard/inventory/InventoryItemsTable'
import { cn } from '@/lib/utils/cn'
import { ITEM_STATUSES, ItemStatus, itemStatusConfig, formatCOP } from './status'

type View = 'productos' | 'unidades'

const EXPLAINER_KEY = 'shock:equipos-explainer-hidden'

function unitLabel(item: InventoryItem) {
  return item.serialNumber || item.assetTag || `#${item.id.slice(-6).toUpperCase()}`
}

/* ───────────────────────────── Availability bar ───────────────────────────── */

function AvailabilityBar({ counts, total }: { counts: Record<ItemStatus, number>; total: number }) {
  if (total === 0) {
    return <div className="stack-bar" title="Sin unidades registradas" />
  }
  return (
    <div className="stack-bar" role="img" aria-label="Distribución de unidades por estado">
      {ITEM_STATUSES.map((s) =>
        counts[s] > 0 ? (
          <span
            key={s}
            className={itemStatusConfig[s].bar}
            style={{ width: `${(counts[s] / total) * 100}%` }}
            title={`${itemStatusConfig[s].label}: ${counts[s]}`}
          />
        ) : null
      )}
    </div>
  )
}

/* ───────────────────────────── Unit row (nested) ───────────────────────────── */

function UnitRow({
  item,
  canEdit,
  onCheckIn,
  onCheckOut,
  onView360,
}: {
  item: InventoryItem
  canEdit: boolean
  onCheckIn: (id: string) => void
  onCheckOut: (id: string) => void
  onView360: (locationId: string) => void
}) {
  const st = itemStatusConfig[item.status]
  return (
    <li className="group relative flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-black/30 p-3 transition-colors hover:border-white/[0.12] sm:flex-row sm:items-center sm:gap-4">
      {/* connector */}
      <span className="pointer-events-none absolute -left-[17px] top-1/2 hidden h-px w-4 bg-white/10 sm:block" />

      <Link href={`/dashboard/inventario/items/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-gray-400">
          <Tag className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-mono text-[15px] font-semibold text-gray-100 group-hover:text-orange-300 sm:text-sm">
            {unitLabel(item)}
          </span>
          <span className="flex items-center gap-1 truncate text-xs text-gray-500">
            <MapPin className="h-3 w-3 shrink-0" />
            {item.location || 'Sin ubicación'}
          </span>
        </span>
      </Link>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', st.badge)}>
          <st.icon className="h-3 w-3" />
          {st.label}
        </span>
        {item.type === 'CONTAINER' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-400 ring-1 ring-inset ring-cyan-500/20">
            <Boxes className="h-3 w-3" />
            Contenedor{item.containerQuantity != null ? ` · ${item.containerQuantity}` : ''}
          </span>
        )}
        {item.rfidTag && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-gray-300">
            <Radio className="h-3 w-3" />
            RFID
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-white/[0.05] pt-2 sm:border-0 sm:pt-0">
        {canEdit && item.status !== 'IN' && (
          <Button variant="ghost" size="sm" className="text-emerald-400 hover:bg-emerald-500/10" onClick={() => onCheckIn(item.id)} title="Registrar entrada">
            <ArrowDownToLine className="h-4 w-4 sm:mr-0" />
            <span className="ml-1.5 sm:hidden">Entrada</span>
          </Button>
        )}
        {canEdit && item.status === 'IN' && (
          <Button variant="ghost" size="sm" className="text-sky-400 hover:bg-sky-500/10" onClick={() => onCheckOut(item.id)} title="Registrar salida">
            <ArrowUpFromLine className="h-4 w-4" />
            <span className="ml-1.5 sm:hidden">Salida</span>
          </Button>
        )}
        {item.locationId && (
          <Button variant="ghost" size="sm" className="text-orange-300 hover:bg-orange-500/10" onClick={() => onView360(item.locationId!)} title="Ver ubicación 360°">
            <MapPin className="h-4 w-4" />
            <span className="ml-1.5 sm:hidden">360°</span>
          </Button>
        )}
        <Link href={`/dashboard/inventario/items/${item.id}`} className="ml-auto sm:ml-0">
          <Button variant="ghost" size="sm" title="Ver unidad">
            <Eye className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </li>
  )
}

/* ───────────────────────────── Product card ───────────────────────────── */

function ProductGroup({
  product,
  units,
  totalUnits,
  expanded,
  onToggle,
  canEditProducts,
  canEditItems,
  onDelete,
  onCheckIn,
  onCheckOut,
  onView360,
  highlight,
}: {
  product: Product
  units: InventoryItem[]
  totalUnits: number
  expanded: boolean
  onToggle: () => void
  canEditProducts: boolean
  canEditItems: boolean
  onDelete: (id: string) => void
  onCheckIn: (id: string) => void
  onCheckOut: (id: string) => void
  onView360: (locationId: string) => void
  highlight?: boolean
}) {
  const counts = useMemo(() => {
    const c: Record<ItemStatus, number> = { IN: 0, OUT: 0, MAINTENANCE: 0, LOST: 0 }
    units.forEach((u) => (c[u.status] += 1))
    return c
  }, [units])
  const known = units.length
  const total = Math.max(totalUnits, known)

  return (
    <motion.li
      layout="position"
      id={`producto-${product.id}`}
      className={cn(
        'overflow-hidden rounded-2xl border bg-[#141414]/80 transition-colors',
        expanded ? 'border-orange-500/25' : 'border-white/[0.07] hover:border-white/[0.14]',
        highlight && 'ring-2 ring-orange-500/50'
      )}
    >
      {/* Header row */}
      <div className="flex flex-col gap-3 p-3 sm:p-4 md:flex-row md:items-center md:gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <div className="shrink-0">
            <ProductThumbnail imageUrl={product.imageUrl} productName={product.name} size="md" />
          </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
                Producto
              </span>
              {product.status === 'INACTIVE' && (
                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Inactivo
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-base font-semibold text-gray-50 sm:text-[17px]">{product.name}</p>
            <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-gray-400">
              {[product.brand, product.model].filter(Boolean).join(' · ') || 'Sin marca'}
              {product.category && (
                <span className="inline-flex items-center gap-1.5 text-gray-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: product.category.color || '#6b7280' }} />
                  {product.category.name}
                </span>
              )}
            </p>
          </div>
          <ChevronDown
            className={cn('h-5 w-5 shrink-0 text-gray-500 transition-transform md:hidden', expanded && 'rotate-180 text-orange-400')}
          />
        </button>
        </div>

        {/* Availability */}
        <button type="button" onClick={onToggle} className="w-full text-left md:w-60 md:shrink-0">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="text-gray-300">
              <span className="text-lg font-bold text-emerald-400">{counts.IN}</span>
              <span className="text-gray-500"> / {total} disponibles</span>
            </span>
            <span className="text-xs text-gray-500">{total === 1 ? '1 unidad' : `${total} unidades`}</span>
          </div>
          <AvailabilityBar counts={counts} total={known} />
          {(counts.OUT > 0 || counts.MAINTENANCE > 0 || counts.LOST > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
              {(['OUT', 'MAINTENANCE', 'LOST'] as ItemStatus[]).map((s) =>
                counts[s] > 0 ? (
                  <span key={s} className="inline-flex items-center gap-1">
                    <span className={cn('h-1.5 w-1.5 rounded-full', itemStatusConfig[s].dot)} />
                    {counts[s]} {itemStatusConfig[s].label.toLowerCase()}
                  </span>
                ) : null
              )}
            </div>
          )}
        </button>

        {/* Price + actions */}
        <div className="flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3 md:w-auto md:border-0 md:pt-0">
          <div className="md:w-28 md:text-right">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Alquiler</p>
            <p className="text-sm font-semibold text-gray-100">{formatCOP(product.rentalPrice)}</p>
          </div>
          <div className="flex items-center gap-0.5">
            <ProductPanoramaButton productId={product.id} productName={product.name} iconOnly />
            <Link href={`/dashboard/inventario/productos/${product.id}`}>
              <Button variant="ghost" size="sm" title="Ver ficha del producto">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            {canEditProducts && (
              <>
                <Link href={`/dashboard/inventario/productos/${product.id}/editar`}>
                  <Button variant="ghost" size="sm" title="Editar producto">
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  title="Eliminar producto"
                  onClick={() => {
                    if (confirm(`¿Eliminar el producto "${product.name}"?`)) onDelete(product.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            <button
              type="button"
              onClick={onToggle}
              aria-label={expanded ? 'Ocultar unidades' : 'Ver unidades'}
              className="ml-1 hidden h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/[0.07] hover:text-white md:flex"
            >
              <ChevronDown className={cn('h-5 w-5 transition-transform', expanded && 'rotate-180 text-orange-400')} />
            </button>
          </div>
        </div>
      </div>

      {/* Units */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="border-t border-white/[0.06] bg-black/20 px-3 pb-4 pt-3 sm:px-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Unidades físicas de este producto
                </p>
                {canEditItems && (
                  <Link href={`/dashboard/inventario/items/nuevo?productId=${product.id}`}>
                    <Button variant="ghost" size="sm" className="text-orange-400 hover:bg-orange-500/10">
                      <Plus className="mr-1 h-4 w-4" />
                      Agregar unidad
                    </Button>
                  </Link>
                )}
              </div>
              {units.length > 0 ? (
                <ul className="space-y-2 sm:ml-4 sm:border-l sm:border-white/10 sm:pl-4">
                  {units.map((u) => (
                    <UnitRow
                      key={u.id}
                      item={u}
                      canEdit={canEditItems}
                      onCheckIn={onCheckIn}
                      onCheckOut={onCheckOut}
                      onView360={onView360}
                    />
                  ))}
                </ul>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center">
                  <p className="text-sm text-gray-400">
                    {totalUnits > 0
                      ? 'Ninguna unidad coincide con el filtro actual.'
                      : 'Este producto aún no tiene unidades físicas registradas.'}
                  </p>
                  {canEditItems && totalUnits === 0 && (
                    <Link href={`/dashboard/inventario/items/nuevo?productId=${product.id}`}>
                      <Button variant="outline" size="sm" className="mt-3">
                        <Plus className="mr-1 h-4 w-4" />
                        Registrar primera unidad
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

/* ───────────────────────────── Main component ───────────────────────────── */

export function EquipmentCatalog({ defaultView = 'productos' }: { defaultView?: View }) {
  const { products, fetchProducts, deleteProduct } = useProducts()
  const { items, fetchItems, deleteItem, checkIn, checkOut } = useInventory()
  const { categories, fetchCategories } = useCategories()
  const { canEdit, canView } = usePermissions()

  const [view, setView] = useState<View>(defaultView)
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [statusFilter, setStatusFilter] = useState<ItemStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<'' | 'UNIT' | 'CONTAINER'>('')
  const [showInactive, setShowInactive] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [focusProductId, setFocusProductId] = useState<string | null>(null)
  const [view360, setView360] = useState<string | null>(null)
  const [explainerHidden, setExplainerHidden] = useState(true)
  const scrolledRef = useRef(false)

  const canEditProducts = canEdit('productos')
  const canEditItems = canEdit('items')
  const canSeeItems = canView('items')

  // Initial load + URL params (?productId=…&vista=unidades)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const pid = params.get('productId')
      const vista = params.get('vista')
      if (vista === 'unidades' || vista === 'productos') setView(vista)
      if (pid) {
        setFocusProductId(pid)
        setExpanded(new Set([pid]))
        setView('productos')
      }
    } catch {}
    try {
      setExplainerHidden(localStorage.getItem(EXPLAINER_KEY) === '1')
    } catch {
      setExplainerHidden(false)
    }
    fetchCategories()
    Promise.all([fetchProducts({ silent: true }), fetchItems({ silent: true })]).finally(() => setLoaded(true))
  }, [fetchCategories, fetchProducts, fetchItems])

  // Scroll to focused product once data is there
  useEffect(() => {
    if (!loaded || !focusProductId || scrolledRef.current) return
    scrolledRef.current = true
    requestAnimationFrame(() => {
      document.getElementById(`producto-${focusProductId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [loaded, focusProductId])

  const changeView = (v: View) => {
    setView(v)
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('vista', v)
      url.searchParams.delete('productId')
      window.history.replaceState(null, '', url.toString())
    } catch {}
  }

  const refreshItems = () => fetchItems({ silent: true })
  const handleCheckIn = async (id: string) => {
    if (await checkIn(id)) refreshItems()
  }
  const handleCheckOut = async (id: string) => {
    if (await checkOut(id)) refreshItems()
  }
  const handleDeleteProduct = async (id: string) => {
    if (await deleteProduct(id)) fetchProducts({ silent: true })
  }
  const handleDeleteItem = async (id: string) => {
    if (await deleteItem(id)) refreshItems()
  }

  // ── Derived data ──
  const q = query.trim().toLowerCase()

  const unitsByProduct = useMemo(() => {
    const map = new Map<string, InventoryItem[]>()
    items.forEach((it) => {
      const arr = map.get(it.productId)
      if (arr) arr.push(it)
      else map.set(it.productId, [it])
    })
    map.forEach((arr) => arr.sort((a, b) => unitLabel(a).localeCompare(unitLabel(b), 'es', { numeric: true })))
    return map
  }, [items])

  const unitMatches = (u: InventoryItem) => {
    if (statusFilter && u.status !== statusFilter) return false
    if (typeFilter && u.type !== typeFilter) return false
    if (!q) return true
    return [u.serialNumber, u.assetTag, u.location, u.rfidTag?.epc].some((v) => v?.toLowerCase().includes(q))
  }

  const productRows = useMemo(() => {
    return products
      .filter((p) => (showInactive ? true : p.status === 'ACTIVE') || p.id === focusProductId)
      .filter((p) => !categoryId || p.categoryId === categoryId)
      .map((p) => {
        const all = unitsByProduct.get(p.id) ?? []
        const productMatches =
          !q || [p.name, p.brand, p.model, p.sku, p.category?.name].some((v) => v?.toLowerCase().includes(q))
        // When the product itself matches the text, show all its units (only status/type filters apply)
        const visibleUnits = all.filter((u) =>
          productMatches
            ? (!statusFilter || u.status === statusFilter) && (!typeFilter || u.type === typeFilter)
            : unitMatches(u)
        )
        const hasUnitFilter = !!statusFilter || !!typeFilter
        const include = productMatches ? !hasUnitFilter || visibleUnits.length > 0 : visibleUnits.length > 0
        return { product: p, all, visibleUnits, include, matchedByUnit: !productMatches && visibleUnits.length > 0 }
      })
      .filter((r) => r.include)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, unitsByProduct, q, categoryId, statusFilter, typeFilter, showInactive, focusProductId])

  const flatUnits = useMemo(() => {
    return items.filter((u) => {
      if (categoryId && u.product?.category?.id !== categoryId) return false
      if (statusFilter && u.status !== statusFilter) return false
      if (typeFilter && u.type !== typeFilter) return false
      if (!q) return true
      return [u.serialNumber, u.assetTag, u.location, u.product?.name, u.product?.brand, u.product?.model, u.rfidTag?.epc].some(
        (v) => v?.toLowerCase().includes(q)
      )
    })
  }, [items, q, categoryId, statusFilter, typeFilter])

  const globalCounts = useMemo(() => {
    const c: Record<ItemStatus, number> = { IN: 0, OUT: 0, MAINTENANCE: 0, LOST: 0 }
    items.forEach((u) => (c[u.status] += 1))
    return c
  }, [items])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allExpanded = productRows.length > 0 && productRows.every((r) => expanded.has(r.product.id))
  const filtersActive = !!q || !!categoryId || !!statusFilter || !!typeFilter

  const clearFilters = () => {
    setQuery('')
    setCategoryId('')
    setStatusFilter('')
    setTypeFilter('')
  }

  const hideExplainer = () => {
    setExplainerHidden(true)
    try {
      localStorage.setItem(EXPLAINER_KEY, '1')
    } catch {}
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            <span className="text-gradient">Equipos</span>
          </h1>
          <p className="mt-1 text-[15px] text-gray-400">
            Catálogo de productos y cada una de sus unidades físicas.
            {explainerHidden && (
              <button onClick={() => setExplainerHidden(false)} className="ml-2 inline-flex items-center gap-1 text-orange-400 hover:underline">
                <Info className="h-3.5 w-3.5" /> ¿Cómo funciona?
              </button>
            )}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {canEditProducts && (
            <Link href="/dashboard/inventario/productos/nuevo">
              <Button variant="secondary" className="w-full">
                <Package className="mr-2 h-4 w-4" />
                Nuevo producto
              </Button>
            </Link>
          )}
          {canEditItems && (
            <Link href="/dashboard/inventario/items/nuevo">
              <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Agregar unidad
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Explainer */}
      <AnimatePresence initial={false}>
        {!explainerHidden && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/[0.08] to-transparent p-4 sm:p-5">
              <button onClick={hideExplainer} className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Ocultar explicación">
                <X className="h-4 w-4" />
              </button>
              <div className="grid gap-4 pr-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
                    <Package className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-gray-100">Producto</p>
                    <p className="text-sm text-gray-400">
                      El <b className="text-gray-200">modelo</b> del catálogo: nombre, marca, foto y precio. Ej.: <i>Shure SM58</i>.
                    </p>
                  </div>
                </div>
                <div className="hidden text-2xl text-orange-500/60 sm:block">→</div>
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-gray-300">
                    <Tag className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-gray-100">Unidades (items)</p>
                    <p className="text-sm text-gray-400">
                      Cada <b className="text-gray-200">equipo físico</b> de ese producto, con su serie, estado, ubicación y RFID. Ej.: <i>SM58 #001, #002…</i>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status summary chips (also act as filter) */}
      {canSeeItems && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
          {ITEM_STATUSES.map((s) => {
            const cfg = itemStatusConfig[s]
            const active = statusFilter === s
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(active ? '' : s)}
                className={cn(
                  'flex min-w-[9.5rem] shrink-0 items-center gap-3 rounded-2xl border p-3 text-left transition-all sm:min-w-0',
                  active ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/[0.07] bg-[#141414]/80 hover:border-white/[0.15]'
                )}
                aria-pressed={active}
              >
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', cfg.badge)}>
                  <cfg.icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xl font-bold leading-none text-gray-50">{globalCounts[s]}</span>
                  <span className="text-xs text-gray-400">{cfg.label}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="sticky top-16 z-20 -mx-4 space-y-3 border-b border-white/[0.06] bg-[#0a0a0a]/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* View switch */}
          {canSeeItems && (
            <div className="relative grid shrink-0 grid-cols-2 rounded-xl bg-white/[0.05] p-1 text-sm font-medium">
              {(['productos', 'unidades'] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => changeView(v)}
                  className={cn('relative z-10 flex items-center justify-center gap-2 rounded-lg px-4 py-2 transition-colors', view === v ? 'text-white' : 'text-gray-400 hover:text-gray-200')}
                >
                  {view === v && (
                    <motion.span layoutId="equipos-view" className="absolute inset-0 -z-10 rounded-lg bg-orange-500/90 shadow-lg shadow-orange-500/20" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />
                  )}
                  {v === 'productos' ? <Layers className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
                  {v === 'productos' ? 'Por producto' : 'Todas las unidades'}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={view === 'productos' ? 'Buscar producto, marca, serie, ubicación…' : 'Buscar serie, producto, ubicación, RFID…'}
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-10 text-[15px] text-gray-100 placeholder:text-gray-500 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20 sm:h-10 sm:text-sm"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:text-white" aria-label="Limpiar búsqueda">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-11 rounded-xl border border-white/[0.08] bg-[#141414] px-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 sm:h-10"
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              className="h-11 rounded-xl border border-white/[0.08] bg-[#141414] px-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 sm:h-10"
            >
              <option value="">Unidad y contenedor</option>
              <option value="UNIT">Solo unidades</option>
              <option value="CONTAINER">Solo contenedores</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            {view === 'productos'
              ? `${productRows.length} producto${productRows.length === 1 ? '' : 's'}`
              : `${flatUnits.length} unidad${flatUnits.length === 1 ? '' : 'es'}`}
            {statusFilter && (
              <> · estado: <b className="text-gray-300">{itemStatusConfig[statusFilter].label}</b></>
            )}
          </span>
          <div className="flex items-center gap-3">
            {view === 'productos' && (
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-orange-500" />
                Mostrar inactivos
              </label>
            )}
            {view === 'productos' && productRows.length > 0 && canSeeItems && (
              <button
                onClick={() => setExpanded(allExpanded ? new Set() : new Set(productRows.map((r) => r.product.id)))}
                className="font-medium text-orange-400 hover:underline"
              >
                {allExpanded ? 'Contraer todo' : 'Expandir todo'}
              </button>
            )}
            {filtersActive && (
              <button onClick={clearFilters} className="font-medium text-gray-300 hover:text-white">
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {!loaded ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]" />
          ))}
        </div>
      ) : view === 'productos' ? (
        productRows.length === 0 ? (
          <EmptyState filtersActive={filtersActive} onClear={clearFilters} canCreate={canEditProducts} />
        ) : (
          <ul className="space-y-3">
            {productRows.map(({ product, all, visibleUnits, matchedByUnit }) => (
              <ProductGroup
                key={product.id}
                product={product}
                units={filtersActive ? visibleUnits : all}
                totalUnits={canSeeItems ? all.length : product._count?.inventoryItems ?? 0}
                expanded={expanded.has(product.id) || (matchedByUnit && !!q)}
                onToggle={() => toggle(product.id)}
                canEditProducts={canEditProducts}
                canEditItems={canEditItems}
                onDelete={handleDeleteProduct}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
                onView360={setView360}
                highlight={focusProductId === product.id}
              />
            ))}
          </ul>
        )
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-3 sm:p-4">
          <InventoryItemsTable items={flatUnits} onDelete={handleDeleteItem} onCheckIn={handleCheckIn} onCheckOut={handleCheckOut} />
        </div>
      )}

      <PanoramaLocationModal isOpen={!!view360} onClose={() => setView360(null)} locationId={view360} />
    </div>
  )
}

function EmptyState({ filtersActive, onClear, canCreate }: { filtersActive: boolean; onClear: () => void; canCreate: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
      <Package className="mx-auto mb-3 h-12 w-12 text-gray-600" />
      <p className="font-medium text-gray-300">{filtersActive ? 'Nada coincide con tu búsqueda' : 'Aún no hay productos'}</p>
      <p className="mt-1 text-sm text-gray-500">
        {filtersActive ? 'Prueba con otro término o limpia los filtros.' : 'Crea el primer producto y luego registra sus unidades.'}
      </p>
      <div className="mt-4">
        {filtersActive ? (
          <Button variant="secondary" size="sm" onClick={onClear}>
            Limpiar filtros
          </Button>
        ) : (
          canCreate && (
            <Link href="/dashboard/inventario/productos/nuevo">
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> Nuevo producto
              </Button>
            </Link>
          )
        )}
      </div>
    </div>
  )
}
