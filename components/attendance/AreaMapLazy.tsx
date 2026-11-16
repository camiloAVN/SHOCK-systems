'use client'

import dynamic from 'next/dynamic'

/** El mapa usa WebGL y APIs del navegador: se carga solo en el cliente. */
export const AreaMapLazy = dynamic(() => import('./AreaMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center rounded-2xl border border-white/[0.07] bg-[#141414]/80 text-sm text-gray-500">
      Cargando mapa…
    </div>
  ),
})

export type { MapCircle } from './AreaMap'
