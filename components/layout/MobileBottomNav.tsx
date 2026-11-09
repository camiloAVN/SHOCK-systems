'use client'

/**
 * Mobile bottom navigation — adapted from the 21st.dev "Bottom Nav Bar"
 * (pill layout + animated label on the active tab, Framer Motion).
 * Wired to Next routing, SHOCK permissions and brand colors.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { LayoutDashboard, Boxes, FolderKanban, FileText, Menu, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { usePermissions } from '@/hooks/usePermissions'
import { isNavActive, resolveHref, NavItem } from '@/components/layout/nav-config'

const TABS: (NavItem & { icon: LucideIcon })[] = [
  { name: 'Inicio', href: '/dashboard', icon: LayoutDashboard, modules: ['dashboard'] },
  { name: 'Equipos', href: '/dashboard/inventario/productos', icon: Boxes, modules: ['productos', 'items'], matches: ['/dashboard/inventario/items'], fallbackHref: '/dashboard/inventario/items' },
  { name: 'Proyectos', href: '/dashboard/proyectos', icon: FolderKanban, modules: ['proyectos'] },
  { name: 'Cotizar', href: '/dashboard/cotizaciones', icon: FileText, modules: ['cotizaciones'] },
]

const LABEL_WIDTH = 68

export function MobileBottomNav({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname()
  const { canView, isLoading } = usePermissions()

  const tabs = isLoading
    ? []
    : TABS.filter((t) => !t.modules || t.modules.some((m) => canView(m))).map((t) => ({ ...t, href: resolveHref(t, canView) }))

  const renderTab = (label: string, Icon: LucideIcon, active: boolean, content: (inner: React.ReactNode) => React.ReactNode) =>
    content(
      <>
        <Icon size={22} strokeWidth={2} aria-hidden className="shrink-0" />
        <motion.span
          initial={false}
          animate={{ width: active ? LABEL_WIDTH : 0, opacity: active ? 1 : 0, marginLeft: active ? 6 : 0 }}
          transition={{ width: { type: 'spring', stiffness: 350, damping: 32 }, opacity: { duration: 0.18 } }}
          className="overflow-hidden whitespace-nowrap text-[13px] font-semibold"
        >
          {label}
        </motion.span>
      </>
    )

  const tabClass = (active: boolean) =>
    cn(
      'flex h-11 min-w-[44px] items-center justify-center rounded-full px-3 transition-colors',
      active ? 'bg-orange-500/15 text-orange-400' : 'text-gray-400 active:bg-white/5'
    )

  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3 lg:hidden">
      <motion.nav
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        aria-label="Navegación rápida"
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#141414]/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl"
      >
        {tabs.map((tab) => {
          const active = isNavActive(pathname, tab)
          return renderTab(tab.name, tab.icon, active, (inner) => (
            <motion.div key={tab.href} whileTap={{ scale: 0.94 }}>
              <Link href={tab.href} aria-label={tab.name} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
                {inner}
              </Link>
            </motion.div>
          ))
        })}
        {renderTab('Menú', Menu, false, (inner) => (
          <motion.button key="menu" whileTap={{ scale: 0.94 }} onClick={onMenuClick} aria-label="Abrir menú completo" className={tabClass(false)}>
            {inner}
          </motion.button>
        ))}
      </motion.nav>
    </div>
  )
}
