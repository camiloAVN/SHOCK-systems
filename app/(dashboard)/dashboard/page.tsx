import { Metadata } from 'next'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import {
  FolderKanban,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Dashboard - SHOCK',
  description: 'Panel de administración de SHOCK Systems',
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold mb-2">
          Bienvenido al <span className="text-gradient">Dashboard</span>
        </h1>
        <p className="text-gray-400">
          Resumen de tu actividad y métricas principales
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Proyectos Activos"
          value={12}
          icon={FolderKanban}
          trend={{ value: 8.2, isPositive: true }}
          iconColor="text-orange-400"
          iconBgColor="bg-orange-500/10"
        />

        <StatsCard
          title="Clientes Totales"
          value={48}
          icon={Users}
          trend={{ value: 12.5, isPositive: true }}
          iconColor="text-blue-400"
          iconBgColor="bg-blue-500/10"
        />

        <StatsCard
          title="Cotizaciones"
          value={23}
          icon={FileText}
          trend={{ value: -3.2, isPositive: false }}
          iconColor="text-amber-400"
          iconBgColor="bg-amber-500/10"
        />

        <StatsCard
          title="Ingresos del Mes"
          value="$2.4M"
          icon={DollarSign}
          trend={{ value: 15.8, isPositive: true }}
          iconColor="text-green-400"
          iconBgColor="bg-green-500/10"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <RecentActivity />

          {/* Projects by Status */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Proyectos por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: 'En Progreso', value: 5, color: 'bg-orange-500', percentage: 42 },
                  { label: 'Prospecto', value: 4, color: 'bg-blue-500', percentage: 33 },
                  { label: 'En Pausa', value: 2, color: 'bg-amber-500', percentage: 17 },
                  { label: 'Completados', value: 1, color: 'bg-green-500', percentage: 8 },
                ].map((status) => (
                  <div key={status.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-300">
                        {status.label}
                      </span>
                      <span className="text-sm text-gray-400">{status.value} proyectos</span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${status.color} transition-all duration-300`}
                        style={{ width: `${status.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Quick Actions & Stats */}
        <div className="space-y-6">
          <QuickActions />

          {/* Additional Stats */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Métricas Adicionales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-200">Tasa de Éxito</p>
                    <p className="text-2xl font-bold text-green-400">94%</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-200">Tiempo Promedio</p>
                    <p className="text-2xl font-bold text-amber-400">4.2 meses</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-200">Satisfacción</p>
                    <p className="text-2xl font-bold text-blue-400">4.8/5.0</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
