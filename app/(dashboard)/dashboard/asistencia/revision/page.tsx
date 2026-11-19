'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ClipboardCheck, IdCard, Map as MapIcon, MapPinned, RefreshCw, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { AreaMapLazy } from '@/components/attendance/AreaMapLazy'
import { ProtectedPhoto } from '@/components/attendance/ProtectedPhoto'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { describe } from '@/lib/attendance/shifts'

type ReviewMark = {
  id: string
  type: 'IN' | 'OUT'
  reasons: string[]
  officialAt: string
  latitude: number
  longitude: number
  accuracyMeters: number | null
  distanceMeters: number | null
  similarity: number | null
  /** Hecha sin conexión (Fase 8); createdAt = cuándo llegó al servidor */
  offline: boolean
  createdAt: string
  hasPhoto: boolean
  user: { id: string; name: string | null; email: string; cedula: string | null }
  area: { id: string; name: string; latitude: number; longitude: number; radiusMeters: number }
  shift: { id: string; startsAt: string; endsAt: string }
  referenceEnrollmentId: string | null
  review: { decision: 'APPROVED' | 'REJECTED'; note: string; createdAt: string; reviewer: { name: string | null; email: string } | null } | null
}

function reasonLines(m: ReviewMark): string[] {
  const out: string[] = []
  if (m.reasons.includes('OUT_OF_AREA')) {
    const outside = m.distanceMeters !== null ? Math.max(0, Math.round(m.distanceMeters - m.area.radiusMeters)) : null
    out.push(
      `Fuera del área: a ${m.distanceMeters !== null ? Math.round(m.distanceMeters) : '?'} m del centro (radio ${m.area.radiusMeters} m${outside !== null ? `, ${outside} m por fuera` : ''})`
    )
  }
  if (m.reasons.includes('LOW_GPS_ACCURACY')) {
    out.push(m.accuracyMeters === null ? 'GPS sin dato de precisión' : `GPS impreciso: ±${Math.round(m.accuracyMeters)} m`)
  }
  if (m.reasons.includes('TIME_UNVERIFIED')) {
    out.push('Hora sin verificar: se marcó sin conexión y el teléfono se reinició antes (o no tenía hora del servidor). La hora mostrada es la del teléfono.')
  }
  if (m.reasons.includes('REFERENCE_PHOTO_MISSING')) {
    out.push('No se comparó el rostro: falta la foto del registro facial de esta persona. Compara la selfie a ojo. Para que vuelva a registrarse, revoca su registro en «Registros faciales».')
  }
  return out
}

function ReviewCard({
  m,
  canReview,
  own,
  styleUrl,
  onDecide,
}: {
  m: ReviewMark
  canReview: boolean
  own: boolean
  styleUrl: string
  onDecide: (m: ReviewMark, decision: 'APPROVED' | 'REJECTED') => void
}) {
  const [showMap, setShowMap] = useState(false)
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-lg font-semibold">{m.user.name || m.user.email}</p>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-semibold text-gray-300">{m.type === 'IN' ? 'Entrada' : 'Salida'}</span>
            {m.review && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.review.decision === 'APPROVED' ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}
              >
                {m.review.decision === 'APPROVED' ? 'Aprobada' : 'Rechazada'}
              </span>
            )}
          </div>
          <p className="flex items-center gap-1 text-sm text-gray-400">
            <IdCard className="h-4 w-4" />
            {m.user.cedula || 'Sin cédula'} · {m.user.email}
          </p>
          <p className="flex items-center gap-1 text-sm text-gray-400">
            <MapPinned className="h-4 w-4" />
            {m.area.name} · turno {describe(new Date(m.shift.startsAt))} – {describe(new Date(m.shift.endsAt)).split(', ')[1]}
          </p>
          <p className="text-sm text-gray-200">Marcó el {describe(new Date(m.officialAt))}</p>
          {m.offline && <p className="text-sm text-gray-400">Sin conexión · llegó al servidor el {describe(new Date(m.createdAt))}</p>}
          {reasonLines(m).map((line) => (
            <p key={line} className="text-sm text-orange-300">
              {line}
            </p>
          ))}
          {m.review && (
            <p className="text-sm text-gray-400">
              {m.review.reviewer ? `${m.review.reviewer.name || m.review.reviewer.email}, ` : ''}
              {describe(new Date(m.review.createdAt))}: “{m.review.note}”
            </p>
          )}
        </div>
        {!m.review && canReview && !own && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => onDecide(m, 'REJECTED')}>
              <X className="mr-1.5 h-4 w-4" />
              Rechazar
            </Button>
            <Button onClick={() => onDecide(m, 'APPROVED')}>
              <Check className="mr-1.5 h-4 w-4" />
              Aprobar
            </Button>
          </div>
        )}
        {!m.review && canReview && own && <p className="text-xs text-gray-500">Es tu propia marcación: debe revisarla otra persona.</p>}
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        <div className="shrink-0 space-y-1">
          <ProtectedPhoto url={m.referenceEnrollmentId ? `/api/attendance/enrollments/${m.referenceEnrollmentId}/photo` : null} label="Ver referencia" />
          <p className="text-center text-xs font-medium text-green-300">Foto aprobada</p>
        </div>
        <div className="shrink-0 space-y-1">
          <ProtectedPhoto url={m.hasPhoto ? `/api/attendance/marks/${m.id}/photo` : null} label="Ver selfie" />
          <p className="w-32 text-center text-xs text-gray-400">Selfie{m.similarity !== null ? ` · ${Math.round(m.similarity)} %` : ''}</p>
        </div>
      </div>

      <button type="button" onClick={() => setShowMap((v) => !v)} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-orange-400 hover:text-orange-300">
        <MapIcon className="h-4 w-4" />
        {showMap ? 'Ocultar mapa' : 'Ver en el mapa'}
      </button>
      {showMap && (
        <div className="mt-3 space-y-1">
          <AreaMapLazy
            styleUrl={styleUrl}
            circles={[
              { id: m.area.id, latitude: m.area.latitude, longitude: m.area.longitude, radiusMeters: m.area.radiusMeters, selected: true },
              ...(m.accuracyMeters ? [{ id: 'gps', latitude: m.latitude, longitude: m.longitude, radiusMeters: m.accuracyMeters, muted: true }] : []),
            ]}
            points={[{ latitude: m.latitude, longitude: m.longitude, title: 'Donde marcó' }]}
            className="h-72 w-full overflow-hidden rounded-2xl border border-white/[0.07]"
          />
          <p className="text-xs text-gray-500">Naranja: el área. Marcador azul: donde marcó; el círculo gris es la precisión del GPS.</p>
        </div>
      )}
    </div>
  )
}

export default function ReviewInboxPage() {
  const [tab, setTab] = useState<'pending' | 'done'>('pending')
  const [marks, setMarks] = useState<ReviewMark[]>([])
  const [canReview, setCanReview] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [styleUrl, setStyleUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<{ mark: ReviewMark; decision: 'APPROVED' | 'REJECTED' } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/attendance/reviews?state=${tab}`)
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Error al cargar')
      setMarks(body.marks)
      setCanReview(body.canReview)
      setCurrentUserId(body.currentUserId)
      setStyleUrl(body.mapStyleUrl)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  const decide = async () => {
    if (!target) return
    setBusy(true)
    try {
      const r = await fetch(`/api/attendance/reviews/${target.mark.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: target.decision, note: note.trim() }),
      })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Error al guardar')
      toast.success(target.decision === 'APPROVED' ? 'Marcación aprobada' : 'Marcación rechazada: ese par no sumará horas')
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
            <ClipboardCheck className="h-7 w-7 text-orange-400" />
            Revisión de marcaciones
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Marcaciones hechas fuera del área o con GPS impreciso. Mientras nadie las revisa cuentan para las horas, pero marcadas como "en revisión". Si rechazas una, su par entrada/salida no suma horas.
          </p>
        </div>
        <Button variant="outline" onClick={load} isLoading={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="flex gap-2">
        {(['pending', 'done'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-orange-500 text-black' : 'bg-white/[0.06] text-gray-300 hover:bg-white/10'}`}
          >
            {t === 'pending' ? 'Pendientes' : 'Revisadas (30 días)'}
          </button>
        ))}
      </div>

      {tab === 'pending' && !canReview && !loading && marks.length > 0 && (
        <p className="rounded-xl border border-white/[0.07] bg-[#141414]/80 p-4 text-sm text-gray-400">
          Puedes ver las marcaciones, pero no aprobarlas ni rechazarlas. Se necesita el permiso de edición de "Asistencia: reportes".
        </p>
      )}

      {!loading && marks.length === 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-[#141414]/80 p-10 text-center text-gray-400">
          {tab === 'pending' ? 'No hay marcaciones por revisar.' : 'No hay revisiones en los últimos 30 días.'}
        </div>
      )}

      <div className="space-y-4">
        {styleUrl &&
          marks.map((m) => <ReviewCard key={m.id} m={m} canReview={canReview} own={m.user.id === currentUserId} styleUrl={styleUrl} onDecide={(mark, decision) => setTarget({ mark, decision })} />)}
      </div>

      <Modal isOpen={!!target} onClose={() => setTarget(null)} title={target?.decision === 'APPROVED' ? 'Aprobar marcación' : 'Rechazar marcación'} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            {target?.decision === 'APPROVED'
              ? 'La marcación contará como válida. La decisión es definitiva y la persona la verá en su historial.'
              : 'El par entrada/salida de esta marcación no sumará horas ni horas extra. La decisión es definitiva y la persona la verá en su historial.'}
          </p>
          <Textarea
            label="Nota *"
            placeholder={target?.decision === 'APPROVED' ? 'Ej.: el evento se movió a la bodega de al lado' : 'Ej.: no estaba en el lugar del evento'}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={decide} isLoading={busy} disabled={!note.trim()}>
              {target?.decision === 'APPROVED' ? 'Aprobar' : 'Rechazar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
