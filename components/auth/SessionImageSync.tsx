'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

/**
 * La foto de perfil se puede cambiar desde la app móvil, pero la sesión de la web
 * guarda una copia en su JWT. Al abrir el panel (y al volver a la pestaña) se compara
 * con la base de datos y, si cambió, se actualiza la sesión (el callback `jwt` solo
 * acepta `image` en un update).
 */
export function SessionImageSync() {
  const { data: session, status, update } = useSession()
  const current = session?.user?.image ?? null

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' })
        if (!res.ok) return
        const profile: { image: string | null } = await res.json()
        if (!cancelled && (profile.image ?? null) !== current) await update({ image: profile.image ?? null })
      } catch {
        // Sin conexión o error: se intenta de nuevo la próxima vez
      }
    }
    void check()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [status, current, update])

  return null
}
