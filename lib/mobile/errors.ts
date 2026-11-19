import { NextResponse } from 'next/server'

/**
 * Códigos de error estables de la API móvil. La app decide qué hacer según
 * `code`, nunca según el texto de `message`. No renombrar códigos existentes.
 */
export const MOBILE_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  TOKEN_MISSING: 401,
  TOKEN_INVALID: 401,
  TOKEN_EXPIRED: 401,
  SESSION_REVOKED: 401,
  USER_INACTIVE: 403,
  RATE_LIMITED: 429,
  CONSENT_REQUIRED: 403,
  CONSENT_OUTDATED: 409,
  DEVICE_BOUND_ELSEWHERE: 409,
  DEVICE_NOT_BOUND: 403,
  LIVENESS_ATTEMPT_INVALID: 409,
  LIVENESS_ATTEMPT_EXPIRED: 409,
  IMAGE_TOO_LARGE: 413,
  INVALID_IMAGE: 400,
  FACE_NOT_FOUND: 422,
  MULTIPLE_FACES: 422,
  FACE_QUALITY_LOW: 422,
  ENROLLMENT_ALREADY_APPROVED: 409,
  ENROLLMENT_REQUIRED: 403,
  SHIFT_NOT_ASSIGNED: 403,
  SHIFT_LOCKED: 409,
  MARK_WINDOW_CLOSED: 409,
  CEDULA_TAKEN: 409,
  CEDULA_LOCKED: 409,
  SERVER_MISCONFIGURED: 500,
  INTERNAL_ERROR: 500,
} as const

export type MobileErrorCode = keyof typeof MOBILE_ERROR_STATUS

const DEFAULT_MESSAGES: Record<MobileErrorCode, string> = {
  VALIDATION_ERROR: 'Datos inválidos',
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos',
  TOKEN_MISSING: 'Falta el token de acceso',
  TOKEN_INVALID: 'Token inválido',
  TOKEN_EXPIRED: 'El token expiró',
  SESSION_REVOKED: 'La sesión fue cerrada. Inicia sesión de nuevo',
  USER_INACTIVE: 'Usuario desactivado',
  RATE_LIMITED: 'Demasiados intentos. Intenta más tarde',
  CONSENT_REQUIRED: 'Primero debes aceptar la autorización de tratamiento de datos',
  CONSENT_OUTDATED: 'El texto de la autorización cambió. Vuelve a leerlo y aceptarlo',
  DEVICE_BOUND_ELSEWHERE: 'Tu cuenta está vinculada a otro teléfono',
  DEVICE_NOT_BOUND: 'Este teléfono no está vinculado a tu cuenta',
  LIVENESS_ATTEMPT_INVALID: 'El intento de verificación no es válido. Vuelve a empezar',
  LIVENESS_ATTEMPT_EXPIRED: 'El intento de verificación caducó. Vuelve a empezar',
  IMAGE_TOO_LARGE: 'La foto es demasiado grande',
  INVALID_IMAGE: 'El archivo no es una foto válida',
  FACE_NOT_FOUND: 'No se detectó un rostro en la foto',
  MULTIPLE_FACES: 'Hay más de una persona en la foto',
  FACE_QUALITY_LOW: 'La foto no tiene la calidad suficiente',
  ENROLLMENT_ALREADY_APPROVED: 'Ya tienes un registro facial aprobado',
  ENROLLMENT_REQUIRED: 'Para marcar asistencia necesitas un registro facial aprobado',
  SHIFT_NOT_ASSIGNED: 'Este turno no está asignado a tu cuenta',
  SHIFT_LOCKED: 'Este turno está bloqueado por intentos fallidos de rostro. Un supervisor debe revisarlo',
  MARK_WINDOW_CLOSED: 'Fuera del horario en que se puede marcar este turno',
  CEDULA_TAKEN: 'Esa cédula ya está registrada en otra cuenta. Si es tuya, habla con un administrador',
  CEDULA_LOCKED: 'La cédula ya quedó registrada. Si está mal, pídele a un administrador que la corrija',
  SERVER_MISCONFIGURED: 'El servidor no está configurado para la app',
  INTERNAL_ERROR: 'Error interno',
}

export class MobileApiError extends Error {
  readonly code: MobileErrorCode
  readonly details?: unknown

  constructor(code: MobileErrorCode, message?: string, details?: unknown) {
    super(message ?? DEFAULT_MESSAGES[code])
    this.name = 'MobileApiError'
    this.code = code
    this.details = details
  }
}

const NO_STORE = { 'Cache-Control': 'no-store' }

export function mobileOk<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status, headers: NO_STORE })
}

export function mobileFail(error: MobileApiError) {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined && { details: error.details }),
      },
    },
    { status: MOBILE_ERROR_STATUS[error.code], headers: NO_STORE }
  )
}
