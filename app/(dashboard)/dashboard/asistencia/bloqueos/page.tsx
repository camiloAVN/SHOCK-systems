'use client'

import { useCallback, useEffect, useState } from 'react'
import { IdCard, LockOpen, MapPinned, RefreshCw, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { ProtectedPhoto } from '@/components/attendance/ProtectedPhoto'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { describe } from '@/lib/attendance/shifts'

type Attempt = { id: string; officialAt: string; similarity: number | null; reasons: string[]; distanceMeters: number | null; hasPhoto: boolean }
type Lock = {
  id: string
  lockedAt: string
  user: { id: string; name: string | null; email: string; cedula: string | null }
  area: { id: string; name: string }
  shift: { id: string; startsAt: string; endsAt: string }
  referenceEnrollmentId: string | null
  attempts: Attempt[]
}

const REASON: Record<string, string> = { FACE_MISMATCH: 'rostro no coincide', NO_FACE: 'sin rostro en la foto' }

export default function ShiftLocksPage() {
  const [locks, setLocks] = useState<Lock[]>([])
  const [canUnlock, setCanUnlock] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<Lock | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/attendance/locks')
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Error al cargar')
      setLocks(body.locks)
      setCanUnlock(body.canUnlock)
      setCurrentUserId(body.currentUserId)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const unlock = async () => {
    if (!target) return
    setBusy(true)
    try {
      const r = await fetch(`/api/attendance/locks/${target.id}/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: note.trim() }) })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Error al desbloquear')
      toast.success('Turno desbloqueado: la persona puede volver a marcar')
      setTarget(null)
      setNote('')
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <ShieldAlert className="h-7 w-7 text-orange-400" />
            Turnos bloqueados
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Personas que fallaron la verificación de rostro varias veces en un turno. Compara las fotos y, si corresponde, desbloquea el turno para que puedan volver a marcar.
          </p>
        </div>
        <Button variant="outline" onClick={load} isLoading={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {!canUnlock && !loading && locks.length > 0 && (
        <p className="rounded-xl border border-white/[0.07] bg-[#141414]/80 p-4 text-sm text-gray-400">
          Puedes ver los bloqueos, pero no desbloquearlos. Se necesita el permiso de edición de "Asistencia: reportes".
        </p>
      )}

      {!loading && locks.length === 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-10 text-center text-gray-400">No hay turnos bloqueados.</div>
      )}

      <div className="space-y-4">
        {locks.map((l) => {
          const own = l.user.id === currentUserId
          return (
            <div key={l.id} className="rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-lg font-semibold">{l.user.name || l.user.email}</p>
                  <p className="flex items-center gap-1 text-sm text-gray-400">
                    <IdCard className="h-4 w-4" />
                    {l.user.cedula || 'Sin cédula'} · {l.user.email}
                  </p>
                  <p className="flex items-center gap-1 text-sm text-gray-400">
                    <MapPinned className="h-4 w-4" />
                    {l.area.name} · turno {describe(new Date(l.shift.startsAt))}
                  </p>
                  <p className="text-sm text-orange-300">Bloqueado el {describe(new Date(l.lockedAt))}</p>
                </div>
                {canUnlock && !own && (
                  <Button onClick={() => setTarget(l)} className="shrink-0">
                    <LockOpen className="mr-2 h-4 w-4" />
                    Desbloquear
                  </Button>
                )}
                {canUnlock && own && <p className="text-xs text-gray-500">Es tu propio turno: debe desbloquearlo otra persona.</p>}
              </div>

              <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                <div className="shrink-0 space-y-1">
                  <ProtectedPhoto url={l.referenceEnrollmentId ? `/api/attendance/enrollments/${l.referenceEnrollmentId}/photo` : null} label="Ver referencia" />
                  <p className="text-center text-xs font-medium text-green-300">Foto aprobada</p>
                </div>
                {l.attempts.map((a) => (
                  <div key={a.id} className="shrink-0 space-y-1">
                    <ProtectedPhoto url={a.hasPhoto ? `/api/attendance/marks/${a.id}/photo` : null} label="Ver intento" />
                    <p className="w-32 text-center text-xs text-gray-400">
                      {describe(new Date(a.officialAt)).split(', ')[1]} · {a.similarity !== null ? `${Math.round(a.similarity)} %` : a.reasons.map((r) => REASON[r] ?? r).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <Modal isOpen={!!target} onClose={() => setTarget(null)} title="Desbloquear turno" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            {target?.user.name || target?.user.email} podrá volver a marcar en este turno, con {ATTENDANCE_CONFIG.face.maxFailedAttemptsPerShift} intentos nuevos de rostro. Los intentos fallidos quedan guardados para la revisión.
          </p>
          <Textarea label="Motivo *" placeholder="Ej.: verifiqué por videollamada que es la persona; mala luz en el lugar" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={unlock} isLoading={busy} disabled={!note.trim()}>
              Desbloquear
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
