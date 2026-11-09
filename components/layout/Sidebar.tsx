'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { LogOut, X, Shield, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { navSections, isNavActive, resolveHref, NavItem } from '@/components/layout/nav-config'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function useVisibleNav() {
  const { canView, isAdmin, isSuperAdmin, isLoading } = usePermissions()
  const visible = (item: NavItem) => {
    if (item.adminOnly) return isAdmin
    if (!item.modules || item.modules.length === 0) return true
    return item.modules.some((m) => canView(m))
  }
  const sections = navSections
    .map((s) => ({
      ...s,
      items: s.items.filter(visible).map((i) => ({ ...i, href: resolveHref(i, canView) })),
    }))
    .filter((s) => s.items.length > 0)
  return { sections, isLoading, isSuperAdmin }
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { sections, isLoading, isSuperAdmin } = useVisibleNav()

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 flex h-[100dvh] w-[18rem] flex-col border-r border-white/[0.06] bg-[#0d0d0d] transition-transform duration-300 ease-out lg:w-64 lg:translate-x-0',
          isOpen ? 'translate-x-0 shadow-2xl shadow-black' : '-translate-x-full'
        )}
        aria-label="Navegación principal"
      >
        {/* Logo */}
        <div className="relative flex h-24 shrink-0 items-center justify-center px-5">
          <Link href="/dashboard" onClick={onClose} className="flex items-center" aria-label="Ir al inicio">
            <Image
              src="/images/logo_shock_trim.png"
              alt="SHOCK Producciones"
              width={420}
              height={174}
              priority
              className="h-[68px] w-auto object-contain drop-shadow-[0_0_18px_rgba(245,146,10,0.18)]"
            />
          </Link>
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {isLoading ? (
            <div className="space-y-2 px-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-white/[0.04]" />
              ))}
            </div>
          ) : (
            sections.map((section, sIdx) => (
              <div key={section.title} className={cn(sIdx > 0 && 'mt-5')}>
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isNavActive(pathname, item)
                    const Icon = item.icon
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          title={item.hint}
                          className={cn(
                            'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors lg:text-sm',
                            active ? 'text-white' : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-100'
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="sidebar-active"
                              className="absolute inset-0 rounded-lg border border-orange-500/25 bg-gradient-to-r from-orange-500/15 to-orange-500/[0.03]"
                              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            />
                          )}
                          {active && (
                            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-orange-500" />
                          )}
                          <Icon
                            className={cn(
                              'relative h-[18px] w-[18px] shrink-0 transition-colors',
                              active ? 'text-orange-400' : 'text-gray-500 group-hover:text-gray-300'
                            )}
                          />
                          <span className="relative truncate">{item.name}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </nav>

        {/* User */}
        <div className="safe-bottom shrink-0 border-t border-white/[0.06] p-3">
          <Link
            href="/dashboard/perfil"
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.04]',
              pathname === '/dashboard/perfil' && 'bg-white/[0.04]'
            )}
          >
            <UserAvatar
              src={user?.image}
              name={user?.name}
              email={user?.email}
              size="md"
              className={cn('h-10 w-10', isSuperAdmin && 'ring-2 ring-red-500/60')}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-medium text-gray-100">
                {user?.name || 'Usuario'}
                {isSuperAdmin && <Shield className="h-3 w-3 text-red-400" />}
              </p>
              <p className="truncate text-xs text-gray-500">{user?.email}</p>
            </div>
            <UserCircle className="h-4 w-4 text-gray-500" />
          </Link>
          <button
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
