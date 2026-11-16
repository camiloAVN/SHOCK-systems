/**
 * Geometría de las áreas de asistencia. Lógica pura (sin Prisma ni Next), usable en el
 * servidor y en el navegador. La app tiene su propia copia de `distanceMeters`: si cambia
 * aquí, cambiarla también allá (C:\dev\xenith-asistencia\app\src\geo).
 */

export type LatLng = { latitude: number; longitude: number }

/** Radio medio de la Tierra (IUGG), en metros */
const EARTH_RADIUS_M = 6_371_008.8

const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

/** Distancia sobre la superficie (haversine), en metros. Error < 0,5 % frente al elipsoide. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Punto a `meters` de `origin` en el rumbo `bearingDeg` (0 = norte, 90 = este). */
export function destinationPoint(origin: LatLng, meters: number, bearingDeg: number): LatLng {
  const δ = meters / EARTH_RADIUS_M
  const θ = toRad(bearingDeg)
  const φ1 = toRad(origin.latitude)
  const λ1 = toRad(origin.longitude)
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))
  return { latitude: toDeg(φ2), longitude: ((toDeg(λ2) + 540) % 360) - 180 }
}

/**
 * Polígono GeoJSON que aproxima el círculo del área (los mapas no dibujan círculos en metros).
 * Devuelve el anillo cerrado en orden [lng, lat].
 */
export function circleRing(center: LatLng, radiusMeters: number, steps = 64): [number, number][] {
  const ring: [number, number][] = []
  for (let i = 0; i < steps; i++) {
    const p = destinationPoint(center, radiusMeters, (i * 360) / steps)
    ring.push([p.longitude, p.latitude])
  }
  ring.push(ring[0])
  return ring
}

export function isValidLatLng(p: LatLng): boolean {
  return (
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  )
}

/**
 * Lee coordenadas pegadas desde Google Maps u otra fuente: "4.6097, -74.0817",
 * "4.6097 -74.0817" o "4,6097; -74,0817". Devuelve null si no son válidas.
 */
export function parseCoordinates(text: string): LatLng | null {
  const t = text.trim()
  // Separador "; " o ", " / espacio con punto decimal
  let parts: string[]
  if (t.includes(';')) parts = t.split(';').map((s) => s.trim().replace(',', '.'))
  else if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(t)) parts = t.split(',').map((s) => s.trim())
  else parts = t.split(/\s+/).map((s) => s.replace(',', '.'))
  if (parts.length !== 2 || parts.some((p) => !/^-?\d+(\.\d+)?$/.test(p))) return null
  const point = { latitude: Number(parts[0]), longitude: Number(parts[1]) }
  return isValidLatLng(point) ? point : null
}
