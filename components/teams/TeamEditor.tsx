'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Crown, Plus, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { cn } from '@/lib/utils/cn'
import { TEAM_COLORS, TeamView } from '@/lib/validations/team'

type SelectUser = { id: string; name: string | null; email: string; image: string | null }

type DraftMember = {
  userId: string
  role: string
  responsibilities: string
  isLead: boolean
  user: SelectUser
}

interface TeamEditorProps {
  team: TeamView | null // null = create
  onClose: () => void
  onSaved: (team: TeamView) => void
}

const fieldCls =
  'w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[15px] text-gray-100 placeholder:text-gray-500 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20 sm:text-sm'

export function TeamEditor({ team, onClose, onSaved }: TeamEditorProps) {
  const [name, setName] = useState(team?.name ?? '')
  const [description, setDescription] = useState(team?.description ?? '')
  const [color, setColor] = useState(team?.color ?? TEAM_COLORS[0])
  const [members, setMembers] = useState<DraftMember[]>(
    () =>
      team?.members.map((m) => ({
        userId: m.user.id,
        role: m.role ?? '',
        responsibilities: m.responsibilities ?? '',
        isLead: m.isLead,
        user: { id: m.user.id, name: m.user.name, email: m.user.email, image: m.user.image },
      })) ?? []
  )
  const [users, setUsers] = useState<SelectUser[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/users?forSelect=true')
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => setUsers([]))
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, saving])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const available = useMemo(() => {
    const taken = new Set(members.map((m) => m.userId))
    const q = query.trim().toLowerCase()
    return users
      .filter((u) => !taken.has(u.id))
      .filter((u) => !q || u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 30)
  }, [users, members, query])

  const addMember = (u: SelectUser) => {
    setMembers((prev) => [...prev, { userId: u.id, role: '', responsibilities: '', isLead: false, user: u }])
    setQuery('')
    setPickerOpen(false)
  }
  const patch = (i: number, p: Partial<DraftMember>) =>
    setMembers((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...p } : m)))
  const move = (i: number, dir: -1 | 1) =>
    setMembers((prev) => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const save = async () => {
    if (name.trim().length < 2) {
      toast.error('El nombre del equipo es obligatorio')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        color,
        members: members.map((m) => ({
          userId: m.userId,
          role: m.role.trim() || null,
          responsibilities: m.responsibilities.trim() || null,
          isLead: m.isLead,
        })),
      }
      const res = await fetch(team ? `/api/teams/${team.id}` : '/api/teams', {
        method: team ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      toast.success(team ? 'Equipo actualizado' : 'Equipo creado')
      onSaved(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !saving && onClose()}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/[0.08] bg-[#111] shadow-2xl sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label={team ? 'Editar equipo' : 'Nuevo equipo'}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-50">{team ? 'Editar equipo' : 'Nuevo equipo'}</h2>
          <button onClick={onClose} disabled={saving} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">Nombre del equipo *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Producción" className={fieldCls} maxLength={80} autoFocus />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">Color</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn('h-8 w-8 rounded-full transition-transform', color === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#111]' : 'hover:scale-105')}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿De qué se encarga este equipo?"
              rows={2}
              maxLength={1000}
              className={cn(fieldCls, 'resize-y')}
            />
          </div>

          {/* Members */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-200">
                Integrantes <span className="text-gray-500">({members.length})</span>
              </p>
            </div>

            <div ref={pickerRef} className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPickerOpen(true)
                }}
                onFocus={() => setPickerOpen(true)}
                placeholder="Buscar usuario para agregar…"
                className={cn(fieldCls, 'pl-10')}
              />
              {pickerOpen && (
                <div className="absolute inset-x-0 top-full z-10 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#181818] p-1 shadow-2xl">
                  {available.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-gray-500">
                      {users.length === 0 ? 'Cargando usuarios…' : 'No hay más usuarios para agregar'}
                    </p>
                  ) : (
                    available.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => addMember(u)}
                        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-white/[0.06]"
                      >
                        <UserAvatar src={u.image} name={u.name} email={u.email} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-100">{u.name || 'Sin nombre'}</span>
                          <span className="block truncate text-xs text-gray-500">{u.email}</span>
                        </span>
                        <Plus className="h-4 w-4 text-orange-400" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {members.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-gray-500">
                Busca y agrega usuarios ya creados al equipo.
              </p>
            ) : (
              <ul className="space-y-3">
                {members.map((m, i) => (
                  <li key={m.userId} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar src={m.user.image} name={m.user.name} email={m.user.email} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-100">{m.user.name || 'Sin nombre'}</p>
                        <p className="truncate text-xs text-gray-500">{m.user.email}</p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white disabled:opacity-30" aria-label="Subir">
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === members.length - 1} className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white disabled:opacity-30" aria-label="Bajar">
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMembers((prev) => prev.filter((_, idx) => idx !== i))}
                          className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                          aria-label="Quitar del equipo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-400">Rol en el equipo</label>
                        <input value={m.role} onChange={(e) => patch(i, { role: e.target.value })} placeholder="Ej. Jefe de producción" maxLength={100} className={fieldCls} />
                      </div>
                      <button
                        type="button"
                        onClick={() => patch(i, { isLead: !m.isLead })}
                        className={cn(
                          'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors sm:h-10',
                          m.isLead ? 'border-orange-500/50 bg-orange-500/15 text-orange-300' : 'border-white/[0.08] text-gray-400 hover:text-gray-200'
                        )}
                        aria-pressed={m.isLead}
                      >
                        <Crown className="h-4 w-4" />
                        Líder
                      </button>
                    </div>
                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium text-gray-400">Labores / responsabilidades</label>
                      <textarea
                        value={m.responsibilities}
                        onChange={(e) => patch(i, { responsibilities: e.target.value })}
                        placeholder="Una labor por línea. Ej.:&#10;Coordinar montajes&#10;Revisar equipos antes de salir"
                        rows={3}
                        maxLength={2000}
                        className={cn(fieldCls, 'resize-y')}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="safe-bottom flex gap-2 border-t border-white/[0.06] px-5 py-4 sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button onClick={save} isLoading={saving} className="flex-1 sm:flex-none">
            {team ? 'Guardar cambios' : 'Crear equipo'}
          </Button>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
