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
