import { CompareFacesCommand, DetectFacesCommand, RekognitionClient, type FaceDetail } from '@aws-sdk/client-rekognition'
import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import type { FaceResult } from '@/lib/attendance/mark-rules'

/**
 * Rekognition para la app de asistencia. Usa el usuario IAM técnico
 * `xenith-asistencia-rekognition` (solo CompareFaces y DetectFaces) a través de
 * AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.
 */

let client: RekognitionClient | null = null
function getClient(): RekognitionClient {
  if (!client) {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('Missing required env vars: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY')
    }
    client = new RekognitionClient({ region: process.env.AWS_REGION || 'us-east-1' })
  }
  return client
}

export async function detectFaces(image: Buffer): Promise<FaceDetail[]> {
  const result = await getClient().send(new DetectFacesCommand({ Image: { Bytes: image }, Attributes: ['DEFAULT'] }))
  return result.FaceDetails ?? []
}

/**
 * Compara la foto de referencia (aprobada) con la selfie de la marcación.
 * Devuelve la MEJOR similitud entre los rostros de la selfie (null si ninguno coincide),
 * o found=false si la selfie no tiene rostro. El umbral lo aplica mark-rules.ts.
 */
export async function compareFaces(reference: Buffer, selfie: Buffer): Promise<FaceResult> {
  try {
    const result = await getClient().send(
      new CompareFacesCommand({ SourceImage: { Bytes: reference }, TargetImage: { Bytes: selfie }, SimilarityThreshold: 0 })
    )
    const matches = result.FaceMatches ?? []
    const total = matches.length + (result.UnmatchedFaces?.length ?? 0)
    if (total === 0) return { found: false }
    const best = matches.reduce<number | null>((max, m) => (typeof m.Similarity === 'number' && (max === null || m.Similarity > max) ? m.Similarity : max), null)
    return { found: true, similarity: best === null ? null : Math.round(best * 100) / 100 }
  } catch (error) {
    // Rekognition responde InvalidParameterException cuando una imagen no tiene rostros
    if ((error as { name?: string })?.name === 'InvalidParameterException') return { found: false }
    throw error
  }
}

export type QualityProblem =
  | 'no_face'
  | 'multiple_faces'
  | 'low_confidence'
  | 'too_dark'
  | 'too_bright'
  | 'blurry'
  | 'not_frontal'
  | 'too_far'

export type FaceQuality = {
  faces: number
  confidence: number | null
  sharpness: number | null
  brightness: number | null
  yaw: number | null
  pitch: number | null
  roll: number | null
  faceWidthRatio: number | null
}

export type QualityResult = { ok: true; quality: FaceQuality } | { ok: false; problems: QualityProblem[]; quality: FaceQuality }

const round = (n: number | undefined | null) => (typeof n === 'number' ? Math.round(n * 100) / 100 : null)

/** Lógica pura: ¿sirve esta foto como referencia? Recibe la respuesta de DetectFaces. */
export function evaluateEnrollmentQuality(faces: FaceDetail[], cfg = ATTENDANCE_CONFIG.enrollment): QualityResult {
  const f = faces[0]
  const quality: FaceQuality = {
    faces: faces.length,
    confidence: round(f?.Confidence),
    sharpness: round(f?.Quality?.Sharpness),
    brightness: round(f?.Quality?.Brightness),
    yaw: round(f?.Pose?.Yaw),
    pitch: round(f?.Pose?.Pitch),
    roll: round(f?.Pose?.Roll),
    faceWidthRatio: round(f?.BoundingBox?.Width),
  }

  if (faces.length === 0) return { ok: false, problems: ['no_face'], quality }
  if (faces.length > 1) return { ok: false, problems: ['multiple_faces'], quality }

  const problems: QualityProblem[] = []
  if ((quality.confidence ?? 0) < cfg.minFaceConfidence) problems.push('low_confidence')
  if ((quality.brightness ?? 0) < cfg.minBrightness) problems.push('too_dark')
  if ((quality.brightness ?? 0) > cfg.maxBrightness) problems.push('too_bright')
  if ((quality.sharpness ?? 0) < cfg.minSharpness) problems.push('blurry')
  if (
    Math.abs(quality.yaw ?? 90) > cfg.maxYaw ||
    Math.abs(quality.pitch ?? 90) > cfg.maxPitch ||
    Math.abs(quality.roll ?? 90) > cfg.maxRoll
  ) {
    problems.push('not_frontal')
  }
  if ((quality.faceWidthRatio ?? 0) < cfg.minFaceWidthRatio) problems.push('too_far')

  return problems.length ? { ok: false, problems, quality } : { ok: true, quality }
}

/** Lógica pura: ¿es realmente un JPEG? (se miran los bytes, no lo que dice el cliente) */
export function isJpeg(buf: Buffer): boolean {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
}
