'use client'

import { Menu } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

interface DashboardHeaderProps {
  onMenuClick?: () => void
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const pathname = usePathname()

  // Generate breadcrumbs from pathname
  const generateBreadcrumbs = () => {
    const segments = pathname?.split('/').filter(Boolean) || []
    const breadcrumbs = [{ label: 'Dashboard', href: '/dashboard' }]

    if (segments.length > 1) {
      const labels: Record<string, string> = {
        proyectos: 'Proyectos',
        clientes: 'Clientes',
        cotizaciones: 'Cotizaciones',
        nuevo: 'Nuevo',
        editar: 'Editar',
      }

      for (let i = 1; i < segments.length; i++) {
        const segment = segments[i]
        // Skip IDs (cuid format)
        if (segment.length > 15 && segment.match(/^[a-z0-9]+$/i)) {
          breadcrumbs.push({ label: 'Detalle', href: '' })
        } else {
          const label = labels[segment] || segment
          const href = '/' + segments.slice(0, i + 1).join('/')
          breadcrumbs.push({ label, href })
        }
      }
    }

    return breadcrumbs
  }

  const breadcrumbs = generateBreadcrumbs()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 sm:gap-4 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm px-3 sm:px-6">
      {/* Mobile menu button */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors shrink-0"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-sm overflow-x-auto whitespace-nowrap scrollbar-none min-w-0">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.href || index} className="flex items-center">
            {index > 0 && (
              <span className="mx-2 text-gray-600">/</span>
            )}
            {index === breadcrumbs.length - 1 ? (
              <span className="text-gray-400 font-medium">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-gray-500 hover:text-orange-400 transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side actions (can add notifications, search, etc.) */}
      <div className="flex items-center gap-2">
        {/* Placeholder for future features */}
      </div>
    </header>
  )
}
