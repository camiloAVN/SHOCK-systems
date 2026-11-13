import { describe, expect, it, vi } from 'vitest'
import type { FaceDetail } from '@aws-sdk/client-rekognition'

vi.mock('@/lib/db/prisma', () => ({ prisma: {} }))

import { evaluateEnrollmentQuality, isJpeg } from '@/lib/attendance/rekognition'
import { enrollmentActivationFrom, randomChallenge, reviewTransition } from '@/lib/attendance/enrollment'

// Respuesta real de DetectFaces de la Fase 0 (foto de referencia del dueño), recortada
const GOOD: FaceDetail = {
  BoundingBox: { Width: 0.42, Height: 0.55, Left: 0.29, Top: 0.18 },
  Confidence: 99.9997,
  Pose: { Yaw: -0.92, Pitch: 4.1, Roll: -1.3 },
  Quality: { Sharpness: 98.56, Brightness: 81.94 },
}
const face = (over: Partial<FaceDetail> = {}): FaceDetail => ({
  ...GOOD,
  ...over,
  Pose: { ...GOOD.Pose, ...over.Pose },
  Quality: { ...GOOD.Quality, ...over.Quality },
  BoundingBox: { ...GOOD.BoundingBox, ...over.BoundingBox },
})
const problemsOf = (faces: FaceDetail[]) => {
  const r = evaluateEnrollmentQuality(faces)
  return r.ok ? [] : r.problems
}

describe('calidad de la foto de referencia', () => {
  it('una foto buena de frente pasa y guarda sus métricas', () => {
    const r = evaluateEnrollmentQuality([GOOD])
    expect(r.ok).toBe(true)
    expect(r.quality).toMatchObject({ faces: 1, sharpness: 98.56, brightness: 81.94, yaw: -0.92, faceWidthRatio: 0.42 })
  })
  it('sin rostro / varios rostros', () => {
    expect(problemsOf([])).toEqual(['no_face'])
    expect(problemsOf([GOOD, face()])).toEqual(['multiple_faces'])
  })
  it('detecta cada problema de calidad', () => {
    expect(problemsOf([face({ Quality: { Brightness: 12 } })])).toContain('too_dark')
    expect(problemsOf([face({ Quality: { Brightness: 99.5 } })])).toContain('too_bright')
    expect(problemsOf([face({ Quality: { Sharpness: 8 } })])).toContain('blurry')
    expect(problemsOf([face({ Pose: { Yaw: 35 } })])).toContain('not_frontal')
    expect(problemsOf([face({ Pose: { Pitch: -28 } })])).toContain('not_frontal')
    expect(problemsOf([face({ BoundingBox: { Width: 0.08 } })])).toContain('too_far')
    expect(problemsOf([face({ Confidence: 90 })])).toContain('low_confidence')
  })
  it('acumula varios problemas a la vez', () => {
    expect(problemsOf([face({ Quality: { Brightness: 10, Sharpness: 5 } })])).toEqual(['too_dark', 'blurry'])
  })
  it('datos ausentes cuentan como mala calidad (falla cerrado)', () => {
    expect(problemsOf([{ Confidence: 99.9 }]).length).toBeGreaterThan(0)
  })
})

describe('formato de imagen', () => {
  it('reconoce un JPEG por sus bytes, no por el nombre', () => {
    expect(isJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe(true)
    expect(isJpeg(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe(false) // PNG
    expect(isJpeg(Buffer.from('no-es-imagen'))).toBe(false)
    expect(isJpeg(Buffer.alloc(0))).toBe(false)
  })
})

describe('reto de prueba de vida', () => {
  it('siempre un parpadeo y un giro, en los 4 órdenes posibles', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const steps = randomChallenge()
      expect(steps).toHaveLength(2)
      expect(steps).toContain('blink')
      seen.add(steps.join(','))
    }
    expect([...seen].sort()).toEqual(['blink,turn_left', 'blink,turn_right', 'turn_left,blink', 'turn_right,blink'])
  })
})

describe('estado del registro que ve el empleado', () => {
  const at = new Date('2026-11-13T15:00:00Z')
  const rec = (status: any, note: string | null = null) => ({ status, submittedAt: at, reviewedAt: status === 'PENDING' ? null : at, reviewNote: note })
  it('sin registros puede enviar', () => {
    expect(enrollmentActivationFrom(null)).toMatchObject({ status: 'none', canSubmit: true })
  })
  it('pendiente puede reenviar; aprobado no', () => {
    expect(enrollmentActivationFrom(rec('PENDING'))).toMatchObject({ status: 'pending', canSubmit: true })
    expect(enrollmentActivationFrom(rec('APPROVED'))).toMatchObject({ status: 'approved', canSubmit: false })
  })
  it('rechazado o anulado muestra el motivo y permite reintentar', () => {
    expect(enrollmentActivationFrom(rec('REJECTED', 'borrosa'))).toMatchObject({ status: 'rejected', note: 'borrosa', canSubmit: true })
    expect(enrollmentActivationFrom(rec('REVOKED', 'no es la persona'))).toMatchObject({ status: 'revoked', note: 'no es la persona', canSubmit: true })
  })
})

describe('transiciones de la revisión', () => {
  it('solo las permitidas', () => {
    expect(reviewTransition('PENDING', 'approve')).toBe('APPROVED')
    expect(reviewTransition('PENDING', 'reject')).toBe('REJECTED')
    expect(reviewTransition('APPROVED', 'revoke')).toBe('REVOKED')
    expect(reviewTransition('APPROVED', 'approve')).toBeNull()
    expect(reviewTransition('APPROVED', 'reject')).toBeNull()
    expect(reviewTransition('PENDING', 'revoke')).toBeNull()
    expect(reviewTransition('REJECTED', 'approve')).toBeNull()
    expect(reviewTransition('SUPERSEDED', 'approve')).toBeNull()
    expect(reviewTransition('REVOKED', 'approve')).toBeNull()
  })
})
