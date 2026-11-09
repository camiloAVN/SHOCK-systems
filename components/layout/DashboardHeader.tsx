'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Menu } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { segmentLabels } from '@/components/layout/nav-config'
import { UserAvatar } from '@/components/ui/UserAvatar'

interface DashboardHeaderProps {
  onMenuClick?: () => void
}

// Segments that have no page of their own (not linkable in breadcrumbs)
const NON_LINKABLE = new Set(['terceros'])

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const pathname = usePathname()
  const { user } = useAuth()

  const segments = pathname?.split('/').filter(Boolean) || []
  const breadcrumbs: { label: string; href: string }[] = [{ label: 'Inicio', href: '/dashboard' }]
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i]
    const isId = segment.length > 15 && /^[a-z0-9_-]+$/i.test(segment)
    const href = '/' + segments.slice(0, i + 1).join('/')
    breadcrumbs.push({
      label: isId ? 'Detalle' : segmentLabels[segment] || segment,
      href: isId || NON_LINKABLE.has(segment) ? '' : href,
    })
  }
  const current = breadcrumbs[breadcrumbs.length - 1]

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-[#0a0a0a]/80 px-3 backdrop-blur-xl sm:px-6">
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="shrink-0 rounded-lg p-2 text-gray-300 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6" />
        </button>
      )}

      {/* Mobile: logo + current section */}
      <Link href="/dashboard" className="shrink-0 lg:hidden" aria-label="Inicio">
        <Image src="/images/logo_shock_trim.png" alt="SHOCK" width={420} height={174} className="h-9 w-auto" />
      </Link>
      <span className="truncate text-sm font-medium text-gray-300 sm:hidden">
        {breadcrumbs.length > 1 ? current.label : ''}
      </span>

      {/* Breadcrumbs (tablet/desktop) */}
      <nav aria-label="Ruta" className="hidden min-w-0 items-center overflow-x-auto whitespace-nowrap text-sm scrollbar-none sm:flex">
        {breadcrumbs.map((crumb, index) => {
          const last = index === breadcrumbs.length - 1
          return (
            <div key={index} className="flex items-center">
              {index > 0 && <ChevronRight className="mx-1.5 h-3.5 w-3.5 text-gray-600" />}
              {last || !crumb.href ? (
                <span className={last ? 'font-medium text-gray-100' : 'text-gray-500'}>{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="text-gray-500 transition-colors hover:text-orange-400">
                  {crumb.label}
                </Link>
              )}
            </div>
          )
        })}
      </nav>

      <div className="flex-1" />

      <Link
        href="/dashboard/perfil"
        className="hidden items-center gap-2 rounded-full border border-white/[0.06] py-1 pl-1 pr-3 text-sm text-gray-300 transition-colors hover:border-orange-500/30 hover:text-white sm:flex"
      >
        <UserAvatar src={user?.image} name={user?.name} email={user?.email} size="xs" />
        <span className="max-w-[10rem] truncate">{user?.name?.split(' ')[0] || 'Mi perfil'}</span>
      </Link>
    </header>
  )
}
