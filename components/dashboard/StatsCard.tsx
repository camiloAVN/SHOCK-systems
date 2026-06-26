import { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
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
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
  iconColor = 'text-orange-400',
  iconBgColor = 'bg-orange-500/10',
}: StatsCardProps) {
  return (
    <Card variant="glass" className="p-6 hover:border-orange-500/40 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-100 mb-2">{value}</p>

          {trend && (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  'text-sm font-medium',
                  trend.isPositive ? 'text-green-400' : 'text-red-400'
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-gray-500">vs mes anterior</span>
            </div>
          )}

          {description && !trend && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>

        <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', iconBgColor)}>
          <Icon className={cn('w-6 h-6', iconColor)} />
        </div>
      </div>
    </Card>
  )
}
