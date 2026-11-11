// Prueba de extremo a extremo de la API móvil (Fase 1).
//
// Requisitos: Postgres local migrado y `npm run dev:local` corriendo.
// Uso: npm run mobile:smoke            (BASE_URL opcional, por defecto http://localhost:3000)
//
// Crea y borra su propio usuario de prueba. Solo corre contra una base LOCAL.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const API = `${BASE}/api/mobile/v1`

const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').hostname
  } catch {
    return null
  }
})()
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error(`BLOQUEADO: esta prueba solo corre contra una base local (host: ${host})`)
  process.exit(1)
}

const prisma = new PrismaClient()
const EMAIL = 'smoke.mobile@prueba.local'
const PASSWORD = 'Smoke-Test-2026!'
// Cada ejecución usa una IP distinta para no chocar con el límite por IP de corridas anteriores
const FAKE_IP = `10.99.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`

let passed = 0
let failed = 0
function check(name, cond, extra = '') {
  if (cond) passed++
  else failed++
  console.log(`${cond ? '  OK ' : '  FALLO'}  ${name}${cond ? '' : `  -> ${extra}`}`)
}

async function call(method, path, { body, token, headers } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
      'x-forwarded-for': FAKE_IP,
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { status: res.status, data: json?.data, code: json?.error?.code, json, headers: res.headers }
}

const login = (password = PASSWORD, email = EMAIL) =>
  call('POST', '/auth/login', {
    body: { email, password, device: { installationId: 'smoke-install-0001', platform: 'android', deviceModel: 'Smoke', appVersion: '0.0.1' } },
  })

async function resetUser() {
  await prisma.mobileLoginAttempt.deleteMany({ where: { OR: [{ key: { startsWith: `email:${EMAIL}` } }, { key: { startsWith: 'email:nadie@' } }] } })
  const password = await bcrypt.hash(PASSWORD, 12)
  return prisma.user.upsert({
    where: { email: EMAIL },
    update: { password, isActive: true, cedula: '1000000001', phone: '3000000000', position: 'Prueba' },
    create: { email: EMAIL, name: 'Smoke Mobile', password, role: 'USER', cedula: '1000000001', phone: '3000000000', position: 'Prueba' },
  })
}

async function main() {
  const user = await resetUser()
  await prisma.userPermission.deleteMany({ where: { userId: user.id } })
  await prisma.userPermission.create({ data: { userId: user.id, module: 'dashboard', canView: true, canEdit: false } })

  console.log('\n1. Login')
  let r = await login()
  check('login correcto responde 200', r.status === 200, `${r.status} ${r.code}`)
  check('devuelve accessToken, refreshToken y usuario', !!r.data?.accessToken && !!r.data?.refreshToken && r.data?.user?.email === EMAIL)
  check('la respuesta no incluye la contraseña', !JSON.stringify(r.json).includes('$2b$'))
  check('Cache-Control: no-store', r.headers.get('cache-control') === 'no-store')
  let { accessToken, refreshToken } = r.data ?? {}
  const sessionsAfterLogin = await prisma.mobileSession.findMany({ where: { userId: user.id, revokedAt: null } })
  check('el refresh token NO se guarda en claro', sessionsAfterLogin.every((s) => s.refreshTokenHash !== refreshToken && s.refreshTokenHash.length === 64))

  console.log('\n2. Credenciales incorrectas')
  const bad = await login('Clave-Equivocada-1!')
  const ghost = await login('Clave-Equivocada-1!', 'nadie@prueba.local')
  check('contraseña errónea -> 401 INVALID_CREDENTIALS', bad.status === 401 && bad.code === 'INVALID_CREDENTIALS', `${bad.status} ${bad.code}`)
  check('correo inexistente -> mismo código y estado', ghost.status === bad.status && ghost.code === bad.code, `${ghost.status} ${ghost.code}`)
  check('mismo mensaje en ambos casos', ghost.json?.error?.message === bad.json?.error?.message)

  console.log('\n3. Validación')
  r = await call('POST', '/auth/login', { body: { email: 'no-es-correo', password: '' } })
  check('datos inválidos -> 400 VALIDATION_ERROR con detalles', r.status === 400 && r.code === 'VALIDATION_ERROR' && Array.isArray(r.json?.error?.details), `${r.status} ${r.code}`)
  r = await call('POST', '/auth/login', { body: '{esto no es json' })
  check('JSON mal formado -> 400 VALIDATION_ERROR', r.status === 400 && r.code === 'VALIDATION_ERROR', `${r.status} ${r.code}`)

  console.log('\n4. Perfil y token')
  r = await call('GET', '/me', { token: accessToken })
  check('GET /me con token -> perfil', r.status === 200 && r.data?.email === EMAIL && r.data?.cedula === '1000000001' && r.data?.phone === '3000000000', `${r.status} ${r.code}`)
  check('incluye permisos por módulo', r.data?.permissions?.some((p) => p.module === 'dashboard' && p.canView) && r.data?.isSuperAdmin === false)
  r = await call('GET', '/me')
  check('sin token -> 401 TOKEN_MISSING', r.status === 401 && r.code === 'TOKEN_MISSING', `${r.status} ${r.code}`)
  r = await call('GET', '/me', { token: accessToken.slice(0, -4) + 'AAAA' })
  check('token alterado -> 401 TOKEN_INVALID', r.status === 401 && r.code === 'TOKEN_INVALID', `${r.status} ${r.code}`)
  r = await call('GET', '/me', { token: 'basura' })
  check('texto cualquiera -> 401 TOKEN_INVALID', r.status === 401 && r.code === 'TOKEN_INVALID', `${r.status} ${r.code}`)
  r = await call('GET', '/me', { token: refreshToken })
  check('el refresh token no sirve como access token', r.status === 401 && r.code === 'TOKEN_INVALID', `${r.status} ${r.code}`)

  console.log('\n5. Renovación')
  const oldRefresh = refreshToken
  r = await call('POST', '/auth/refresh', { body: { refreshToken } })
  check('refresh -> tokens nuevos', r.status === 200 && r.data?.refreshToken && r.data.refreshToken !== oldRefresh, `${r.status} ${r.code}`)
  accessToken = r.data.accessToken
  refreshToken = r.data.refreshToken
  r = await call('GET', '/me', { token: accessToken })
  check('el access token nuevo funciona', r.status === 200)
  r = await call('POST', '/auth/refresh', { body: { refreshToken: oldRefresh } })
  check('token anterior dentro de 2 min -> aceptado (reintento)', r.status === 200 && !!r.data?.refreshToken, `${r.status} ${r.code}`)
  refreshToken = r.data.refreshToken
  accessToken = r.data.accessToken
  // Simula que ya pasaron 3 minutos desde la rotación
  await prisma.mobileSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { rotatedAt: new Date(Date.now() - 3 * 60 * 1000) } })
  r = await call('POST', '/auth/refresh', { body: { refreshToken: oldRefresh } })
  check('token anterior fuera del margen -> 401 SESSION_REVOKED', r.status === 401 && r.code === 'SESSION_REVOKED', `${r.status} ${r.code}`)
  r = await call('GET', '/me', { token: accessToken })
  check('...y la sesión entera queda revocada', r.status === 401 && r.code === 'SESSION_REVOKED', `${r.status} ${r.code}`)
  r = await call('POST', '/auth/refresh', { body: { refreshToken } })
  check('...incluido su refresh token vigente', r.status === 401 && r.code === 'SESSION_REVOKED', `${r.status} ${r.code}`)
  r = await call('POST', '/auth/refresh', { body: { refreshToken: 'x'.repeat(43) } })
  check('refresh token desconocido -> 401 TOKEN_INVALID', r.status === 401 && r.code === 'TOKEN_INVALID', `${r.status} ${r.code}`)

  console.log('\n6. Cierre de sesión')
  r = await login()
  ;({ accessToken, refreshToken } = r.data)
  r = await call('POST', '/auth/logout', { token: accessToken })
  check('logout -> 200', r.status === 200, `${r.status} ${r.code}`)
  r = await call('GET', '/me', { token: accessToken })
  check('el access token deja de servir de inmediato', r.status === 401 && r.code === 'SESSION_REVOKED', `${r.status} ${r.code}`)
  r = await call('POST', '/auth/refresh', { body: { refreshToken } })
  check('el refresh token tampoco sirve', r.status === 401 && r.code === 'SESSION_REVOKED', `${r.status} ${r.code}`)

  console.log('\n7. Usuario desactivado')
  r = await login()
  ;({ accessToken, refreshToken } = r.data)
  await prisma.user.update({ where: { id: user.id }, data: { isActive: false } })
  r = await call('GET', '/me', { token: accessToken })
  check('petición con token vivo -> 403 USER_INACTIVE', r.status === 403 && r.code === 'USER_INACTIVE', `${r.status} ${r.code}`)
  r = await call('POST', '/auth/refresh', { body: { refreshToken } })
  check('refresh -> 403 USER_INACTIVE', r.status === 403 && r.code === 'USER_INACTIVE', `${r.status} ${r.code}`)
  r = await login()
  check('login -> 403 USER_INACTIVE', r.status === 403 && r.code === 'USER_INACTIVE', `${r.status} ${r.code}`)
  r = await login('Clave-Equivocada-1!')
  check('desactivado + contraseña errónea -> no revela el estado', r.code === 'INVALID_CREDENTIALS', `${r.status} ${r.code}`)
  await resetUser()

  console.log('\n8. Cambio de contraseña')
  r = await login()
  ;({ accessToken, refreshToken } = r.data)
  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash('Otra-Clave-2026!', 12) } })
  r = await call('POST', '/auth/refresh', { body: { refreshToken } })
  check('refresh tras cambiar la contraseña -> 401 SESSION_REVOKED', r.status === 401 && r.code === 'SESSION_REVOKED', `${r.status} ${r.code}`)
  await resetUser()

  console.log('\n9. Límite de intentos')
  let last
  for (let i = 0; i < 5; i++) last = await login('Clave-Equivocada-1!')
  check('los 5 primeros fallos responden INVALID_CREDENTIALS', last.code === 'INVALID_CREDENTIALS', `${last.status} ${last.code}`)
  r = await login('Clave-Equivocada-1!')
  check('sexto intento -> 429 RATE_LIMITED', r.status === 429 && r.code === 'RATE_LIMITED', `${r.status} ${r.code}`)
  check('indica cuánto esperar', r.json?.error?.details?.retryAfterSeconds > 0)
  r = await login()
  check('bloqueado incluso con la contraseña correcta', r.status === 429, `${r.status} ${r.code}`)
  const row = await prisma.mobileLoginAttempt.findUnique({ where: { key: `email:${EMAIL}` } })
  check('el bloqueo está guardado en Postgres (sobrevive a reinicios)', !!row?.blockedUntil && row.blockedUntil > new Date())

  console.log('\n10. Aislamiento respecto a la web')
  const web = await fetch(`${BASE}/api/users`)
  check('/api/users sin cookie sigue en 401', web.status === 401, String(web.status))
  const health = await fetch(`${BASE}/api/health`)
  check('/api/health responde 200', health.status === 200, String(health.status))
  const webWithBearer = await fetch(`${BASE}/api/users`, { headers: { authorization: `Bearer ${accessToken}` } })
  check('un token móvil NO abre las rutas web', webWithBearer.status === 401, String(webWithBearer.status))
  const csrf = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://sitio-ajeno.example' }, body: '{}' })
  check('la API móvil no depende de la comprobación de origen web', csrf.status === 400, String(csrf.status))
}

main()
  .catch((e) => {
    failed++
    console.error('\nERROR inesperado:', e)
  })
  .finally(async () => {
    // Limpieza: el usuario de prueba y todo lo suyo
    const u = await prisma.user.findUnique({ where: { email: EMAIL } })
    if (u) await prisma.user.delete({ where: { id: u.id } })
    await prisma.mobileLoginAttempt.deleteMany({ where: { OR: [{ key: `email:${EMAIL}` }, { key: 'email:nadie@prueba.local' }, { key: `ip:${FAKE_IP}` }] } })
    await prisma.$disconnect()
    console.log(`\nResultado: ${passed} correctas, ${failed} fallidas`)
    process.exit(failed ? 1 : 0)
  })
