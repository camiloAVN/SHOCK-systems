'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, Clock, Eye, IdCard, RefreshCw, ScanFace, ShieldOff, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { cn } from '@/lib/utils/cn'

type Tab = 'pending' | 'approved' | 'history'
type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED' | 'REVOKED'

type Enrollment = {
  id: string
  status: Status
  submittedAt: string
  reviewedAt: string | null
  reviewNote: string | null
  livenessMethod: string
  challengeSteps: string[]
  quality: { sharpness?: number | null; brightness?: number | null; yaw?: number | null; faceWidthRatio?: number | null } | null
  hasPhoto: boolean
  user: { id: string; name: string | null; email: string; cedula: string | null; position: string | null; image: string | null; isActive: boolean }
  reviewedBy: { id: string; name: string | null; email: string } | null
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'approved', label: 'Aprobados' },
  { key: 'history', label: 'Historial' },
]

const STATUS_LABEL: Record<Status, { text: string; className: string }> = {
  PENDING: { text: 'Pendiente', className: 'text-orange-400' },
  APPROVED: { text: 'Aprobado', className: 'text-green-400' },
  REJECTED: { text: 'Rechazado', className: 'text-red-400' },
  REVOKED: { text: 'Anulado', className: 'text-red-400' },
  SUPERSEDED: { text: 'Reemplazado', className: 'text-gray-500' },
}

const STEP_LABEL: Record<string, string> = { blink: 'parpadeo', turn_left: 'giro izquierda', turn_right: 'giro derecha' }

const fmt = (iso: string) => format(new Date(iso), "dd MMM yyyy, HH:mm", { locale: es })

/** Foto de referencia: se pide una URL firmada al abrirla (caduca a los 5 minutos). */
function EnrollmentPhoto({ id, hasPhoto }: { id: string; hasPhoto: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/attendance/enrollments/${id}/photo`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'No se pudo cargar la foto')
      setUrl(body.url)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  if (!hasPhoto) {
    return <div className="flex h-56 w-44 items-center justify-center rounded-xl border border-white/10 bg-black/30 px-3 text-center text-xs text-gray-500">Foto eliminada</div>
  }
  if (!url) {
    return (
      <button
        type="button"
        onClick={load}
        className="flex h-56 w-44 flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 text-sm text-gray-400 hover:border-orange-500/40 hover:text-orange-300"
      >
        <Eye className="h-5 w-5" />
        {loading ? 'Cargando…' : error ?? 'Ver foto'}
      </button>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Foto de referencia" className="h-56 w-44 rounded-xl border border-white/10 object-cover" onError={() => setUrl(null)} />
}

export default function FaceEnrollmentsPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [items, setItems] = useState<Enrollment[]>([])
  const [canReview, setCanReview] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<{ item: Enrollment; action: 'reject' | 'revoke' } | null>(null)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/attendance/enrollments?status=${tab}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Error al cargar')
      setItems(body.enrollments)
      setCanReview(body.canReview)
      setCurrentUserId(body.currentUserId)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  const review = async (item: Enrollment, action: 'approve' | 'reject' | 'revoke', reviewNote?: string) => {
    setBusyId(item.id)
    try {
      const response = await fetch(`/api/attendance/enrollments/${item.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: reviewNote ?? null }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Error al revisar')
      toast.success(action === 'approve' ? 'Registro aprobado' : action === 'reject' ? 'Registro rechazado' : 'Registro anulado')
      setNoteFor(null)
      setNote('')
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <ScanFace className="h-7 w-7 text-orange-400" />
            Registros faciales
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Fotos de referencia enviadas desde la app de asistencia. Sin un registro aprobado, el empleado no puede marcar.
          </p>
        </div>
        <Button variant="outline" onClick={load} isLoading={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-xl border px-4 py-2 text-sm font-medium',
              tab === t.key ? 'border-orange-500/50 bg-orange-500/10 text-orange-300' : 'border-white/[0.07] text-gray-400 hover:text-gray-200'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!canReview && !loading && (
        <p className="rounded-xl border border-white/[0.07] bg-[#141414]/80 p-4 text-sm text-gray-400">
          Puedes ver los registros, pero no aprobarlos. Para revisar se necesita el permiso de edición de "Asistencia: reportes".
        </p>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-10 text-center text-gray-400">
          {tab === 'pending' ? 'No hay registros pendientes de revisión.' : 'No hay registros en esta lista.'}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => {
          const own = item.user.id === currentUserId
          const status = STATUS_LABEL[item.status]
          return (
            <div key={item.id} className="rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex gap-3">
                  <EnrollmentPhoto id={item.id} hasPhoto={item.hasPhoto} />
                  <div className="hidden flex-col items-center gap-1 sm:flex">
                    <UserAvatar src={item.user.image} name={item.user.name} email={item.user.email} size="xl" />
                    <span className="text-[11px] text-gray-500">Avatar</span>
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <p className="truncate text-lg font-semibold">{item.user.name || item.user.email}</p>
                  <p className="truncate text-sm text-gray-400">{item.user.email}</p>
                  <p className="flex items-center gap-1 text-sm text-gray-400">
                    <IdCard className="h-4 w-4" />
                    {item.user.cedula || 'Sin cédula'}
                    {item.user.position && ` · ${item.user.position}`}
                  </p>
                  {!item.user.isActive && <p className="text-sm text-red-400">Usuario desactivado</p>}
                  <p className={cn('flex items-center gap-1 text-sm', status.className)}>
                    <Clock className="h-4 w-4" />
                    {status.text} · enviado el {fmt(item.submittedAt)}
                  </p>
                  {item.reviewedAt && (
                    <p className="text-sm text-gray-500">
                      Revisado el {fmt(item.reviewedAt)}
                      {item.reviewedBy && ` por ${item.reviewedBy.name || item.reviewedBy.email}`}
                    </p>
                  )}
                  {item.reviewNote && <p className="text-sm text-gray-300">Motivo: {item.reviewNote}</p>}
                  <p className="text-xs text-gray-500">
                    Prueba de vida: {item.challengeSteps.map((s) => STEP_LABEL[s] ?? s).join(' → ')} ({item.livenessMethod})
                    {item.quality &&
                      ` · nitidez ${item.quality.sharpness ?? '—'} · brillo ${item.quality.brightness ?? '—'} · giro ${item.quality.yaw ?? '—'}°`}
                  </p>

                  {canReview && own && (item.status === 'PENDING' || item.status === 'APPROVED') && (
                    <p className="text-xs text-gray-500">Es tu propio registro: debe revisarlo otra persona.</p>
                  )}

                  {canReview && !own && item.status === 'PENDING' && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button size="sm" onClick={() => review(item, 'approve')} isLoading={busyId === item.id}>
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Aprobar
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setNoteFor({ item, action: 'reject' })} disabled={busyId === item.id}>
                        <XCircle className="mr-1 h-4 w-4" />
                        Rechazar
                      </Button>
                    </div>
                  )}
                  {canReview && !own && item.status === 'APPROVED' && (
                    <div className="pt-2">
                      <Button size="sm" variant="outline" onClick={() => setNoteFor({ item, action: 'revoke' })} disabled={busyId === item.id}>
                        <ShieldOff className="mr-1 h-4 w-4" />
                        Anular
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Modal
        isOpen={!!noteFor}
        onClose={() => {
          setNoteFor(null)
          setNote('')
        }}
        title={noteFor?.action === 'reject' ? 'Rechazar registro facial' : 'Anular registro facial'}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            {noteFor?.action === 'reject'
              ? 'El empleado verá este motivo en la app y podrá enviar una foto nueva. La foto rechazada se elimina.'
              : 'El empleado tendrá que registrar su rostro de nuevo antes de poder marcar. La foto actual se elimina.'}
          </p>
          <Textarea
            label="Motivo *"
            placeholder="Ej.: la foto está borrosa; no corresponde a la persona; usa gafas oscuras"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNoteFor(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={!note.trim()}
              isLoading={!!noteFor && busyId === noteFor.item.id}
              onClick={() => noteFor && review(noteFor.item, noteFor.action, note.trim())}
            >
              {noteFor?.action === 'reject' ? 'Rechazar' : 'Anular'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
