import { CheckCircle2, ArrowUpFromLine, Wrench, XCircle, LucideIcon } from 'lucide-react'

export type ItemStatus = 'IN' | 'OUT' | 'MAINTENANCE' | 'LOST'

export const ITEM_STATUSES: ItemStatus[] = ['IN', 'OUT', 'MAINTENANCE', 'LOST']

export const itemStatusConfig: Record<
  ItemStatus,
  { label: string; short: string; badge: string; bar: string; dot: string; icon: LucideIcon }
> = {
  IN: {
    label: 'En bodega',
    short: 'Disponibles',
    badge: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20',
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-400',
    icon: CheckCircle2,
  },
  OUT: {
    label: 'Afuera',
    short: 'Afuera',
    badge: 'bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-500/20',
    bar: 'bg-sky-500',
    dot: 'bg-sky-400',
    icon: ArrowUpFromLine,
  },
  MAINTENANCE: {
    label: 'Mantenimiento',
    short: 'Mantenim.',
    badge: 'bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/20',
    bar: 'bg-amber-500',
    dot: 'bg-amber-400',
    icon: Wrench,
  },
  LOST: {
    label: 'Perdido',
    short: 'Perdidos',
    badge: 'bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20',
    bar: 'bg-red-500',
    dot: 'bg-red-400',
    icon: XCircle,
  },
}

export const formatCOP = (price: number | string | null | undefined) => {
  if (price === null || price === undefined || price === '') return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number(price))
}
