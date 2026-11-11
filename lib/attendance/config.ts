/**
 * ÚNICO archivo de configuración del módulo de asistencia y de la API móvil.
 * Todos los umbrales viven aquí; ninguna otra parte del código debe tener
 * estos números escritos a mano.
 *
 * Son valores iniciales acordados en docs/decisiones.md (sección 2.12) y se
 * ajustarán con los datos del piloto.
 */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const ATTENDANCE_CONFIG = {
  /** Autenticación de la app */
  auth: {
    accessTokenTtlSeconds: 15 * 60,
    /** Inactividad máxima: cada renovación vuelve a contar desde cero */
    refreshTokenTtlMs: 60 * DAY,
    /** Margen en que se sigue aceptando el refresh token anterior (respuesta perdida por mala señal) */
    refreshReuseGraceMs: 2 * MINUTE,
    issuer: 'xenith-platform',
    audience: 'xenith-mobile',
    /** Intentos fallidos de login por correo */
    loginByEmail: { maxAttempts: 5, windowMs: 15 * MINUTE, blockMs: 30 * MINUTE },
    /** Por IP el límite es más alto: muchos empleados pueden compartir la misma red */
    loginByIp: { maxAttempts: 30, windowMs: 15 * MINUTE, blockMs: 30 * MINUTE },
  },

  /** Comparación facial (Rekognition) */
  face: {
    minSimilarity: 90,
    maxFailedAttemptsPerShift: 3,
    selfieTargetBytes: 400 * 1024,
    selfieMaxBytes: 1024 * 1024,
  },

  /** Ubicación y áreas */
  geo: {
    maxGpsAccuracyMeters: 50,
    minAreaRadiusMeters: 30,
  },

  /** Turnos y ventana de marcación */
  shifts: {
    markBeforeStartMs: 2 * HOUR,
    markAfterEndMs: 6 * HOUR,
    lateToleranceMs: 5 * MINUTE,
  },
} as const

export type LoginLimitConfig = { maxAttempts: number; windowMs: number; blockMs: number }
