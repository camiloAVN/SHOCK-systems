'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'

/** Foto bajo demanda: se pide una URL firmada (5 min) al tocarla; cada vista queda en la bitácora. */
export function ProtectedPhoto({ url, label }: { url: string | null; label: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!url) return <div className="flex h-40 w-32 items-center justify-center rounded-xl border border-white/10 bg-black/30 px-2 text-center text-xs text-gray-500">Sin foto</div>
  if (!src) {
    return (
      <button
        type="button"
        onClick={async () => {
          setLoading(true)
          setError(null)
          try {
            const r = await fetch(url)
            const body = await r.json()
            if (!r.ok) throw new Error(body.error || 'No se pudo cargar')
            setSrc(body.url)
          } catch (e: any) {
            setError(e.message)
          } finally {
            setLoading(false)
          }
        }}
        className="flex h-40 w-32 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-black/30 px-2 text-center text-xs text-gray-400 hover:border-orange-500/40 hover:text-orange-300"
      >
        <Eye className="h-5 w-5" />
        {loading ? 'Cargando…' : error ?? label}
      </button>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={label} className="h-40 w-32 rounded-xl border border-white/10 object-cover" onError={() => setSrc(null)} />
}
