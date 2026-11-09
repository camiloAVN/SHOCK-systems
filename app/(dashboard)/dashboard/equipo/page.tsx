'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Edit, Lock, Mail, Plus, Search, Trash2, Users, X, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/Button'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { TeamEditor } from '@/components/teams/TeamEditor'
import { TeamMemberView, TeamView } from '@/lib/validations/team'

type Selected = { member: TeamMemberView; team: TeamView }

function splitTasks(text: string | null) {
  return (text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
}

/* ───────────── Member card ───────────── */
function MemberCard({ member, color, onOpen }: { member: TeamMemberView; color: string; onOpen: () => void }) {
  const tasks = splitTasks(member.responsibilities)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full w-full flex-col rounded-2xl border border-white/[0.06] bg-black/25 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-white/[0.14]"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <UserAvatar src={member.user.image} name={member.user.name} email={member.user.email} size="lg" />
          {member.isLead && (
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#141414]" style={{ backgroundColor: color }} title="Líder del equipo">
              <Crown className="h-3 w-3 text-white" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-50 group-hover:text-orange-300">{member.user.name || 'Sin nombre'}</p>
          <p className="truncate text-sm" style={{ color }}>
            {member.role || member.user.position || 'Integrante'}
          </p>
        </div>
      </div>
      {tasks.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-white/[0.05] pt-3 text-[13px] text-gray-400">
          {tasks.slice(0, 3).map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gray-500" />
              <span className="line-clamp-1">{t}</span>
            </li>
          ))}
          {tasks.length > 3 && <li className="pl-3 text-xs text-gray-500">+{tasks.length - 3} labores más</li>}
        </ul>
      )}
    </button>
  )
}

/* ───────────── Member detail sheet ───────────── */
function MemberSheet({ selected, allTeams, onClose }: { selected: Selected; allTeams: TeamView[]; onClose: () => void }) {
  const { member, team } = selected
  const tasks = splitTasks(member.responsibilities)
  const otherTeams = allTeams.filter((t) => t.id !== team.id && t.members.some((m) => m.user.id === member.user.id))
  const color = team.color || '#F5920A'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/[0.08] bg-[#111] shadow-2xl sm:max-w-md sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="h-24" style={{ background: `linear-gradient(135deg, ${color}55, transparent)` }} />
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-black/40 p-2 text-gray-200 hover:bg-black/60" aria-label="Cerrar">
          <X className="h-5 w-5" />
        </button>
        <div className="safe-bottom -mt-14 px-6 pb-6">
          <UserAvatar src={member.user.image} name={member.user.name} email={member.user.email} size="2xl" className="border-4 border-[#111]" />
          <h3 className="mt-3 text-xl font-bold text-gray-50">{member.user.name || 'Sin nombre'}</h3>
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium" style={{ color }}>
            {member.role || 'Integrante'} · {team.name}
            {member.isLead && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-gray-200">
                <Crown className="h-3 w-3" /> Líder
              </span>
            )}
          </p>
          {member.user.position && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
              <Briefcase className="h-3.5 w-3.5" /> {member.user.position}
            </p>
          )}
          <a href={`mailto:${member.user.email}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-orange-400">
            <Mail className="h-3.5 w-3.5" /> {member.user.email}
          </a>

          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Labores</p>
            {tasks.length > 0 ? (
              <ul className="space-y-2">
                {tasks.map((t, i) => (
                  <li key={i} className="flex gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2 text-[15px] text-gray-200 sm:text-sm">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    {t}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Sin labores registradas.</p>
            )}
          </div>

          {otherTeams.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">También está en</p>
              <div className="flex flex-wrap gap-2">
                {otherTeams.map((t) => {
                  const m = t.members.find((x) => x.user.id === member.user.id)
                  return (
                    <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-sm text-gray-300">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color || '#F5920A' }} />
                      {t.name}
                      {m?.role && <span className="text-gray-500">· {m.role}</span>}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}

/* ───────────── Page ───────────── */
export default function EquipoPage() {
  const { isSuperAdmin, isLoading: permsLoading } = usePermissions()
  const [teams, setTeams] = useState<TeamView[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<TeamView | null | undefined>(undefined) // undefined = closed, null = new
  const [selected, setSelected] = useState<Selected | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/teams')
      if (!res.ok) throw new Error()
      setTeams(await res.json())
    } catch {
      toast.error('No se pudieron cargar los equipos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return teams
    return teams
      .map((t) => {
        const teamMatch = t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
        const members = teamMatch
          ? t.members
          : t.members.filter((m) =>
              [m.user.name, m.user.email, m.role, m.responsibilities, m.user.position].some((v) => v?.toLowerCase().includes(q))
            )
        return { ...t, members, _show: teamMatch || members.length > 0 }
      })
      .filter((t) => t._show)
  }, [teams, q])

  const totalPeople = useMemo(() => new Set(teams.flatMap((t) => t.members.map((m) => m.user.id))).size, [teams])

  const handleDelete = async (team: TeamView) => {
    if (!confirm(`¿Eliminar el equipo "${team.name}"? Los usuarios no se eliminan, solo el equipo.`)) return
    const res = await fetch(`/api/teams/${team.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Equipo eliminado')
      setTeams((prev) => prev.filter((t) => t.id !== team.id))
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error || 'No se pudo eliminar')
    }
  }

  const canManage = !permsLoading && isSuperAdmin

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Nuestro <span className="text-gradient">Equipo</span>
          </h1>
          <p className="mt-1 text-[15px] text-gray-400">
            {teams.length} equipo{teams.length === 1 ? '' : 's'} · {totalPeople} persona{totalPeople === 1 ? '' : 's'}. Toca a alguien para ver sus labores.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setEditing(null)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo equipo
          </Button>
        )}
      </div>

      {!permsLoading && !isSuperAdmin && (
        <p className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-400">
          <Lock className="h-4 w-4 shrink-0 text-gray-500" />
          Solo el superadministrador puede crear o editar equipos.
        </p>
      )}

      {/* Search */}
      {teams.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar persona, rol, labor o equipo…"
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 text-[15px] text-gray-100 placeholder:text-gray-500 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
          <Users className="mx-auto mb-3 h-12 w-12 text-gray-600" />
          <p className="font-medium text-gray-300">Aún no hay equipos</p>
          <p className="mt-1 text-sm text-gray-500">
            {canManage ? 'Crea el primero (ej. Producción) y agrega a sus integrantes.' : 'Cuando el superadministrador cree equipos aparecerán aquí.'}
          </p>
          {canManage && (
            <Button className="mt-4" size="sm" onClick={() => setEditing(null)}>
              <Plus className="mr-1 h-4 w-4" /> Crear equipo
            </Button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-gray-500">Nada coincide con “{query}”.</p>
      ) : (
        <div className="space-y-5">
          <AnimatePresence initial={false}>
            {filtered.map((team) => {
              const color = team.color || '#F5920A'
              return (
                <motion.section
                  key={team.id}
                  layout="position"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#141414]/80"
                >
                  <div className="h-1" style={{ backgroundColor: color }} />
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-50 sm:text-xl">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                        {team.name}
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-gray-400">{team.members.length}</span>
                      </h2>
                      {team.description && <p className="mt-1 text-[15px] text-gray-400 sm:text-sm">{team.description}</p>}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(team)}>
                          <Edit className="mr-1.5 h-4 w-4" /> Editar
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(team)} title="Eliminar equipo">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                    {team.members.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-gray-500">Este equipo aún no tiene integrantes.</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {team.members.map((m) => (
                          <MemberCard key={m.id} member={m} color={color} onOpen={() => setSelected({ member: m, team: teams.find((t) => t.id === team.id) || team })} />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.section>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {editing !== undefined && canManage && (
        <TeamEditor
          team={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            setTeams((prev) => {
              const exists = prev.some((t) => t.id === saved.id)
              const next = exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved]
              return next.sort((a, b) => a.name.localeCompare(b.name, 'es'))
            })
            setEditing(undefined)
          }}
        />
      )}

      {selected && <MemberSheet selected={selected} allTeams={teams} onClose={() => setSelected(null)} />}
    </div>
  )
}
