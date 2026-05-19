import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcrypt'
import { prisma } from '@/lib/db/prisma'
import { checkRateLimit, resetRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/security/rate-limiter'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'Contrasena requerida'),
})

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  return 'unknown'
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request)

  // Check rate limit before processing
  const rateLimitResult = await checkRateLimit(
    `login:${clientIP}`,
    RATE_LIMIT_CONFIGS.login
  )

  // Add rate limit headers
  const headers = new Headers()
  headers.set('X-RateLimit-Limit', String(RATE_LIMIT_CONFIGS.login.maxAttempts))
  headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
  headers.set('X-RateLimit-Reset', String(rateLimitResult.resetTime))

  if (!rateLimitResult.success) {
    console.warn(`[SECURITY] Rate limit exceeded for IP: ${clientIP}`)
    return NextResponse.json(
      {
        error: 'Demasiados intentos de inicio de sesion. Intenta de nuevo mas tarde.',
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      },
      { status: 429, headers }
    )
  }

  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        image: true,
        isActive: true,
      },
    })

    // Use constant-time comparison to prevent timing attacks
    if (!user || !user.password) {
      await compare(password, '$2b$12$invalidhashtopreventtimingattacks')
      console.warn(`[SECURITY] Failed login attempt for email: ${email} from IP: ${clientIP}`)
      return NextResponse.json(
        { error: 'Credenciales invalidas' },
        { status: 401, headers }
      )
    }

    // Verificar cuenta activa (misma respuesta genérica para evitar enumeración)
    if (!user.isActive) {
      console.warn(`[SECURITY] Inactive user login attempt: ${email} from IP: ${clientIP}`)
      return NextResponse.json(
        { error: 'Credenciales invalidas' },
        { status: 401, headers }
      )
    }

    const isPasswordValid = await compare(password, user.password)

    if (!isPasswordValid) {
      console.warn(`[SECURITY] Invalid password for user: ${email} from IP: ${clientIP}`)
      return NextResponse.json(
        { error: 'Credenciales invalidas' },
        { status: 401, headers }
      )
    }

    // Reset rate limit on successful login
    await resetRateLimit(`login:${clientIP}`)

    console.info(`[AUTH] Successful login for user: ${email} from IP: ${clientIP}`)

    // Return user data (the actual session is handled by NextAuth)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    }, { headers })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos invalidos', details: error.issues },
        { status: 400, headers }
      )
    }

    console.error('[ERROR] Login error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500, headers }
    )
  }
}
