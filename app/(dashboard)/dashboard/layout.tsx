'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { RouteGuard } from '@/components/auth/RouteGuard'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Close the drawer whenever the route changes
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <div className="dashboard-bg flex min-h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="min-w-0 flex-1 lg:pl-64">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="dashboard-main pb-bottom-nav mx-auto w-full max-w-[1600px] px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
          <RouteGuard>{children}</RouteGuard>
        </main>
      </div>

      <MobileBottomNav onMenuClick={() => setSidebarOpen(true)} />
    </div>
  )
}
