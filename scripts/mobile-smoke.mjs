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

  await fase3(user)
}

// ───────────────────────── Fase 3: consentimiento, teléfono y web ─────────────────────────

const PHASE3_EMAILS = {
  admin: 'smoke.admin@prueba.local',
  admin2: 'smoke.admin2@prueba.local',
  plain: 'smoke.plain@prueba.local',
}

async function ensureUser(email, role, extra = {}) {
  const password = await bcrypt.hash(PASSWORD, 12)
  return prisma.user.upsert({
    where: { email },
    update: { password, role, isActive: true, ...extra },
    create: { email, name: email.split('@')[0], password, role, ...extra },
  })
}

/** Inicia sesión en la WEB (NextAuth) y devuelve la cabecera Cookie. */
async function webLogin(email, password = PASSWORD) {
  const jar = new Map()
  const keep = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';')
      const i = pair.indexOf('=')
      jar.set(pair.slice(0, i), pair.slice(i + 1))
    }
  }
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`)
  keep(csrfRes)
  const { csrfToken } = await csrfRes.json()
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookie() },
    body: new URLSearchParams({ csrfToken, email, password }).toString(),
  })
  keep(res)
  return cookie()
}

const web = (path, cookie, init = {}) =>
  fetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers ?? {}), cookie } }).then(async (r) => ({
    status: r.status,
    json: await r.json().catch(() => null),
  }))

async function loginAs(installationId) {
  const r = await call('POST', '/auth/login', {
    body: { email: EMAIL, password: PASSWORD, device: { installationId, platform: 'android', deviceModel: `Smoke ${installationId}`, appVersion: '0.0.3' } },
  })
  return r.data
}

async function fase3(user) {
  await resetUser()
  await prisma.mobileLoginAttempt.deleteMany({})
  await prisma.mobileDevice.deleteMany({ where: { userId: user.id } })
  await prisma.consentAcceptance.deleteMany({ where: { userId: user.id } })

  console.log('\n11. Consentimiento en el servidor')
  const phoneA = await loginAs('smoke-phone-AAAA')
  let r = await call('GET', '/me', { token: phoneA.accessToken })
  check('/me trae la activación: consentimiento pendiente, sin teléfono', r.data?.activation?.consent?.accepted === false && r.data?.activation?.device?.status === 'none', JSON.stringify(r.data?.activation))
  r = await call('POST', '/device', { token: phoneA.accessToken, body: { platform: 'android' } })
  check('vincular sin consentimiento -> 403 CONSENT_REQUIRED', r.status === 403 && r.code === 'CONSENT_REQUIRED', `${r.status} ${r.code}`)
  const doc = await call('GET', '/consent', { token: phoneA.accessToken })
  check('GET /consent trae texto, versión y huella', doc.status === 200 && doc.data?.paragraphs?.length > 0 && /^[0-9a-f]{64}$/.test(doc.data?.textHash ?? ''), `${doc.status}`)
  r = await call('POST', '/consent', { token: phoneA.accessToken, body: { version: 'version-vieja', textHash: doc.data.textHash } })
  check('aceptar una versión que no es la vigente -> 409 CONSENT_OUTDATED', r.status === 409 && r.code === 'CONSENT_OUTDATED', `${r.status} ${r.code}`)
  r = await call('POST', '/consent', { token: phoneA.accessToken, body: { version: doc.data.version, textHash: 'a'.repeat(64) } })
  check('aceptar con una huella distinta -> 409 CONSENT_OUTDATED', r.status === 409 && r.code === 'CONSENT_OUTDATED', `${r.status} ${r.code}`)
  r = await call('POST', '/consent', { token: phoneA.accessToken, body: { version: doc.data.version, textHash: doc.data.textHash } })
  check('aceptar la versión vigente -> aceptado', r.status === 200 && r.data?.activation?.consent?.accepted === true, `${r.status} ${r.code}`)
  await call('POST', '/consent', { token: phoneA.accessToken, body: { version: doc.data.version, textHash: doc.data.textHash } })
  const acceptances = await prisma.consentAcceptance.findMany({ where: { userId: user.id } })
  check('aceptar dos veces no duplica el registro', acceptances.length === 1, String(acceptances.length))
  check('el registro guarda versión, huella, teléfono e IP', acceptances[0]?.textHash === doc.data.textHash && acceptances[0]?.installationId === 'smoke-phone-AAAA' && !!acceptances[0]?.ipAddress)

  console.log('\n12. Teléfono vinculado')
  r = await call('POST', '/device', { token: phoneA.accessToken, body: { platform: 'android', deviceModel: 'Smoke A', appVersion: '0.0.3' } })
  check('vincular el teléfono A', r.status === 200 && r.data?.activation?.device?.status === 'this_device', `${r.status} ${r.code}`)
  r = await call('POST', '/device', { token: phoneA.accessToken, body: {} })
  check('repetir la vinculación del mismo teléfono responde bien', r.status === 200 && r.data?.activation?.device?.status === 'this_device', `${r.status} ${r.code}`)
  const phoneB = await loginAs('smoke-phone-BBBB')
  check('login desde otro teléfono SÍ se permite', !!phoneB?.accessToken)
  r = await call('GET', '/me', { token: phoneB.accessToken })
  check('...y /me lo marca como otro teléfono', r.data?.activation?.device?.status === 'other_device', JSON.stringify(r.data?.activation?.device))
  r = await call('POST', '/device', { token: phoneB.accessToken, body: {} })
  check('vincular el teléfono B -> 409 DEVICE_BOUND_ELSEWHERE', r.status === 409 && r.code === 'DEVICE_BOUND_ELSEWHERE', `${r.status} ${r.code}`)
  const [b1, b2] = await Promise.all([1, 2].map(() => call('POST', '/device', { token: phoneB.accessToken, body: {} })))
  check('dos intentos simultáneos tampoco pasan', b1.code === 'DEVICE_BOUND_ELSEWHERE' && b2.code === 'DEVICE_BOUND_ELSEWHERE')
  check('la base tiene un solo teléfono activo', (await prisma.mobileDevice.count({ where: { activeUserId: user.id } })) === 1)

  console.log('\n13. Gestión desde la web')
  const admin = await ensureUser(PHASE3_EMAILS.admin, 'ADMIN')
  const admin2 = await ensureUser(PHASE3_EMAILS.admin2, 'ADMIN')
  await ensureUser(PHASE3_EMAILS.plain, 'USER')
  const plainCookie = await webLogin(PHASE3_EMAILS.plain)
  const adminCookie = await webLogin(PHASE3_EMAILS.admin)

  r = await web(`/api/users/${user.id}/mobile`, '')
  check('sin sesión web: estado de la app -> 401', r.status === 401, String(r.status))
  r = await web(`/api/users/${user.id}/mobile`, plainCookie)
  check('un USER no puede ver el estado de la app de otro -> 403', r.status === 403, String(r.status))
  r = await web(`/api/users/${user.id}/mobile/device`, plainCookie, { method: 'DELETE' })
  check('un USER no puede desvincular -> 403', r.status === 403, String(r.status))
  r = await web(`/api/users/${user.id}/mobile`, adminCookie)
  check('un ADMIN ve consentimiento y teléfono', r.status === 200 && r.json?.consent?.accepted === true && r.json?.device?.deviceModel === 'Smoke A', `${r.status} ${JSON.stringify(r.json)}`)

  await prisma.mobileDevice.deleteMany({ where: { userId: admin2.id } })
  await prisma.mobileDevice.create({ data: { userId: admin2.id, activeUserId: admin2.id, installationId: 'smoke-admin2-phone' } })
  r = await web(`/api/users/${admin2.id}/mobile/device`, adminCookie, { method: 'DELETE' })
  check('un ADMIN no puede desvincular a otro ADMIN -> 403', r.status === 403, String(r.status))

  r = await web(`/api/users/${user.id}/mobile/device`, adminCookie, { method: 'DELETE' })
  check('un ADMIN desvincula el teléfono del empleado', r.status === 200, `${r.status} ${JSON.stringify(r.json)}`)
  r = await call('GET', '/me', { token: phoneA.accessToken })
  check('...la sesión del teléfono A queda cerrada', r.status === 401 && r.code === 'SESSION_REVOKED', `${r.status} ${r.code}`)
  r = await call('GET', '/me', { token: phoneB.accessToken })
  check('...la del teléfono B sigue abierta', r.status === 200, `${r.status} ${r.code}`)
  r = await call('POST', '/device', { token: phoneB.accessToken, body: { deviceModel: 'Smoke B' } })
  check('...y ahora el teléfono B sí puede vincular', r.status === 200 && r.data?.activation?.device?.status === 'this_device', `${r.status} ${r.code}`)
  r = await web(`/api/users/${user.id}/mobile/device`, adminCookie, { method: 'DELETE' })
  r = await web(`/api/users/${user.id}/mobile/device`, adminCookie, { method: 'DELETE' })
  check('desvincular sin teléfono activo -> 404', r.status === 404, String(r.status))
  const unbindLog = await prisma.auditLog.findFirst({ where: { action: 'MOBILE_DEVICE_UNBOUND', entityId: user.id, performedBy: admin.id } })
  check('la desvinculación queda en la bitácora de auditoría', !!unbindLog)

  console.log('\n14. Cédula y teléfono en la web')
  r = await web('/api/users', adminCookie, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Cedula', email: 'smoke.cedula@prueba.local', password: 'Clave1234', cedula: '1000000001' }),
  })
  check('crear con una cédula ya usada -> mensaje claro', r.status === 400 && r.json?.error === 'Ya existe un usuario con esta cedula', `${r.status} ${r.json?.error}`)
  r = await web('/api/users', adminCookie, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Cedula', email: 'smoke.cedula@prueba.local', password: 'Clave1234', cedula: '12.345' }),
  })
  check('cédula con formato inválido -> mensaje del campo', r.status === 400 && /cedula/i.test(r.json?.error ?? ''), `${r.status} ${r.json?.error}`)
  r = await web(`/api/users/${user.id}`, adminCookie, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cedula: '1000000777', phone: '+57 300 111 2222' }),
  })
  check('editar cédula y teléfono', r.status === 200 && r.json?.cedula === '1000000777' && r.json?.phone === '+57 300 111 2222', `${r.status} ${JSON.stringify(r.json)}`)
  check('el cambio de cédula queda en la bitácora', !!(await prisma.auditLog.findFirst({ where: { action: 'USER_CEDULA_CHANGED', entityId: user.id } })))
  r = await web('/api/users', adminCookie)
  check('el listado de usuarios devuelve cédula y teléfono', Array.isArray(r.json) && r.json.some((u) => u.cedula === '1000000777'), String(r.status))
}

async function cleanupPhase3() {
  const ids = (await prisma.user.findMany({ where: { email: { in: [...Object.values(PHASE3_EMAILS), 'smoke.cedula@prueba.local'] } }, select: { id: true } })).map((u) => u.id)
  const smokeUser = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } })
  const all = [...ids, ...(smokeUser ? [smokeUser.id] : [])]
  // La bitácora no permite borrar usuarios que tienen entradas (onDelete: Restrict)
  await prisma.auditLog.deleteMany({ where: { OR: [{ performedBy: { in: all } }, { entityId: { in: all } }] } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
}

main()
  .catch((e) => {
    failed++
    console.error('\nERROR inesperado:', e)
  })
  .finally(async () => {
    // Limpieza: los usuarios de prueba y todo lo suyo
    await cleanupPhase3().catch((e) => console.error('Limpieza fase 3:', e.message))
    const u = await prisma.user.findUnique({ where: { email: EMAIL } })
    if (u) await prisma.user.delete({ where: { id: u.id } })
    await prisma.mobileLoginAttempt.deleteMany({ where: { OR: [{ key: `email:${EMAIL}` }, { key: 'email:nadie@prueba.local' }, { key: `ip:${FAKE_IP}` }] } })
    await prisma.$disconnect()
    console.log(`\nResultado: ${passed} correctas, ${failed} fallidas`)
    process.exit(failed ? 1 : 0)
  })
