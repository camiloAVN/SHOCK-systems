'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, Clock, Smartphone, Unlink } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'

type MobileStatus = {
  consent: {
    currentVersion: string
    accepted: boolean
    lastAcceptedVersion: string | null
    lastAcceptedAt: string | null
  }
  device: {
    id: string
    platform: string | null
    deviceModel: string | null
    appVersion: string | null
    boundAt: string
  } | null
  openSessions: number
  canManage: boolean
}

const fmt = (iso: string) => format(new Date(iso), "dd MMM yyyy, HH:mm", { locale: es })

/** Sección "App móvil" del modal de edición de usuario. */
export function MobileAppStatus({ userId }: { userId: string }) {
  const [status, setStatus] = useState<MobileStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unbinding, setUnbinding] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await fetch(`/api/users/${userId}/mobile`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Error al cargar el estado de la app')
      setStatus(body)
    } catch (e: any) {
      setError(e.message)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const unbind = async () => {
    if (
      !confirm(
        'Al desvincular el teléfono, el empleado deberá vincular de nuevo un teléfono para usar la app, y se cerrará la sesión abierta en el teléfono actual. ¿Continuar?'
      )
    ) {
      return
    }
    setUnbinding(true)
    try {
      const response = await fetch(`/api/users/${userId}/mobile/device`, { method: 'DELETE' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Error al desvincular el teléfono')
      toast.success('Teléfono desvinculado')
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUnbinding(false)
    }
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-orange-400" />
        App móvil
      </h3>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!status && !error && <p className="text-sm text-gray-500">Cargando…</p>}

      {status && (
        <div className="border border-gray-800 rounded-lg divide-y divide-gray-800">
          <div className="px-4 py-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-gray-300">Autorización de datos</p>
              <p className="text-sm text-gray-500">Versión vigente: {status.consent.currentVersion}</p>
            </div>
            {status.consent.accepted ? (
              <span className="inline-flex items-center gap-1 text-sm text-green-400 text-right">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Aceptada el {fmt(status.consent.lastAcceptedAt!)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm text-gray-400 text-right">
                <Clock className="w-4 h-4 shrink-0" />
                {status.consent.lastAcceptedVersion
                  ? `Pendiente (aceptó la versión ${status.consent.lastAcceptedVersion})`
                  : 'Pendiente'}
              </span>
            )}
          </div>

          <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-gray-300">Teléfono vinculado</p>
              {status.device ? (
                <p className="text-sm text-gray-500">
                  {status.device.deviceModel || 'Modelo desconocido'}
                  {status.device.platform && ` · ${status.device.platform === 'ios' ? 'iPhone' : 'Android'}`}
                  {` · desde el ${fmt(status.device.boundAt)}`}
                  {status.device.appVersion && ` · app ${status.device.appVersion}`}
                </p>
              ) : (
                <p className="text-sm text-gray-500">Ninguno. Se vincula al activar la app.</p>
              )}
            </div>
            {status.device && status.canManage && (
              <Button type="button" variant="danger" size="sm" onClick={unbind} isLoading={unbinding}>
                <Unlink className="w-4 h-4 mr-1" />
                Desvincular teléfono
              </Button>
            )}
          </div>

          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-gray-300">Registro facial</p>
            <span className="text-sm text-gray-500">Próximamente</span>
          </div>
        </div>
      )}
    </div>
  )
}
