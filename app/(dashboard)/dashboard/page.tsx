import { Metadata } from 'next'
import { DashboardHome } from '@/components/dashboard/DashboardHome'

export const metadata: Metadata = {
  title: 'Inicio - SHOCK',
  description: 'Panel de administración de SHOCK Systems',
}

export default function DashboardPage() {
  return <DashboardHome />
}
