import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignJWT } from 'jose'

// Estas pruebas no usan la base de datos: se sustituye el cliente de Prisma.
vi.mock('@/lib/db/prisma', () => ({ prisma: {} }))

import { ATTENDANCE_CONFIG } from '@/lib/attendance/config'
import { assertLocalDatabase, isLocalDatabaseUrl } from '@/lib/db/local-guard'
import { MobileApiError } from '@/lib/mobile/errors'
import { assertJwtConfigured, signAccessToken, verifyAccessToken } from '@/lib/mobile/jwt'
import { isBlocked, nextStateAfterFailure } from '@/lib/mobile/login-attempts'
import { decideRefresh, generateRefreshToken, hashToken, passwordFingerprint } from '@/lib/mobile/sessions'

const SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres-123'
const claims = { userId: 'user_1', sessionId: 'sess_1' }

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise
    return 'NO_ERROR'
  } catch (e) {
    return e instanceof MobileApiError ? e.code : `OTRO:${String(e)}`
  }
}

describe('access token (JWT)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('MOBILE_JWT_SECRET', SECRET)
  })

  it('firma y verifica un token válido', async () => {
    const { token, expiresInSeconds } = await signAccessToken(claims)
    expect(expiresInSeconds).toBe(ATTENDANCE_CONFIG.auth.accessTokenTtlSeconds)
    expect(await verifyAccessToken(token)).toEqual(claims)
  })

  it('no incluye rol ni permisos en el token', async () => {
    const { token } = await signAccessToken(claims)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    expect(Object.keys(payload).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sid', 'sub'])
  })

  it('rechaza un token expirado con TOKEN_EXPIRED', async () => {
    const { token } = await signAccessToken(claims, { expiresInSeconds: -10 })
    expect(await codeOf(verifyAccessToken(token))).toBe('TOKEN_EXPIRED')
  })

  it('rechaza un token firmado con otro secreto', async () => {
    const { token } = await signAccessToken(claims)
    vi.stubEnv('MOBILE_JWT_SECRET', 'otro-secreto-distinto-con-mas-de-32-caracteres')
    expect(await codeOf(verifyAccessToken(token))).toBe('TOKEN_INVALID')
  })

  it('rechaza un token alterado', async () => {
    const { token } = await signAccessToken(claims)
    const [h, p, s] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), sub: 'otro' })).toString('base64url')
    expect(await codeOf(verifyAccessToken(`${h}.${forged}.${s}`))).toBe('TOKEN_INVALID')
  })

  it('rechaza audiencia o emisor incorrectos', async () => {
    const key = new TextEncoder().encode(SECRET)
    const base = () => new SignJWT({ sid: 's' }).setProtectedHeader({ alg: 'HS256' }).setSubject('u').setExpirationTime('5m')
    const wrongAud = await base().setIssuer(ATTENDANCE_CONFIG.auth.issuer).setAudience('otra-app').sign(key)
    const wrongIss = await base().setIssuer('otro').setAudience(ATTENDANCE_CONFIG.auth.audience).sign(key)
    expect(await codeOf(verifyAccessToken(wrongAud))).toBe('TOKEN_INVALID')
    expect(await codeOf(verifyAccessToken(wrongIss))).toBe('TOKEN_INVALID')
  })

  it('rechaza texto que no es un JWT', async () => {
    expect(await codeOf(verifyAccessToken('no-es-un-token'))).toBe('TOKEN_INVALID')
  })

  it('sin secreto, o con secreto corto, responde SERVER_MISCONFIGURED', async () => {
    vi.stubEnv('MOBILE_JWT_SECRET', '')
    expect(() => assertJwtConfigured()).toThrowError(MobileApiError)
    expect(await codeOf(signAccessToken(claims))).toBe('SERVER_MISCONFIGURED')
    vi.stubEnv('MOBILE_JWT_SECRET', 'corto')
    expect(await codeOf(verifyAccessToken('x.y.z'))).toBe('SERVER_MISCONFIGURED')
  })

  it('el secreto de desarrollo no se admite en producción', async () => {
    vi.stubEnv('MOBILE_JWT_SECRET', 'dev-only-mobile-jwt-secret-solo-para-desarrollo-local')
    expect(await codeOf(signAccessToken(claims))).toBe('NO_ERROR')
    vi.stubEnv('NODE_ENV', 'production')
    expect(await codeOf(signAccessToken(claims))).toBe('SERVER_MISCONFIGURED')
  })
})

describe('refresh token', () => {
  it('genera tokens únicos y guarda solo el hash', () => {
    const a = generateRefreshToken()
    const b = generateRefreshToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(43)
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(a)).toBe(hashToken(a))
    expect(hashToken(a)).not.toContain(a)
  })

  it('la huella cambia cuando cambia la contraseña', () => {
    expect(passwordFingerprint('$2b$12$hashA')).not.toBe(passwordFingerprint('$2b$12$hashB'))
  })

  const now = new Date('2026-11-11T12:00:00Z')
  const grace = ATTENDANCE_CONFIG.auth.refreshReuseGraceMs
  const session = (over: Partial<Parameters<typeof decideRefresh>[0]> = {}) => ({
    refreshTokenHash: 'actual',
    previousTokenHash: 'anterior' as string | null,
    rotatedAt: new Date(now.getTime() - 30_000) as Date | null,
    expiresAt: new Date(now.getTime() + 86_400_000),
    revokedAt: null as Date | null,
    ...over,
  })

  it('token vigente: rota', () => {
    expect(decideRefresh(session(), 'actual', now)).toBe('rotate')
  })
  it('token anterior dentro del margen: reintento aceptado', () => {
    expect(decideRefresh(session(), 'anterior', now)).toBe('retry_within_grace')
    expect(decideRefresh(session({ rotatedAt: new Date(now.getTime() - grace) }), 'anterior', now)).toBe('retry_within_grace')
  })
  it('token anterior fuera del margen: reutilización detectada', () => {
    expect(decideRefresh(session({ rotatedAt: new Date(now.getTime() - grace - 1) }), 'anterior', now)).toBe('reuse_detected')
  })
  it('sesión revocada o caducada', () => {
    expect(decideRefresh(session({ revokedAt: now }), 'actual', now)).toBe('revoked')
    expect(decideRefresh(session({ expiresAt: now }), 'actual', now)).toBe('expired')
  })
  it('revocada tiene prioridad sobre el margen', () => {
    expect(decideRefresh(session({ revokedAt: now }), 'anterior', now)).toBe('revoked')
  })
})

describe('límite de intentos de login', () => {
  const cfg = { maxAttempts: 5, windowMs: 15 * 60_000, blockMs: 30 * 60_000 }
  const t0 = new Date('2026-11-11T12:00:00Z')
  const at = (min: number) => new Date(t0.getTime() + min * 60_000)

  it('bloquea al quinto fallo y no antes', () => {
    let state = null as ReturnType<typeof nextStateAfterFailure> | null
    for (let i = 1; i <= 4; i++) {
      state = nextStateAfterFailure(state, at(i), cfg)
      expect(isBlocked(state, at(i))).toBe(false)
    }
    state = nextStateAfterFailure(state, at(5), cfg)
    expect(state.count).toBe(5)
    expect(isBlocked(state, at(5))).toBe(true)
    expect(isBlocked(state, at(34))).toBe(true)
    expect(isBlocked(state, at(36))).toBe(false)
  })

  it('la ventana se reinicia pasados 15 minutos', () => {
    let state = nextStateAfterFailure(null, at(0), cfg)
    state = nextStateAfterFailure(state, at(1), cfg)
    state = nextStateAfterFailure(state, at(20), cfg)
    expect(state.count).toBe(1)
    expect(state.windowStart).toEqual(at(20))
  })

  it('tras cumplirse el bloqueo se empieza de cero', () => {
    let state = null as ReturnType<typeof nextStateAfterFailure> | null
    for (let i = 0; i < 5; i++) state = nextStateAfterFailure(state, at(0), cfg)
    const after = nextStateAfterFailure(state, at(31), cfg)
    expect(after.count).toBe(1)
    expect(after.blockedUntil).toBeNull()
  })

  it('sin registro previo no hay bloqueo', () => {
    expect(isBlocked(null, t0)).toBe(false)
  })
})

describe('protección de la base de producción', () => {
  it('acepta solo hosts locales', () => {
    expect(isLocalDatabaseUrl('postgresql://shock:shock123@localhost:5433/shock_db')).toBe(true)
    expect(isLocalDatabaseUrl('postgresql://u:p@127.0.0.1:5432/db')).toBe(true)
    expect(isLocalDatabaseUrl('postgresql://u:p@postgres.railway.internal:5432/railway')).toBe(false)
    expect(isLocalDatabaseUrl('postgresql://u:p@monorail.proxy.rlwy.net:12345/railway')).toBe(false)
    expect(isLocalDatabaseUrl('postgresql://u:p@localhost.evil.com:5432/db')).toBe(false)
  })
  it('falla cerrado si falta o es ilegible', () => {
    expect(isLocalDatabaseUrl(undefined)).toBe(false)
    expect(isLocalDatabaseUrl('')).toBe(false)
    expect(isLocalDatabaseUrl('no es una url')).toBe(false)
    expect(() => assertLocalDatabase('postgresql://u:p@postgres.railway.internal:5432/x')).toThrow(/BLOQUEADO/)
    expect(() => assertLocalDatabase(undefined)).not.toThrow(/secreto|password/i)
  })
  it('el mensaje de error no filtra credenciales', () => {
    try {
      assertLocalDatabase('postgresql://usuario:clave-secreta@prod.example.com:5432/x')
    } catch (e) {
      expect((e as Error).message).not.toContain('clave-secreta')
      expect((e as Error).message).toContain('prod.example.com')
    }
  })
})
