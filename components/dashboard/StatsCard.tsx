'use client'

/**
 * KPI tile — inspired by the 21st.dev "Stat Card" (count-up value + trend),
 * restyled with SHOCK's dark/orange palette. Optional `href` makes it a shortcut.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { animate } from 'framer-motion'
import { ArrowUpRight, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  description?: string
  iconColor?: string
  iconBgColor?: string
  href?: string
  loading?: boolean
}

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const controls = animate(prev.current, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => {
        node.textContent = Math.round(v).toLocaleString('es-CO')
      },
    })
    prev.current = value
    return () => controls.stop()
  }, [value])
  return <span ref={ref}>0</span>
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
  iconColor = 'text-orange-400',
  iconBgColor = 'bg-orange-500/10',
  href,
  loading,
}: StatsCardProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const body = (
    <div
      className={cn(
        'group relative h-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-4 transition-all duration-200 sm:p-5',
        href && 'hover:-translate-y-0.5 hover:border-orange-500/30 hover:bg-[#171717]'
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-orange-500/[0.06] blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11', iconBgColor)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        {href && (
          <ArrowUpRight className="h-4 w-4 text-gray-600 transition-colors group-hover:text-orange-400" />
        )}
      </div>
      <p className="relative mt-3 text-[13px] font-medium text-gray-400 sm:text-sm">{title}</p>
      <p className="relative mt-0.5 text-2xl font-bold tracking-tight text-gray-50 sm:text-3xl">
        {loading ? (
          <span className="inline-block h-8 w-16 animate-pulse rounded-md bg-white/[0.06] align-middle" />
        ) : typeof value === 'number' && mounted ? (
          <CountUp value={value} />
        ) : (
          value
        )}
      </p>
      {trend && (
        <p className="relative mt-1 text-xs">
          <span className={cn('font-medium', trend.isPositive ? 'text-green-400' : 'text-red-400')}>
            {trend.isPositive ? '+' : ''}
            {trend.value}%
          </span>
          <span className="ml-1 text-gray-500">vs mes anterior</span>
        </p>
      )}
      {description && !trend && <p className="relative mt-1 text-xs text-gray-500">{description}</p>}
    </div>
  )

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  )
}
