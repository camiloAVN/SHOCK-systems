'use client'

import { useEffect, useRef } from 'react'
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { circleRing, type LatLng } from '@/lib/attendance/geo'

/**
 * Mapa de áreas de asistencia (MapLibre GL + OpenFreeMap, sin API key).
 * - Vista general: dibuja todos los círculos; clic en uno → onCircleClick.
 * - Editor: un círculo con marcador arrastrable; clic en el mapa mueve el centro.
 * Se carga solo en el navegador (next/dynamic con ssr:false) — ver AreaMapLazy.
 */

// MapLibre 6 calcula la URL de su worker en tiempo de ejecución, lo que no funciona empaquetado
// por Next. Así el empaquetador publica el archivo y nos da su URL (mismo origen: CSP worker-src 'self').
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href)

const ORANGE = '#F5920A'
const BOGOTA: [number, number] = [-74.0817, 4.6097]

export type MapCircle = { id: string; latitude: number; longitude: number; radiusMeters: number; muted?: boolean; selected?: boolean }

type Props = {
  styleUrl: string
  circles: MapCircle[]
  onCircleClick?: (id: string) => void
  /** Modo editor: centro y radio del área que se está editando */
  editor?: { center: LatLng | null; radiusMeters: number; onCenterChange: (center: LatLng) => void; readOnly?: boolean }
  /** Cambia este número para volver a encuadrar el mapa (p. ej. tras pegar coordenadas) */
  fitKey?: number
  className?: string
}

function toFeatures(circles: MapCircle[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: circles.map((c) => ({
      type: 'Feature',
      properties: { id: c.id, muted: !!c.muted, selected: !!c.selected },
      geometry: { type: 'Polygon', coordinates: [circleRing(c, c.radiusMeters)] },
    })),
  }
}

function boundsOf(circles: MapCircle[]): LngLatBounds | null {
  if (circles.length === 0) return null
  const b = new LngLatBounds()
  for (const c of circles) for (const p of circleRing(c, c.radiusMeters, 16)) b.extend(p)
  return b
}

export default function AreaMap({ styleUrl, circles, onCircleClick, editor, fitKey = 0, className }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const marker = useRef<Marker | null>(null)
  const loaded = useRef(false)
  // Tareas que esperan a que el mapa termine de cargar (se guarda la última de cada tipo)
  const pending = useRef<Record<string, () => void>>({})
  const whenLoaded = (name: string, fn: () => void) => {
    if (loaded.current) fn()
    else pending.current[name] = fn
  }

  // Últimos valores para los manejadores registrados una sola vez
  const latest = useRef({ circles, onCircleClick, editor })
  latest.current = { circles, onCircleClick, editor }

  // Círculos a dibujar: en el editor, el del área en edición
  const drawn: MapCircle[] = editor
    ? editor.center
      ? [{ id: 'editing', ...editor.center, radiusMeters: editor.radiusMeters, selected: true }]
      : []
    : circles

  // Crear el mapa una sola vez
  useEffect(() => {
    if (!container.current) return
    const m = new MapLibreMap({ container: container.current, style: styleUrl, center: BOGOTA, zoom: 11, attributionControl: { compact: true } })
    map.current = m
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right')

    m.on('load', () => {
      loaded.current = true
      m.addSource('areas', { type: 'geojson', data: toFeatures([]) })
      m.addLayer({
        id: 'areas-fill',
        type: 'fill',
        source: 'areas',
        paint: { 'fill-color': ['case', ['get', 'muted'], '#6b7280', ORANGE], 'fill-opacity': ['case', ['get', 'selected'], 0.3, 0.18] },
      })
      m.addLayer({
        id: 'areas-line',
        type: 'line',
        source: 'areas',
        paint: { 'line-color': ['case', ['get', 'muted'], '#6b7280', ORANGE], 'line-width': ['case', ['get', 'selected'], 3, 2] },
      })
      const tasks = pending.current
      pending.current = {}
      // Primero dibujar, después encuadrar
      tasks.redraw?.()
      tasks.fit?.()
    })

    m.on('click', 'areas-fill', (e) => {
      const id = e.features?.[0]?.properties?.id
      if (!latest.current.editor && id && latest.current.onCircleClick) latest.current.onCircleClick(String(id))
    })
    m.on('mouseenter', 'areas-fill', () => {
      if (!latest.current.editor && latest.current.onCircleClick) m.getCanvas().style.cursor = 'pointer'
    })
    m.on('mouseleave', 'areas-fill', () => {
      m.getCanvas().style.cursor = ''
    })
    m.on('click', (e) => {
      const ed = latest.current.editor
      if (ed && !ed.readOnly) ed.onCenterChange({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })
    })

    return () => {
      loaded.current = false
      pending.current = {}
      marker.current?.remove()
      marker.current = null
      m.remove()
      map.current = null
    }
    // El estilo solo se fija al crear el mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl])

  // Redibujar círculos y marcador cuando cambian los datos
  const drawnKey = JSON.stringify(drawn)
  useEffect(() => {
    const m = map.current
    if (!m) return
    const redraw = () => {
      ;(m.getSource('areas') as GeoJSONSource | undefined)?.setData(toFeatures(drawn))
      const ed = latest.current.editor
      if (ed?.center) {
        if (!marker.current) {
          marker.current = new Marker({ color: ORANGE, draggable: !ed.readOnly })
            .setLngLat([ed.center.longitude, ed.center.latitude])
            .addTo(m)
          marker.current.on('dragend', () => {
            const p = marker.current!.getLngLat()
            latest.current.editor?.onCenterChange({ latitude: p.lat, longitude: p.lng })
          })
        } else {
          marker.current.setLngLat([ed.center.longitude, ed.center.latitude])
        }
      } else if (marker.current) {
        marker.current.remove()
        marker.current = null
      }
    }
    whenLoaded('redraw', redraw)
    // drawnKey resume `drawn`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawnKey])

  // Encuadrar: al cargar con datos y cada vez que cambie fitKey
  const hasData = drawn.length > 0
  useEffect(() => {
    const m = map.current
    if (!m || !hasData) return
    const fit = () => {
      const b = boundsOf(drawn)
      if (b) m.fitBounds(b, { padding: 48, maxZoom: 17, duration: 600 })
    }
    whenLoaded('fit', fit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, hasData])

  return <div ref={container} className={className ?? 'h-[420px] w-full overflow-hidden rounded-2xl border border-white/[0.07]'} />
}
