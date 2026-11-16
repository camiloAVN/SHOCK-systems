/**
 * Reglas de la marcación (docs/decisiones.md, 2.7). Lógica pura, sin Prisma ni Rekognition,
 * para poder probarla con todos los casos. El servidor aplica estas funciones; la app nunca
 * decide el resultado.
 */
import { ATTENDANCE_CONFIG } from './config'
import { distanceMeters, type LatLng } from './geo'
import { shiftPhase, type ShiftTimes } from './shifts'

export type MarkType = 'IN' | 'OUT'
export type MarkStatus = 'VALID' | 'PENDING_REVIEW' | 'FACE_MISMATCH' | 'REJECTED'
export type MarkReason = 'OUT_OF_AREA' | 'LOW_GPS_ACCURACY' | 'FACE_MISMATCH' | 'NO_FACE' | 'MOCK_LOCATION' | 'DEVICE_NOT_BOUND'

/** Solo estas marcaciones cuentan para el par entrada/salida */
export const COUNTED_STATUSES: MarkStatus[] = ['VALID', 'PENDING_REVIEW']

/**
 * Tipo de la próxima marcación en un turno: si la última marcación que cuenta es una entrada,
 * toca salida; si no, entrada. (Los intentos fallidos y los rechazados no cuentan.)
 */
export function nextMarkType(countedMarks: { type: MarkType; officialAt: Date }[]): { next: MarkType; openEntryAt: Date | null } {
  const last = [...countedMarks].sort((a, b) => b.officialAt.getTime() - a.officialAt.getTime())[0]
  return last?.type === 'IN' ? { next: 'OUT', openEntryAt: last.officialAt } : { next: 'IN', openEntryAt: null }
}

/**
 * ¿Se puede marcar ahora? La ENTRADA exige la ventana abierta; la SALIDA se permite siempre
 * que haya una entrada abierta, aunque la ventana ya haya cerrado (decisiones, 2.6).
 */
export function canMarkNow(type: MarkType, shift: ShiftTimes, now: Date): { ok: true } | { ok: false; reason: 'NOT_YET_OPEN' | 'CLOSED' } {
  if (type === 'OUT') return { ok: true }
  const phase = shiftPhase(shift, now)
  if (phase === 'upcoming') return { ok: false, reason: 'NOT_YET_OPEN' }
  if (phase === 'expired') return { ok: false, reason: 'CLOSED' }
  return { ok: true }
}

/** Rechazo inmediato, sin comparar el rostro (queda registro del intento). */
export function rejectionReasons(params: { mocked: boolean; deviceBound: boolean }): MarkReason[] {
  const reasons: MarkReason[] = []
  if (!params.deviceBound) reasons.push('DEVICE_NOT_BOUND')
  if (params.mocked) reasons.push('MOCK_LOCATION')
  return reasons
}

export type FaceResult = { found: false } | { found: true; similarity: number | null }

/** ¿El rostro coincide? `similarity` = mejor coincidencia de CompareFaces (null = ninguna). */
export function faceMatches(face: FaceResult): { ok: boolean; reason: MarkReason | null } {
  if (!face.found) return { ok: false, reason: 'NO_FACE' }
  if (face.similarity === null || face.similarity < ATTENDANCE_CONFIG.face.minSimilarity) return { ok: false, reason: 'FACE_MISMATCH' }
  return { ok: true, reason: null }
}

/** Con el rostro correcto: válida, o pendiente de revisión si estaba fuera del área o el GPS era impreciso. */
export function evaluateLocation(
  position: LatLng & { accuracyMeters: number | null },
  area: LatLng & { radiusMeters: number }
): { status: 'VALID' | 'PENDING_REVIEW'; reasons: MarkReason[]; distanceMeters: number } {
  const distance = distanceMeters(position, area)
  const reasons: MarkReason[] = []
  if (distance > area.radiusMeters) reasons.push('OUT_OF_AREA')
  if (position.accuracyMeters === null || position.accuracyMeters > ATTENDANCE_CONFIG.geo.maxGpsAccuracyMeters) reasons.push('LOW_GPS_ACCURACY')
  return { status: reasons.length ? 'PENDING_REVIEW' : 'VALID', reasons, distanceMeters: Math.round(distance * 10) / 10 }
}

/**
 * Intentos de rostro fallidos que cuentan para el bloqueo: los del turno desde el último
 * desbloqueo. Devuelve si con este conteo el turno queda bloqueado y cuántos quedan.
 */
export function faceAttemptsState(failedSinceUnlock: number): { locked: boolean; attemptsLeft: number } {
  const max = ATTENDANCE_CONFIG.face.maxFailedAttemptsPerShift
  return { locked: failedSinceUnlock >= max, attemptsLeft: Math.max(0, max - failedSinceUnlock) }
}
