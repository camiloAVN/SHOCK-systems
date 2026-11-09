'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  FolderKanban,
  Users,
  FileText,
  Boxes,
  Plus,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ListTodo,
  Package,
  LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { SystemModule } from '@/lib/validations/user'
import { cn } from '@/lib/utils/cn'
import { ITEM_STATUSES, itemStatusConfig, formatCOP, ItemStatus } from '@/components/dashboard/inventory/status'

/* ── Minimal shapes of the existing API responses ── */
type ProjectRow = { id: string; title: string; status: string; priority: string; endDate: string | null; client?: { name: string; company?: string | null } }
type QuotationRow = { id: string; quotationNumber: string; title: string; status: string; total: string | number; createdAt: string; client?: { name: string; company?: string | null } }
type TaskRow = { id: string; title: string; status: string; priority: string; dueDate: string | null; completed: boolean; project?: { id: string; title: string } }
type Summary = { total: number; byStatus: Record<ItemStatus, number> }

const projectStatus: Record<string, { label: string; cls: string; bar: string }> = {
  PROSPECT: { label: 'Prospecto', cls: 'bg-sky-500/10 text-sky-400', bar: 'bg-sky-500' },
  IN_PROGRESS: { label: 'En progreso', cls: 'bg-orange-500/10 text-orange-400', bar: 'bg-orange-500' },
  ON_HOLD: { label: 'En pausa', cls: 'bg-amber-500/10 text-amber-300', bar: 'bg-amber-400' },
  COMPLETED: { label: 'Completado', cls: 'bg-emerald-500/10 text-emerald-400', bar: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelado', cls: 'bg-white/[0.06] text-gray-400', bar: 'bg-gray-500' },
}

const quotationStatus: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Borrador', cls: 'bg-white/[0.06] text-gray-300' },
  SENT: { label: 'Enviada', cls: 'bg-sky-500/10 text-sky-400' },
  ACCEPTED: { label: 'Aceptada', cls: 'bg-emerald-500/10 text-emerald-400' },
  REJECTED: { label: 'Rechazada', cls: 'bg-red-500/10 text-red-400' },
  EXPIRED: { label: 'Vencida', cls: 'bg-amber-500/10 text-amber-300' },
}

const priorityDot: Record<string, string> = {
  LOW: 'bg-gray-500',
  MEDIUM: 'bg-sky-400',
  HIGH: 'bg-orange-400',
  URGENT: 'bg-red-500',
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

function Panel({
  title,
  icon: Icon,
  href,
  hrefLabel = 'Ver todo',
  children,
  className,
}: {
  title: string
  icon: LucideIcon
  href?: string
  hrefLabel?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-4 sm:p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-100 sm:text-lg">
          <Icon className="h-[18px] w-[18px] text-orange-400" />
          {title}
        </h2>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-gray-400 transition-colors hover:text-orange-400">
            {hrefLabel} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-gray-500">{text}</p>
}

function SkeletonRows({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.03]" />
      ))}
    </div>
  )
}

export function DashboardHome() {
  const { user } = useAuth()
  const { canView, canEdit, isLoading: permsLoading } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<ProjectRow[] | null>(null)
  const [clients, setClients] = useState<unknown[] | null>(null)
  const [quotations, setQuotations] = useState<QuotationRow[] | null>(null)
  const [tasks, setTasks] = useState<TaskRow[] | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)

  const fetchedRef = useRef(false)
  useEffect(() => {
    if (permsLoading || fetchedRef.current) return
    fetchedRef.current = true
    const want = (m: SystemModule) => canView(m)
    Promise.all([
      want('proyectos') ? getJson<ProjectRow[]>('/api/projects') : null,
      want('clientes') ? getJson<unknown[]>('/api/clients') : null,
      want('cotizaciones') ? getJson<QuotationRow[]>('/api/quotations') : null,
      want('tareas') ? getJson<TaskRow[]>('/api/tasks?myTasks=true') : null,
      want('inventario') ? getJson<Summary>('/api/inventory/summary') : null,
    ]).then(([p, c, q, t, s]) => {
      setProjects(p)
      setClients(c)
      setQuotations(q)
      setTasks(t)
      setSummary(s)
      setLoading(false)
    })
  }, [permsLoading, canView])

  const firstName = user?.name?.split(' ')[0] || ''
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const today = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

  const projectCounts = useMemo(() => {
    const c: Record<string, number> = {}
    projects?.forEach((p) => (c[p.status] = (c[p.status] || 0) + 1))
    return c
  }, [projects])

  const openQuotations = quotations?.filter((q) => q.status === 'DRAFT' || q.status === 'SENT') ?? []
  const acceptedThisMonth = useMemo(() => {
    const now = new Date()
    return (quotations ?? [])
      .filter((q) => {
        const d = new Date(q.createdAt)
        return q.status === 'ACCEPTED' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((acc, q) => acc + Number(q.total || 0), 0)
  }, [quotations])

  const pendingTasks = (tasks ?? [])
    .filter((t) => t.status !== 'DONE' && !t.completed)
    .sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity))

  const quickActions = [
    { label: 'Nueva cotización', href: '/dashboard/cotizaciones/nuevo', icon: FileText, module: 'cotizaciones' as SystemModule },
    { label: 'Nuevo proyecto', href: '/dashboard/proyectos/nuevo', icon: FolderKanban, module: 'proyectos' as SystemModule },
    { label: 'Agregar unidad', href: '/dashboard/inventario/items/nuevo', icon: Boxes, module: 'items' as SystemModule },
    { label: 'Nuevo cliente', href: '/dashboard/clientes/nuevo', icon: Users, module: 'clientes' as SystemModule },
  ].filter((a) => !permsLoading && canEdit(a.module))

  const fade = (i: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.04 * i, duration: 0.3, ease: 'easeOut' as const },
  })

  const invTotal = summary?.total ?? 0

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Greeting */}
      <motion.div {...fade(0)} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm capitalize text-gray-500">{today}</p>
          <h1 className="mt-0.5 text-2xl font-bold sm:text-3xl">
            {greeting}
            {firstName && (
              <>
                , <span className="text-gradient">{firstName}</span>
              </>
            )}
          </h1>
          <p className="mt-1 text-[15px] text-gray-400">Esto es lo que está pasando hoy en SHOCK.</p>
        </div>
        {quickActions.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
            {quickActions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm font-medium text-gray-200 transition-all hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-white"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/15 text-orange-400 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                {a.label}
              </Link>
            ))}
          </div>
        )}
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {projects !== null || loading ? (
          <motion.div {...fade(1)}>
            <StatsCard title="Proyectos en curso" value={projectCounts.IN_PROGRESS || 0} icon={FolderKanban} href="/dashboard/proyectos" loading={loading} description={`${projects?.length ?? 0} en total`} />
          </motion.div>
        ) : null}
        {quotations !== null || loading ? (
          <motion.div {...fade(2)}>
            <StatsCard title="Cotizaciones abiertas" value={openQuotations.length} icon={FileText} href="/dashboard/cotizaciones" loading={loading} description="Borrador o enviadas" iconColor="text-sky-400" iconBgColor="bg-sky-500/10" />
          </motion.div>
        ) : null}
        {summary !== null || loading ? (
          <motion.div {...fade(3)}>
            <StatsCard title="Equipos disponibles" value={summary?.byStatus?.IN ?? 0} icon={Boxes} href="/dashboard/inventario/productos" loading={loading} description={`de ${invTotal} unidades`} iconColor="text-emerald-400" iconBgColor="bg-emerald-500/10" />
          </motion.div>
        ) : null}
        {clients !== null || loading ? (
          <motion.div {...fade(4)}>
            <StatsCard title="Clientes" value={clients?.length ?? 0} icon={Users} href="/dashboard/clientes" loading={loading} description="Registrados" iconColor="text-amber-300" iconBgColor="bg-amber-500/10" />
          </motion.div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 sm:gap-6">
        {/* Left */}
        <div className="space-y-5 sm:space-y-6 lg:col-span-2">
          {(tasks !== null || loading) && (
            <motion.div {...fade(5)}>
              <Panel title="Mis tareas pendientes" icon={ListTodo} href="/dashboard/tareas">
                {loading ? (
                  <SkeletonRows n={3} />
                ) : pendingTasks.length === 0 ? (
                  <Empty text="¡Todo al día! No tienes tareas pendientes." />
                ) : (
                  <ul className="divide-y divide-white/[0.05]">
                    {pendingTasks.slice(0, 6).map((t) => {
                      const due = t.dueDate ? new Date(t.dueDate) : null
                      const overdue = due ? due.getTime() < Date.now() : false
                      return (
                        <li key={t.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', priorityDot[t.priority] || 'bg-gray-500')} title={`Prioridad ${t.priority}`} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-medium text-gray-100 sm:text-sm">{t.title}</p>
                            {t.project && (
                              <Link href={`/dashboard/proyectos/${t.project.id}`} className="truncate text-xs text-gray-500 hover:text-orange-400">
                                {t.project.title}
                              </Link>
                            )}
                          </div>
                          {due && (
                            <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', overdue ? 'bg-red-500/10 text-red-400' : 'bg-white/[0.05] text-gray-400')}>
                              <CalendarClock className="h-3 w-3" />
                              {due.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Panel>
            </motion.div>
          )}

          {(quotations !== null || loading) && (
            <motion.div {...fade(6)}>
              <Panel title="Cotizaciones recientes" icon={FileText} href="/dashboard/cotizaciones">
                {loading ? (
                  <SkeletonRows />
                ) : (quotations?.length ?? 0) === 0 ? (
                  <Empty text="Aún no hay cotizaciones." />
                ) : (
                  <ul className="space-y-2">
                    {quotations!.slice(0, 5).map((q) => {
                      const st = quotationStatus[q.status] || quotationStatus.DRAFT
                      return (
                        <li key={q.id}>
                          <Link href={`/dashboard/cotizaciones/${q.id}`} className="flex items-center gap-3 rounded-xl border border-transparent bg-white/[0.02] p-3 transition-colors hover:border-white/[0.08] hover:bg-white/[0.04]">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-medium text-gray-100 sm:text-sm">{q.title}</p>
                              <p className="truncate text-xs text-gray-500">
                                <span className="font-mono">{q.quotationNumber}</span> · {q.client?.company || q.client?.name}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold text-gray-100">{formatCOP(q.total)}</p>
                              <span className={cn('mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium', st.cls)}>{st.label}</span>
                            </div>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {!loading && acceptedThisMonth > 0 && (
                  <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/[0.07] px-3 py-2 text-sm text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Aceptado este mes: <b>{formatCOP(acceptedThisMonth)}</b>
                  </p>
                )}
              </Panel>
            </motion.div>
          )}
        </div>

        {/* Right */}
        <div className="space-y-5 sm:space-y-6">
          {(summary !== null || loading) && (
            <motion.div {...fade(7)}>
              <Panel title="Estado del inventario" icon={Package} href="/dashboard/inventario" hrefLabel="Resumen">
                {loading ? (
                  <SkeletonRows n={3} />
                ) : invTotal === 0 ? (
                  <Empty text="Sin unidades registradas." />
                ) : (
                  <>
                    <div className="stack-bar !h-3">
                      {ITEM_STATUSES.map((s) =>
                        summary!.byStatus[s] > 0 ? (
                          <span key={s} className={itemStatusConfig[s].bar} style={{ width: `${(summary!.byStatus[s] / invTotal) * 100}%` }} />
                        ) : null
                      )}
                    </div>
                    <ul className="mt-4 grid grid-cols-2 gap-2">
                      {ITEM_STATUSES.map((s) => {
                        const cfg = itemStatusConfig[s]
                        return (
                          <li key={s}>
                            <Link
                              href={`/dashboard/inventario/items?vista=unidades`}
                              className="flex items-center gap-2 rounded-xl bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.06]"
                            >
                              <span className={cn('h-2.5 w-2.5 rounded-full', cfg.dot)} />
                              <span className="min-w-0">
                                <span className="block text-lg font-bold leading-none text-gray-50">{summary!.byStatus[s]}</span>
                                <span className="text-xs text-gray-400">{cfg.label}</span>
                              </span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </Panel>
            </motion.div>
          )}

          {(projects !== null || loading) && (
            <motion.div {...fade(8)}>
              <Panel title="Proyectos" icon={FolderKanban} href="/dashboard/proyectos">
                {loading ? (
                  <SkeletonRows n={3} />
                ) : (projects?.length ?? 0) === 0 ? (
                  <Empty text="Aún no hay proyectos." />
                ) : (
                  <div className="space-y-3">
                    {Object.entries(projectStatus).map(([key, cfg]) => {
                      const n = projectCounts[key] || 0
                      const pct = projects!.length ? (n / projects!.length) * 100 : 0
                      return (
                        <div key={key}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="text-gray-300">{cfg.label}</span>
                            <span className="font-medium text-gray-400">{n}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <motion.div
                              className={cn('h-full rounded-full', cfg.bar)}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Panel>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
