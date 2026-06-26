'use client'

import { useEffect, useRef } from 'react'
import { Viewer } from '@photo-sphere-viewer/core'
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin'
import '@photo-sphere-viewer/core/index.css'
import '@photo-sphere-viewer/markers-plugin/index.css'

export interface PanoMarker {
  id: string
  yaw: number
  pitch: number
  label: string
  highlight?: boolean
}

interface PanoramaViewerProps {
  panoramaUrl: string
  markers?: PanoMarker[]
  initialPosition?: { yaw: number; pitch: number } | null
  /** Si se provee, habilita modo editor: cada click devuelve la posición. */
  onClick?: (pos: { yaw: number; pitch: number }) => void
  className?: string
}

const HIGHLIGHT_HTML =
  '<div style="width:28px;height:28px;border-radius:9999px;background:rgba(249,115,22,0.95);border:3px solid #fff;box-shadow:0 0 0 6px rgba(249,115,22,0.35),0 2px 6px rgba(0,0,0,0.5);"></div>'
const DOT_HTML =
  '<div style="width:16px;height:16px;border-radius:9999px;background:rgba(148,163,184,0.9);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.5);"></div>'

function toMarkerConfig(m: PanoMarker) {
  return {
    id: m.id,
    position: { yaw: m.yaw, pitch: m.pitch },
    html: m.highlight ? HIGHLIGHT_HTML : DOT_HTML,
    size: m.highlight ? { width: 28, height: 28 } : { width: 16, height: 16 },
    anchor: 'center center',
    tooltip: { content: m.label, position: 'top center' },
  }
}

export default function PanoramaViewer({
  panoramaUrl,
  markers = [],
  initialPosition = null,
  onClick,
  className,
}: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const markersRef = useRef<PanoMarker[]>(markers)
  const onClickRef = useRef<typeof onClick>(onClick)
  const initialPositionRef = useRef(initialPosition)

  // Mantener refs actualizadas sin recrear el visor
  onClickRef.current = onClick
  markersRef.current = markers
  initialPositionRef.current = initialPosition

  // Crear / destruir el visor cuando cambia la panorámica.
  // Se difiere un tick y se cancela en el cleanup para evitar la doble
  // creación del React Strict Mode (que deja a PSV en "loading").
  useEffect(() => {
    let viewer: Viewer | null = null
    let cancelled = false

    const timer = setTimeout(() => {
      if (cancelled || !containerRef.current) return

      viewer = new Viewer({
        container: containerRef.current,
        panorama: panoramaUrl,
        navbar: ['zoom', 'fullscreen'],
        defaultYaw: initialPositionRef.current?.yaw ?? 0,
        defaultPitch: initialPositionRef.current?.pitch ?? 0,
        plugins: [[MarkersPlugin, { markers: [] }]],
      })
      viewerRef.current = viewer

      const markersPlugin = viewer.getPlugin<MarkersPlugin>(MarkersPlugin)

      viewer.addEventListener(
        'ready',
        () => {
          markersPlugin?.setMarkers(markersRef.current.map(toMarkerConfig))
        },
        { once: true }
      )

      viewer.addEventListener('click', ({ data }) => {
        if (onClickRef.current && !data.rightclick) {
          onClickRef.current({ yaw: data.yaw, pitch: data.pitch })
        }
      })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (viewer) {
        viewer.destroy()
        viewer = null
      }
      viewerRef.current = null
    }
    // Recrear sólo si cambia la imagen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panoramaUrl])

  // Actualizar marcadores cuando cambian
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const markersPlugin = viewer.getPlugin<MarkersPlugin>(MarkersPlugin)
    markersPlugin?.setMarkers(markers.map(toMarkerConfig))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(markers)])

  // Girar hacia la posición objetivo cuando cambia
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !initialPosition) return
    viewer.rotate({ yaw: initialPosition.yaw, pitch: initialPosition.pitch })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPosition?.yaw, initialPosition?.pitch])

  return <div ref={containerRef} className={className} />
}
