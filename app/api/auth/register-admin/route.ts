import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcrypt'
import { prisma } from '@/lib/db/prisma'
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/security/rate-limiter'
import { z } from 'zod'

const setupSchema = z.object({
  setupKey: z.string().min(1, 'Setup key is required'),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
})

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    // Limitar intentos para que el setupKey no sea forzable por fuerza bruta.
    const clientIP = getClientIP(request)
    const rateLimit = await checkRateLimit(
      `register-admin:${clientIP}`,
      RATE_LIMIT_CONFIGS.passwordReset
    )
    if (!rateLimit.success) {
      console.warn(`[SECURITY] Rate limit exceeded for admin setup from IP: ${clientIP}`)
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { setupKey, email, password } = setupSchema.parse(body)

    // Verify setup key
    const validSetupKey = process.env.ADMIN_SETUP_KEY
    if (!validSetupKey || setupKey !== validSetupKey) {
      // Log failed attempt (in production, send to monitoring)
      console.warn(`[SECURITY] Failed admin setup attempt from IP: ${request.headers.get('x-forwarded-for') || 'unknown'}`)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use provided values or fall back to environment variables
    const adminEmail = email || process.env.ADMIN_EMAIL
    const adminPassword = password || process.env.ADMIN_PASSWORD

    if (!adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Admin credentials not configured' },
        { status: 500 }
      )
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    if (!passwordRegex.test(adminPassword)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' },
        { status: 400 }
      )
    }

    // Check if admin already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Admin user already exists' },
        { status: 400 }
      )
    }

    // Create admin user with hashed password (12 rounds for better security)
    const hashedPassword = await hash(adminPassword, 12)

    // El primer admin debe ser SUPERADMIN: es el único rol con acceso implícito
    // a todos los módulos (ADMIN/USER requieren registros UserPermission y, sin
    // ellos, quedarían bloqueados en una base de datos recién creada).
    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin SHOCK',
        password: hashedPassword,
        role: 'SUPERADMIN',
      },
    })

    // Log successful creation
    console.info(`[SECURITY] Admin user created: ${user.email}`)

    return NextResponse.json({
      message: 'Admin user created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('[ERROR] Error creating admin user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
