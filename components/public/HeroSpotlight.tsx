'use client'

import { useEffect, useRef } from 'react'

// Rejilla de puntos que se enciende alrededor del cursor. Adaptación ligera del
// fondo de Quordix Hero (21st.dev): en vez de redibujar un canvas en cada frame,
// solo mueve una máscara CSS, y únicamente mientras el cursor se mueve.
export function HeroSpotlight() {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = layerRef.current
    if (!layer || !window.matchMedia('(pointer: fine)').matches) return

    let frame = 0
    const onPointerMove = (event: PointerEvent) => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const rect = layer.getBoundingClientRect()
        layer.style.setProperty('--x', `${event.clientX - rect.left}px`)
        layer.style.setProperty('--y', `${event.clientY - rect.top}px`)
      })
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      cancelAnimationFrame(frame)
    }
  }, [])

  return <div ref={layerRef} className="hero-dots hero-dots-lit" aria-hidden="true" />
}
