import { NextRequest, NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { MobileApiError, mobileFail } from '@/lib/mobile/errors'
import { verifyAccessToken } from '@/lib/mobile/jwt'

/**
 * Envoltorio OBLIGATORIO de toda ruta bajo /api/mobile.
 *
 * `/api/mobile` está fuera de la protección por cookie de `middleware.ts`, así
 * que una ruta que no use `authedMobileRoute` queda pública. Usa
 * `publicMobileRoute` solo para login y refresh.
 */

export type MobileActor = {
  userId: string
  sessionId: string
  role: 'SUPERADMIN' | 'ADMIN' | 'USER'
  /** Id de instalación con el que se inició la sesión (identifica el teléfono) */
  installationId: string | null
}

type RouteContext = { params: Promise<Record<string, string>> }
type PublicHandler = (request: NextRequest, context: RouteContext) => Promise<NextResponse>
type AuthedHandler = (request: NextRequest, actor: MobileActor, context: RouteContext) => Promise<NextResponse>

function toErrorResponse(error: unknown, request: NextRequest) {
  if (error instanceof MobileApiError) return mobileFail(error)
  if (error instanceof ZodError) {
    return mobileFail(
      new MobileApiError(
        'VALIDATION_ERROR',
        error.issues[0]?.message,
        error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
      )
    )
  }
  console.error(`[MOBILE] Error no controlado en ${request.method} ${request.nextUrl.pathname}:`, error)
  return mobileFail(new MobileApiError('INTERNAL_ERROR'))
}

/** Lee y valida el cuerpo JSON. Un cuerpo ausente o mal formado es VALIDATION_ERROR. */
export async function parseBody<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new MobileApiError('VALIDATION_ERROR', 'El cuerpo debe ser JSON válido')
  }
  return schema.parse(raw)
}

/**
 * Autentica la petición con el access token y comprueba en la BD, en cada
 * llamada, que la sesión siga viva y el usuario activo. El rol se lee de la BD,
 * nunca del token.
 */
export async function authenticateMobile(request: NextRequest): Promise<MobileActor> {
  const header = request.headers.get('authorization')
  const match = header?.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new MobileApiError('TOKEN_MISSING')

  const claims = await verifyAccessToken(match[1].trim())

  const session = await prisma.mobileSession.findUnique({
    where: { id: claims.sessionId },
    select: {
      userId: true,
      revokedAt: true,
      expiresAt: true,
      installationId: true,
      user: { select: { isActive: true, role: true } },
    },
  })

  if (!session || session.userId !== claims.userId) throw new MobileApiError('TOKEN_INVALID')
  if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw new MobileApiError('SESSION_REVOKED')
  if (!session.user.isActive) throw new MobileApiError('USER_INACTIVE')

  return {
    userId: claims.userId,
    sessionId: claims.sessionId,
    role: session.user.role,
    installationId: session.installationId,
  }
}

export function publicMobileRoute(handler: PublicHandler) {
  return async (request: NextRequest, context: RouteContext) => {
    try {
      return await handler(request, context)
    } catch (error) {
      return toErrorResponse(error, request)
    }
  }
}

export function authedMobileRoute(handler: AuthedHandler) {
  return async (request: NextRequest, context: RouteContext) => {
    try {
      const actor = await authenticateMobile(request)
      return await handler(request, actor, context)
    } catch (error) {
      return toErrorResponse(error, request)
    }
  }
}
