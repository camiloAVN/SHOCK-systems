// Prueba de extremo a extremo de la API móvil (Fase 1).
//
// Requisitos: Postgres local migrado y `npm run dev:local` corriendo.
// Uso: npm run mobile:smoke            (BASE_URL opcional, por defecto http://localhost:3000)
//
// Crea y borra su propio usuario de prueba. Solo corre contra una base LOCAL.
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import bcrypt from 'bcrypt'
import sharp from 'sharp'

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
  await fase4(user)
  await fase5(user)
  await fase6(user)
  await fase7(user)
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

// ───────────────────────── Fase 4: registro facial ─────────────────────────

// Foto con un rostro real (la del dueño de la Fase 0, que se queda en su computador)
const FACE_IMAGE = process.env.SMOKE_FACE_IMAGE || 'C:/dev/xenith-asistencia/spikes/fase0/scripts/fotos/referencia.jpg'

function r2() {
  const { R2_ATT_ACCOUNT_ID, R2_ATT_ACCESS_KEY_ID, R2_ATT_SECRET_ACCESS_KEY, R2_ATT_BUCKET } = process.env
  if (!R2_ATT_BUCKET) return null
  return {
    bucket: R2_ATT_BUCKET,
    s3: new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ATT_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ATT_ACCESS_KEY_ID, secretAccessKey: R2_ATT_SECRET_ACCESS_KEY },
    }),
  }
}

async function objectExists(key) {
  const c = r2()
  try {
    await c.s3.send(new HeadObjectCommand({ Bucket: c.bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

async function upload(token, attemptId, bytes, { filename = 'selfie.jpg', type = 'image/jpeg' } = {}) {
  const form = new FormData()
  if (attemptId) form.append('attemptId', attemptId)
  if (bytes) form.append('photo', new Blob([bytes], { type }), filename)
  const res = await fetch(`${API}/enrollment`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'x-forwarded-for': FAKE_IP }, body: form })
  const json = await res.json().catch(() => null)
  return { status: res.status, data: json?.data, code: json?.error?.code, json }
}

const newAttempt = async (token) => (await call('POST', '/liveness/attempts', { token, body: { purpose: 'enrollment' } })).data

async function fase4(user) {
  if (!fs.existsSync(FACE_IMAGE) || !r2() || !process.env.AWS_ACCESS_KEY_ID) {
    console.log('\n15-17. Registro facial: OMITIDO (faltan la foto de prueba o las claves de .env.local)')
    failed++
    return
  }
  const faceJpeg = fs.readFileSync(FACE_IMAGE)
  const grayJpeg = await sharp({ create: { width: 640, height: 640, channels: 3, background: '#7a7a7a' } }).jpeg({ quality: 80 }).toBuffer()
  // Ruido aleatorio a calidad máxima: varios MB, más de 1 MB seguro
  const bigJpeg = await sharp({ create: { width: 2500, height: 2500, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 60 } } }).jpeg({ quality: 100 }).toBuffer()
  if (bigJpeg.length <= 1024 * 1024) throw new Error('la imagen grande de prueba no supera 1 MB')
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#7a7a7a' } }).png().toBuffer()

  await resetUser()
  await prisma.mobileLoginAttempt.deleteMany({})
  await prisma.faceEnrollment.deleteMany({ where: { userId: user.id } })
  await prisma.livenessAttempt.deleteMany({ where: { userId: user.id } })
  await prisma.mobileDevice.deleteMany({ where: { userId: user.id } })
  await prisma.consentAcceptance.deleteMany({ where: { userId: user.id } })

  console.log('\n15. Intento de prueba de vida y precondiciones')
  const phone = await loginAs('smoke-phone-FACE')
  let a = await newAttempt(phone.accessToken)
  check('el servidor emite un intento con el orden del reto', !!a?.attemptId && a.steps.length === 2 && a.steps.includes('blink') && a.method === 'device_challenge_v1', JSON.stringify(a))
  let r = await upload(phone.accessToken, a.attemptId, faceJpeg)
  check('sin consentimiento -> 403 CONSENT_REQUIRED', r.status === 403 && r.code === 'CONSENT_REQUIRED', `${r.status} ${r.code}`)
  const doc = await call('GET', '/consent', { token: phone.accessToken })
  await call('POST', '/consent', { token: phone.accessToken, body: { version: doc.data.version, textHash: doc.data.textHash } })
  r = await upload(phone.accessToken, a.attemptId, faceJpeg)
  check('sin teléfono vinculado -> 403 DEVICE_NOT_BOUND', r.status === 403 && r.code === 'DEVICE_NOT_BOUND', `${r.status} ${r.code}`)
  await call('POST', '/device', { token: phone.accessToken, body: { platform: 'android' } })
  r = await upload(phone.accessToken, null, faceJpeg)
  check('sin id de intento -> 400 VALIDATION_ERROR', r.status === 400 && r.code === 'VALIDATION_ERROR', `${r.status} ${r.code}`)
  r = await upload(phone.accessToken, 'intento-que-no-existe', faceJpeg)
  check('intento inexistente -> 409 LIVENESS_ATTEMPT_INVALID', r.status === 409 && r.code === 'LIVENESS_ATTEMPT_INVALID', `${r.status} ${r.code}`)
  a = await newAttempt(phone.accessToken)
  await prisma.livenessAttempt.update({ where: { id: a.attemptId }, data: { expiresAt: new Date(Date.now() - 1000) } })
  r = await upload(phone.accessToken, a.attemptId, faceJpeg)
  check('intento caducado -> 409 LIVENESS_ATTEMPT_EXPIRED', r.status === 409 && r.code === 'LIVENESS_ATTEMPT_EXPIRED', `${r.status} ${r.code}`)
  const other = await ensureUser(PHASE3_EMAILS.plain, 'USER')
  const foreign = await prisma.livenessAttempt.create({ data: { userId: other.id, purpose: 'enrollment', method: 'device_challenge_v1', steps: ['blink', 'turn_left'], expiresAt: new Date(Date.now() + 60000) } })
  r = await upload(phone.accessToken, foreign.id, faceJpeg)
  check('intento de OTRO usuario -> 409 LIVENESS_ATTEMPT_INVALID', r.status === 409 && r.code === 'LIVENESS_ATTEMPT_INVALID', `${r.status} ${r.code}`)

  console.log('\n16. Validación de la foto')
  r = await upload(phone.accessToken, (await newAttempt(phone.accessToken)).attemptId, bigJpeg)
  check('foto de más de 1 MB -> 413 IMAGE_TOO_LARGE', r.status === 413 && r.code === 'IMAGE_TOO_LARGE', `${r.status} ${r.code}`)
  r = await upload(phone.accessToken, (await newAttempt(phone.accessToken)).attemptId, png, { filename: 'selfie.jpg', type: 'image/jpeg' })
  check('PNG disfrazado de JPEG -> 400 INVALID_IMAGE', r.status === 400 && r.code === 'INVALID_IMAGE', `${r.status} ${r.code}`)
  r = await upload(phone.accessToken, (await newAttempt(phone.accessToken)).attemptId, grayJpeg)
  check('imagen sin rostro -> 422 FACE_NOT_FOUND', r.status === 422 && r.code === 'FACE_NOT_FOUND', `${r.status} ${r.code}`)
  check('...y no se guardó ningún registro', (await prisma.faceEnrollment.count({ where: { userId: user.id } })) === 0)
  // Dos personas: la misma foto real dos veces, lado a lado
  const half = await sharp(faceJpeg).resize({ width: 600, height: 800, fit: 'cover' }).toBuffer()
  const twoFacesJpeg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#808080' } })
    .composite([{ input: half, left: 0, top: 0 }, { input: half, left: 600, top: 0 }])
    .jpeg({ quality: 80 })
    .toBuffer()
  r = await upload(phone.accessToken, (await newAttempt(phone.accessToken)).attemptId, twoFacesJpeg)
  check('foto con dos personas -> 422 MULTIPLE_FACES', r.status === 422 && r.code === 'MULTIPLE_FACES', `${r.status} ${r.code}`)
  check('...y tampoco se guardó registro', (await prisma.faceEnrollment.count({ where: { userId: user.id } })) === 0)

  a = await newAttempt(phone.accessToken)
  r = await upload(phone.accessToken, a.attemptId, faceJpeg)
  check('foto válida -> 201, registro pendiente', r.status === 201 && r.data?.activation?.enrollment?.status === 'pending', `${r.status} ${r.code} ${JSON.stringify(r.json?.error?.details ?? '')}`)
  const first = await prisma.faceEnrollment.findFirst({ where: { userId: user.id, status: 'PENDING' } })
  check('la foto está en el bucket privado', !!first?.imageKey && (await objectExists(first.imageKey)))
  check('guarda método, reto y calidad', first?.livenessMethod === 'device_challenge_v1' && first?.challengeSteps?.length === 2 && !!first?.quality)
  r = await upload(phone.accessToken, a.attemptId, faceJpeg)
  check('reutilizar el mismo intento -> 409 LIVENESS_ATTEMPT_INVALID', r.status === 409 && r.code === 'LIVENESS_ATTEMPT_INVALID', `${r.status} ${r.code}`)
  r = await upload(phone.accessToken, (await newAttempt(phone.accessToken)).attemptId, faceJpeg)
  const second = await prisma.faceEnrollment.findFirst({ where: { userId: user.id, status: 'PENDING' } })
  const oldOne = await prisma.faceEnrollment.findUnique({ where: { id: first.id } })
  check('reenviar mientras está pendiente reemplaza el anterior', r.status === 201 && second?.id !== first.id && oldOne?.status === 'SUPERSEDED')
  check('...y borra la foto anterior del bucket', !(await objectExists(first.imageKey)) && oldOne?.imageKey === null)

  console.log('\n17. Revisión en la web')
  const admin = await ensureUser(PHASE3_EMAILS.admin, 'ADMIN')
  const viewer = await ensureUser(PHASE3_EMAILS.admin2, 'ADMIN')
  await prisma.userPermission.deleteMany({ where: { userId: { in: [admin.id, viewer.id, other.id] } } })
  const plainCookie = await webLogin(PHASE3_EMAILS.plain)
  const viewerCookie = await webLogin(PHASE3_EMAILS.admin2)
  let w = await web('/api/attendance/enrollments?status=pending', plainCookie)
  check('sin el permiso de asistencia: la lista responde 403', w.status === 403, String(w.status))
  w = await web('/api/attendance/enrollments?status=pending', viewerCookie)
  check('ser ADMIN no basta: sin el módulo -> 403', w.status === 403, String(w.status))
  await prisma.userPermission.create({ data: { userId: viewer.id, module: 'asistencia_reportes', canView: true, canEdit: false } })
  w = await web('/api/attendance/enrollments?status=pending', viewerCookie)
  check('con permiso de ver: lista el pendiente, sin poder revisar', w.status === 200 && w.json?.canReview === false && w.json?.enrollments?.some((e) => e.id === second.id), `${w.status}`)
  check('la lista no expone la clave interna de la foto', !JSON.stringify(w.json).includes('enrollments/'))
  w = await web(`/api/attendance/enrollments/${second.id}/review`, viewerCookie, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve' }) })
  check('con permiso de ver: aprobar -> 403', w.status === 403, String(w.status))

  await prisma.userPermission.create({ data: { userId: admin.id, module: 'asistencia_reportes', canView: true, canEdit: true } })
  const adminCookie = await webLogin(PHASE3_EMAILS.admin)
  w = await web(`/api/attendance/enrollments/${second.id}/photo`, adminCookie)
  const photoRes = w.json?.url ? await fetch(w.json.url) : null
  check('URL firmada de la foto -> se descarga la imagen', w.status === 200 && photoRes?.status === 200 && (photoRes.headers.get('content-type') ?? '').includes('jpeg'), `${w.status} ${photoRes?.status}`)
  check('ver la foto queda en la bitácora', !!(await prisma.auditLog.findFirst({ where: { action: 'FACE_ENROLLMENT_PHOTO_VIEWED', entityId: second.id, performedBy: admin.id } })))
  const unsigned = await fetch(new URL(w.json.url).origin + new URL(w.json.url).pathname)
  check('la misma foto sin firma NO se puede leer', unsigned.status >= 400, String(unsigned.status))
  check('la URL firmada de la web dura 5 minutos', new URL(w.json.url).searchParams.get('X-Amz-Expires') === '300', new URL(w.json.url).searchParams.get('X-Amz-Expires'))
  // Caducidad real: el bucket debe rechazar una firma vencida. Se firma "hace 1 minuto" con 10 s de
  // vida, así no depende del desfase del reloj local (este equipo llegó a ir 3,6 s adelantado).
  const c = r2()
  const sign = (signingDate) => getSignedUrl(c.s3, new GetObjectCommand({ Bucket: c.bucket, Key: second.imageKey }), { expiresIn: 10, signingDate })
  const fresh = await fetch(await sign(new Date()))
  const expired = await fetch(await sign(new Date(Date.now() - 60_000)))
  check('una URL firmada vencida ya no abre la foto', fresh.status === 200 && expired.status === 403, `${fresh.status} -> ${expired.status}`)

  const review = (id, body, cookie = adminCookie) => web(`/api/attendance/enrollments/${id}/review`, cookie, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  w = await review(second.id, { action: 'reject' })
  check('rechazar sin motivo -> 400', w.status === 400, String(w.status))
  w = await review(second.id, { action: 'reject', note: 'Foto borrosa (prueba)' })
  check('rechazar con motivo -> 200', w.status === 200 && w.json?.status === 'REJECTED', `${w.status} ${JSON.stringify(w.json)}`)
  check('...la foto rechazada se borra del bucket', !(await objectExists(second.imageKey)))
  r = await call('GET', '/me', { token: phone.accessToken })
  check('...y la app ve "rechazado" con el motivo', r.data?.activation?.enrollment?.status === 'rejected' && r.data.activation.enrollment.note === 'Foto borrosa (prueba)', JSON.stringify(r.data?.activation?.enrollment))

  await upload(phone.accessToken, (await newAttempt(phone.accessToken)).attemptId, faceJpeg)
  const third = await prisma.faceEnrollment.findFirst({ where: { userId: user.id, status: 'PENDING' } })
  w = await review(third.id, { action: 'approve' })
  check('aprobar -> 200', w.status === 200 && w.json?.status === 'APPROVED', `${w.status} ${JSON.stringify(w.json)}`)
  r = await call('GET', '/me', { token: phone.accessToken })
  check('...la app ve "aprobado"', r.data?.activation?.enrollment?.status === 'approved', JSON.stringify(r.data?.activation?.enrollment))
  check('...la foto aprobada se conserva', await objectExists(third.imageKey))
  r = await upload(phone.accessToken, (await newAttempt(phone.accessToken)).attemptId, faceJpeg)
  check('con un registro aprobado no se puede enviar otro -> 409', r.status === 409 && r.code === 'ENROLLMENT_ALREADY_APPROVED', `${r.status} ${r.code}`)
  w = await review(third.id, { action: 'approve' })
  check('aprobar dos veces -> 409', w.status === 409, String(w.status))

  // Nadie revisa su propio registro
  const ownAttempt = await prisma.livenessAttempt.create({ data: { userId: admin.id, purpose: 'enrollment', method: 'device_challenge_v1', steps: ['blink', 'turn_left'], expiresAt: new Date(Date.now() + 60000), usedAt: new Date() } })
  const own = await prisma.faceEnrollment.create({ data: { userId: admin.id, activeUserId: admin.id, livenessMethod: 'device_challenge_v1', livenessAttemptId: ownAttempt.id, challengeSteps: ownAttempt.steps } })
  w = await review(own.id, { action: 'approve' })
  check('revisar el propio registro -> 403', w.status === 403, String(w.status))

  w = await review(third.id, { action: 'revoke' })
  check('anular sin motivo -> 400', w.status === 400, String(w.status))
  w = await review(third.id, { action: 'revoke', note: 'No corresponde a la persona (prueba)' })
  check('anular con motivo -> 200 y borra la foto', w.status === 200 && !(await objectExists(third.imageKey)), `${w.status}`)
  r = await call('GET', '/me', { token: phone.accessToken })
  check('...la app ve "anulado" y puede registrarse de nuevo', r.data?.activation?.enrollment?.status === 'revoked' && r.data.activation.enrollment.canSubmit === true)
  check('aprobar, rechazar y anular quedan en la bitácora', (await prisma.auditLog.count({ where: { entityId: { in: [second.id, third.id] }, action: { in: ['FACE_ENROLLMENT_REJECTED', 'FACE_ENROLLMENT_APPROVED', 'FACE_ENROLLMENT_REVOKED'] } } })) === 3)
  w = await web(`/api/users/${user.id}/mobile`, adminCookie)
  check('la sección "App móvil" de la web muestra el registro', w.json?.enrollment?.status === 'revoked', JSON.stringify(w.json?.enrollment))
}

// ───────────────────────── Fase 5: áreas, asignaciones y turnos ─────────────────────────

const AREA_PREFIX = 'Smoke área'
const SMOKE_TEAM = 'Smoke equipo de asistencia'

async function fase5(user) {
  console.log('\n18. Áreas: permisos')
  const admin = await ensureUser(PHASE3_EMAILS.admin, 'ADMIN')
  const viewer = await ensureUser(PHASE3_EMAILS.admin2, 'ADMIN')
  const plain = await ensureUser(PHASE3_EMAILS.plain, 'USER')
  await prisma.userPermission.deleteMany({ where: { userId: { in: [admin.id, viewer.id, plain.id] }, module: 'asistencia_areas' } })
  const plainCookie = await webLogin(PHASE3_EMAILS.plain)
  const viewerCookie = await webLogin(PHASE3_EMAILS.admin2)
  const adminCookie = await webLogin(PHASE3_EMAILS.admin)
  const json = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const center = { latitude: 4.6097, longitude: -74.0817 }
  const areaBody = (name, extra = {}) => ({ name: `${AREA_PREFIX} ${name}`, latitude: center.latitude, longitude: center.longitude, radiusMeters: 50, ...extra })

  let w = await web('/api/attendance/areas', plainCookie)
  check('sin el módulo asistencia_areas: lista -> 403', w.status === 403, String(w.status))
  w = await web('/api/attendance/areas', adminCookie)
  check('ser ADMIN no basta: sin el módulo -> 403', w.status === 403, String(w.status))

  await prisma.userPermission.create({ data: { userId: viewer.id, module: 'asistencia_areas', canView: true, canEdit: false } })
  w = await web('/api/attendance/areas', viewerCookie)
  check('con permiso de ver: lista sin poder editar, con el estilo del mapa', w.status === 200 && w.json?.canEdit === false && /^https:/.test(w.json?.mapStyleUrl ?? ''), `${w.status} ${JSON.stringify(w.json?.canEdit)}`)
  w = await web('/api/attendance/areas', viewerCookie, json('POST', areaBody('no debe crearse')))
  check('con permiso de ver: crear -> 403', w.status === 403, String(w.status))
  w = await web('/api/attendance/options', viewerCookie)
  check('con permiso de ver: opciones del formulario -> 403', w.status === 403, String(w.status))

  await prisma.userPermission.create({ data: { userId: admin.id, module: 'asistencia_areas', canView: true, canEdit: true } })
  w = await web('/api/attendance/areas', adminCookie, json('POST', areaBody('chica', { radiusMeters: 29 })))
  check('radio menor a 30 m -> 400 con mensaje claro', w.status === 400 && /30 m/.test(w.json?.error ?? ''), `${w.status} ${w.json?.error}`)
  w = await web('/api/attendance/areas', adminCookie, json('POST', { name: `${AREA_PREFIX} sin centro`, radiusMeters: 50 }))
  check('sin centro -> 400', w.status === 400, `${w.status} ${w.json?.error}`)

  const created = {}
  for (const [key, extra] of [['A directa', {}], ['B equipo', {}], ['C de otro', {}], ['D inactiva', { isActive: false }], ['E vencida', {}]]) {
    w = await web('/api/attendance/areas', adminCookie, json('POST', areaBody(key, extra)))
    created[key[0]] = w.json
  }
  check('con permiso de editar: crea las áreas', Object.values(created).every((a) => !!a?.id))
  check('crear un área queda en la bitácora', !!(await prisma.auditLog.findFirst({ where: { action: 'ATTENDANCE_AREA_CREATED', entityId: created.A.id, performedBy: admin.id } })))
  w = await web('/api/attendance/options', adminCookie)
  check('opciones: personas activas, equipos y proyectos', w.status === 200 && Array.isArray(w.json?.users) && Array.isArray(w.json?.teams) && Array.isArray(w.json?.projects))

  console.log('\n19. Asignaciones y turnos')
  const H = 3_600_000
  const now = Date.now()
  const iso = (ms) => new Date(ms).toISOString()
  const team = await prisma.team.upsert({ where: { name: SMOKE_TEAM }, update: {}, create: { name: SMOKE_TEAM } })
  await prisma.teamMember.upsert({ where: { teamId_userId: { teamId: team.id, userId: user.id } }, update: {}, create: { teamId: team.id, userId: user.id } })
  const assign = (areaId, body, cookie = adminCookie) => web(`/api/attendance/areas/${areaId}/assignments`, cookie, json('POST', body))

  w = await assign(created.A.id, { userId: user.id, teamId: team.id, shifts: [{ startsAt: iso(now + H), endsAt: iso(now + 9 * H) }] })
  check('persona y equipo a la vez -> 400', w.status === 400, `${w.status} ${w.json?.error}`)
  w = await assign(created.A.id, { userId: user.id, shifts: [{ startsAt: iso(now + H), endsAt: iso(now + 9 * H) }, { startsAt: iso(now + 8 * H), endsAt: iso(now + 12 * H) }] })
  check('turnos que se cruzan -> 400', w.status === 400 && /se cruzan/.test(w.json?.error ?? ''), `${w.status} ${w.json?.error}`)
  w = await assign(created.A.id, { userId: user.id, shifts: [{ startsAt: iso(now + H), endsAt: iso(now + 30 * H) }] })
  check('turno de más de 24 h -> 400', w.status === 400, `${w.status} ${w.json?.error}`)
  w = await assign(created.A.id, { userId: 'no-existe', shifts: [{ startsAt: iso(now + H), endsAt: iso(now + 9 * H) }] })
  check('persona inexistente -> 400', w.status === 400, `${w.status} ${w.json?.error}`)
  w = await assign(created.A.id, { userId: user.id, shifts: [{ startsAt: iso(now + H), endsAt: iso(now + 9 * H) }] }, viewerCookie)
  check('con permiso de ver: asignar -> 403', w.status === 403, String(w.status))

  const assignA = await assign(created.A.id, { userId: user.id, notes: 'Smoke montaje', shifts: [{ startsAt: iso(now + 3 * H), endsAt: iso(now + 11 * H) }] }) // próximo
  await assign(created.B.id, { teamId: team.id, shifts: [{ startsAt: iso(now - H), endsAt: iso(now + 3 * H) }] }) // abierto, por equipo
  await assign(created.C.id, { userId: plain.id, shifts: [{ startsAt: iso(now + 24 * H), endsAt: iso(now + 32 * H) }] }) // de otra persona
  await assign(created.D.id, { userId: user.id, shifts: [{ startsAt: iso(now + 24 * H), endsAt: iso(now + 32 * H) }] }) // área inactiva
  await assign(created.E.id, { userId: user.id, shifts: [{ startsAt: iso(now - 72 * H), endsAt: iso(now - 64 * H) }] }) // vencido
  check('asignar a una persona -> 201', assignA.status === 201 && assignA.json?.shifts?.length === 1, `${assignA.status} ${assignA.json?.error}`)
  check('asignar queda en la bitácora', !!(await prisma.auditLog.findFirst({ where: { action: 'ATTENDANCE_ASSIGNMENT_CREATED', entityId: assignA.json?.id } })))
  w = await web(`/api/attendance/areas/${created.A.id}`, viewerCookie)
  check('con permiso de ver: el detalle muestra la asignación', w.status === 200 && w.json?.area?.assignments?.length === 1 && w.json?.canEdit === false, String(w.status))

  console.log('\n20. Lo que ve cada empleado en la app')
  const phone = await loginAs('smoke-phone-AREAS')
  let r = await call('GET', '/assignments', { token: phone.accessToken })
  const names = (r.data?.assignments ?? []).map((a) => a.area.name.replace(`${AREA_PREFIX} `, ''))
  check('GET /assignments responde con la hora del servidor', r.status === 200 && !!r.data?.serverTime, `${r.status} ${r.code}`)
  check('ve la directa y la del equipo, primero la abierta', JSON.stringify(names) === JSON.stringify(['B equipo', 'A directa']), JSON.stringify(names))
  const b = r.data?.assignments?.[0]
  check('la del equipo dice por qué equipo y está abierta', b?.via?.type === 'team' && b?.via?.teamName === SMOKE_TEAM && b?.shifts?.[0]?.phase === 'open', JSON.stringify(b?.via))
  check('trae centro, radio y ventana de marcación', b?.area?.radiusMeters === 50 && b?.area?.latitude === center.latitude && !!b?.shifts?.[0]?.opensAt && !!b?.shifts?.[0]?.closesAt)
  check('no ve el área de otra persona, ni la inactiva, ni la vencida', !names.some((n) => /^(C|D|E) /.test(n)))
  r = await call('GET', '/assignments')
  check('sin token -> 401 TOKEN_MISSING', r.status === 401 && r.code === 'TOKEN_MISSING', `${r.status} ${r.code}`)
  const plainPhone = (await call('POST', '/auth/login', { body: { email: PHASE3_EMAILS.plain, password: PASSWORD, device: { installationId: 'smoke-phone-PLAIN', platform: 'android' } } })).data
  r = await call('GET', '/assignments', { token: plainPhone?.accessToken })
  check('la otra persona solo ve la suya', JSON.stringify((r.data?.assignments ?? []).map((a) => a.area.name)) === JSON.stringify([`${AREA_PREFIX} C de otro`]), JSON.stringify(r.data?.assignments?.map((a) => a.area.name)))

  console.log('\n21. Editar y quitar')
  const oldShift = assignA.json.shifts[0]
  w = await web(`/api/attendance/assignments/${assignA.json.id}`, adminCookie, json('PUT', {
    userId: user.id,
    notes: 'Smoke montaje (editado)',
    shifts: [{ id: oldShift.id, startsAt: oldShift.startsAt, endsAt: oldShift.endsAt }, { startsAt: iso(now + 26 * H), endsAt: iso(now + 34 * H) }],
  }))
  check('editar conserva el turno existente (mismo id) y agrega el nuevo', w.status === 200 && w.json?.shifts?.length === 2 && w.json.shifts.some((s) => s.id === oldShift.id), `${w.status} ${w.json?.error}`)
  const other = await prisma.attendanceShift.findFirst({ where: { assignment: { areaId: created.C.id } } })
  w = await web(`/api/attendance/assignments/${assignA.json.id}`, adminCookie, json('PUT', { userId: user.id, shifts: [{ id: other.id, startsAt: iso(now + H), endsAt: iso(now + 2 * H) }] }))
  check('no se puede "robar" un turno de otra asignación -> 400', w.status === 400, `${w.status} ${w.json?.error}`)

  await prisma.teamMember.deleteMany({ where: { teamId: team.id, userId: user.id } })
  r = await call('GET', '/assignments', { token: phone.accessToken })
  check('al salir del equipo deja de ver el área del equipo', !(r.data?.assignments ?? []).some((a) => a.via.type === 'team'), JSON.stringify(r.data?.assignments?.map((a) => a.area.name)))

  w = await web(`/api/attendance/areas/${created.C.id}`, viewerCookie, { method: 'DELETE' })
  check('con permiso de ver: eliminar -> 403', w.status === 403, String(w.status))
  w = await web(`/api/attendance/areas/${created.C.id}`, adminCookie, { method: 'DELETE' })
  check('eliminar el área borra sus asignaciones y turnos', w.status === 200 && (await prisma.attendanceAssignment.count({ where: { areaId: created.C.id } })) === 0, String(w.status))
  r = await call('GET', '/assignments', { token: plainPhone?.accessToken })
  check('...y desaparece de la app', (r.data?.assignments ?? []).length === 0)
  check('eliminar queda en la bitácora', !!(await prisma.auditLog.findFirst({ where: { action: 'ATTENDANCE_AREA_DELETED', entityId: created.C.id } })))
}

// ───────────────────────── Fase 6: marcación en línea ─────────────────────────

const FOTOS = 'C:/dev/xenith-asistencia/spikes/fase0/scripts/fotos'
const SAME_PERSON_IMAGE = process.env.SMOKE_SAME_FACE_IMAGE || `${FOTOS}/misma.jpg`
const OTHER_PERSON_IMAGE = process.env.SMOKE_OTHER_FACE_IMAGE || `${FOTOS}/otra.jpg`
const MARK_AREA = `${AREA_PREFIX} marcación`

async function fase6(user) {
  if (![FACE_IMAGE, SAME_PERSON_IMAGE, OTHER_PERSON_IMAGE].every((f) => fs.existsSync(f)) || !r2() || !process.env.AWS_ACCESS_KEY_ID) {
    console.log('\n22-26. Marcación: OMITIDO (faltan fotos de prueba o las claves de .env.local)')
    failed++
    return
  }
  const reference = fs.readFileSync(FACE_IMAGE)
  const same = fs.readFileSync(SAME_PERSON_IMAGE)
  const other = fs.readFileSync(OTHER_PERSON_IMAGE)
  const H = 3_600_000
  const now = Date.now()
  const iso = (ms) => new Date(ms).toISOString()
  const center = { latitude: 4.6097, longitude: -74.0817 }
  const north = (m) => center.latitude + m / 111_195

  console.log('\n22. Preparación: activación completa y registro facial aprobado')
  await prisma.faceEnrollment.deleteMany({ where: { userId: user.id } })
  await prisma.livenessAttempt.deleteMany({ where: { userId: user.id } })
  await prisma.mobileDevice.deleteMany({ where: { userId: user.id } })
  const phone = await loginAs('smoke-phone-MARK')
  const doc = await call('GET', '/consent', { token: phone.accessToken })
  await call('POST', '/consent', { token: phone.accessToken, body: { version: doc.data.version, textHash: doc.data.textHash } })
  await call('POST', '/device', { token: phone.accessToken, body: { platform: 'android' } })
  const markAttempt = async (token = phone.accessToken) => (await call('POST', '/liveness/attempts', { token, body: { purpose: 'mark' } })).data
  const mark = async (body, token = phone.accessToken) => {
    const form = new FormData()
    for (const [k, v] of Object.entries(body)) if (k !== 'photo' && v !== undefined) form.append(k, String(v))
    form.append('photo', new Blob([body.photo], { type: 'image/jpeg' }), 'selfie.jpg')
    const res = await fetch(`${API}/marks`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'x-forwarded-for': FAKE_IP }, body: form })
    const json = await res.json().catch(() => null)
    return { status: res.status, data: json?.data, code: json?.error?.code, json }
  }
  let seq = 0
  const clientId = () => `smoke${Date.now()}${++seq}`
  const base = (shiftId, attemptId, extra = {}) => ({ clientMarkId: clientId(), shiftId, attemptId, latitude: north(10), longitude: center.longitude, accuracy: 8, mocked: 'false', deviceTime: new Date().toISOString(), photo: same, ...extra })

  // Sin registro facial aprobado no se puede marcar
  const admin = await ensureUser(PHASE3_EMAILS.admin, 'ADMIN')
  const viewer = await ensureUser(PHASE3_EMAILS.admin2, 'ADMIN')
  await prisma.userPermission.deleteMany({ where: { userId: { in: [admin.id, viewer.id] }, module: { in: ['asistencia_areas', 'asistencia_reportes'] } } })
  await prisma.userPermission.createMany({
    data: [
      { userId: admin.id, module: 'asistencia_areas', canView: true, canEdit: true },
      { userId: admin.id, module: 'asistencia_reportes', canView: true, canEdit: true },
      { userId: viewer.id, module: 'asistencia_reportes', canView: true, canEdit: false },
    ],
  })
  const adminCookie = await webLogin(PHASE3_EMAILS.admin)
  const viewerCookie = await webLogin(PHASE3_EMAILS.admin2)
  const json = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  let w = await web('/api/attendance/areas', adminCookie, json('POST', { name: MARK_AREA, ...center, radiusMeters: 50 }))
  const area = w.json
  w = await web(`/api/attendance/areas/${area.id}/assignments`, adminCookie, json('POST', {
    userId: user.id,
    shifts: [
      { startsAt: iso(now - H), endsAt: iso(now + 4 * H) }, // abierto
      { startsAt: iso(now + 6 * H), endsAt: iso(now + 10 * H) }, // aún no abre (abre 2 h antes)
      { startsAt: iso(now - 20 * H), endsAt: iso(now - 12 * H) }, // ventana cerrada hace 6 h
    ],
  }))
  // La API devuelve los turnos ordenados por inicio: pasado, abierto, futuro
  const [pastShift, openShift, futureShift] = w.json.shifts
  check('turnos de prueba creados', !!openShift && !!futureShift && !!pastShift, `${w.status} ${w.json?.error}`)

  let r = await mark(base(openShift.id, (await markAttempt()).attemptId))
  check('sin registro facial aprobado -> 403 ENROLLMENT_REQUIRED', r.status === 403 && r.code === 'ENROLLMENT_REQUIRED', `${r.status} ${r.code}`)

  const enrollAttempt = (await call('POST', '/liveness/attempts', { token: phone.accessToken, body: { purpose: 'enrollment' } })).data
  await upload(phone.accessToken, enrollAttempt.attemptId, reference)
  const enrollment = await prisma.faceEnrollment.findFirst({ where: { userId: user.id, status: 'PENDING' } })
  w = await web(`/api/attendance/enrollments/${enrollment?.id}/review`, adminCookie, json('POST', { action: 'approve' }))
  check('registro facial aprobado para la prueba', w.status === 200, `${w.status} ${JSON.stringify(w.json)}`)

  console.log('\n23. Precondiciones (no queda registro)')
  const countMarks = () => prisma.attendanceMark.count({ where: { userId: user.id } })
  r = await mark(base(openShift.id, enrollAttempt.attemptId))
  check('intento de prueba de vida de otro propósito -> 409 LIVENESS_ATTEMPT_INVALID', r.status === 409 && r.code === 'LIVENESS_ATTEMPT_INVALID', `${r.status} ${r.code}`)
  r = await mark(base(futureShift.id, (await markAttempt()).attemptId))
  check('entrada antes de abrir la ventana -> 409 MARK_WINDOW_CLOSED', r.status === 409 && r.code === 'MARK_WINDOW_CLOSED' && r.json?.error?.details?.reason === 'NOT_YET_OPEN', `${r.status} ${r.code}`)
  r = await mark(base(pastShift.id, (await markAttempt()).attemptId))
  check('entrada con la ventana ya cerrada -> 409 MARK_WINDOW_CLOSED', r.status === 409 && r.code === 'MARK_WINDOW_CLOSED', `${r.status} ${r.code}`)
  const plain = await ensureUser(PHASE3_EMAILS.plain, 'USER')
  const otherArea = await prisma.attendanceArea.create({ data: { name: `${AREA_PREFIX} ajena`, ...center, radiusMeters: 50 } })
  const otherAssignment = await prisma.attendanceAssignment.create({
    data: { areaId: otherArea.id, userId: plain.id, shifts: { create: [{ startsAt: new Date(now - H), endsAt: new Date(now + 4 * H) }] } },
    include: { shifts: true },
  })
  r = await mark(base(otherAssignment.shifts[0].id, (await markAttempt()).attemptId))
  check('turno de otra persona -> 403 SHIFT_NOT_ASSIGNED', r.status === 403 && r.code === 'SHIFT_NOT_ASSIGNED', `${r.status} ${r.code}`)
  check('...ninguna precondición dejó registro', (await countMarks()) === 0)

  console.log('\n24. Matriz de resultados (Rekognition real)')
  r = await mark(base(openShift.id, (await markAttempt()).attemptId, { mocked: 'true' }))
  check('ubicación simulada -> REJECTED (queda registro)', r.status === 201 && r.data?.mark?.status === 'REJECTED' && r.data.mark.reasons.includes('MOCK_LOCATION'), `${r.status} ${r.code} ${JSON.stringify(r.data?.mark)}`)
  const rejectedRow = await prisma.attendanceMark.findUnique({ where: { id: r.data?.mark?.id } })
  check('...sin guardar la selfie y sin abrir la entrada', rejectedRow?.selfieKey === null && r.data?.marking?.next === 'IN')

  const phoneB = await loginAs('smoke-phone-OTRO')
  r = await mark(base(openShift.id, (await markAttempt(phoneB.accessToken)).attemptId), phoneB.accessToken)
  check('teléfono no vinculado -> REJECTED DEVICE_NOT_BOUND', r.status === 201 && r.data?.mark?.status === 'REJECTED' && r.data.mark.reasons.includes('DEVICE_NOT_BOUND'), `${r.status} ${r.code} ${JSON.stringify(r.data?.mark?.reasons)}`)

  const inBody = base(openShift.id, (await markAttempt()).attemptId)
  r = await mark(inBody)
  const validIn = r.data?.mark
  check('dentro del área y rostro correcto -> VALID, es ENTRADA', r.status === 201 && validIn?.status === 'VALID' && validIn?.type === 'IN', `${r.status} ${r.code} ${JSON.stringify(validIn)}`)
  check('...similitud ≥ 90 % y hora oficial del servidor', validIn?.similarity >= 90 && Math.abs(new Date(validIn?.officialAt).getTime() - Date.now()) < 60_000, `${validIn?.similarity}`)
  const inRow = await prisma.attendanceMark.findUnique({ where: { id: validIn?.id } })
  check('...la selfie quedó en el bucket privado', !!inRow?.selfieKey && (await objectExists(inRow.selfieKey)))
  check('...ahora toca SALIDA', r.data?.marking?.next === 'OUT' && !!r.data.marking.openEntryAt)

  const before = await countMarks()
  r = await mark({ ...inBody, attemptId: (await markAttempt()).attemptId })
  check('reenviar la misma marcación (mismo clientMarkId) no duplica', r.status === 200 && r.data?.duplicate === true && r.data?.mark?.id === validIn?.id && (await countMarks()) === before, `${r.status} ${r.code}`)

  r = await mark(base(openShift.id, (await markAttempt()).attemptId, { latitude: north(300) }))
  check('salida fuera del área -> PENDING_REVIEW OUT_OF_AREA, es SALIDA', r.data?.mark?.status === 'PENDING_REVIEW' && r.data.mark.type === 'OUT' && r.data.mark.reasons.includes('OUT_OF_AREA'), JSON.stringify(r.data?.mark ?? r.json))
  check('...cerró el par: vuelve a tocar ENTRADA', r.data?.marking?.next === 'IN')
  r = await mark(base(openShift.id, (await markAttempt()).attemptId, { accuracy: 120 }))
  check('GPS impreciso (120 m) -> PENDING_REVIEW LOW_GPS_ACCURACY', r.data?.mark?.status === 'PENDING_REVIEW' && r.data.mark.reasons.includes('LOW_GPS_ACCURACY'), JSON.stringify(r.data?.mark ?? r.json))
  // Cerrar ese par para empezar los fallos con una entrada pendiente
  await mark(base(openShift.id, (await markAttempt()).attemptId))

  console.log('\n25. Rostro de otra persona: tres intentos y bloqueo')
  r = await mark(base(openShift.id, (await markAttempt()).attemptId, { photo: other }))
  check('otra persona -> FACE_MISMATCH, no abre la entrada, quedan 2', r.data?.mark?.status === 'FACE_MISMATCH' && r.data.marking.next === 'IN' && r.data.marking.attemptsLeft === 2, JSON.stringify(r.data ?? r.json))
  const mismatchRow = await prisma.attendanceMark.findUnique({ where: { id: r.data?.mark?.id } })
  check('...la selfie del intento se guarda para la revisión', !!mismatchRow?.selfieKey)
  r = await mark(base(openShift.id, (await markAttempt()).attemptId, { photo: other }))
  check('segundo intento fallido: queda 1', r.data?.marking?.attemptsLeft === 1, JSON.stringify(r.data?.marking))
  r = await mark(base(openShift.id, (await markAttempt()).attemptId, { photo: other }))
  check('tercer intento fallido: el turno se bloquea', r.data?.mark?.status === 'FACE_MISMATCH' && r.data.marking.locked === true, JSON.stringify(r.data?.marking))
  r = await mark(base(openShift.id, (await markAttempt()).attemptId))
  check('con el turno bloqueado -> 409 SHIFT_LOCKED (ni con el rostro correcto)', r.status === 409 && r.code === 'SHIFT_LOCKED', `${r.status} ${r.code}`)
  r = await call('GET', '/assignments', { token: phone.accessToken })
  const lockedShift = r.data?.assignments?.flatMap((a) => a.shifts).find((s) => s.id === openShift.id)
  check('la app ve el turno bloqueado', lockedShift?.marking?.locked === true, JSON.stringify(lockedShift?.marking))

  console.log('\n26. Web: turnos bloqueados y desbloqueo')
  w = await web('/api/attendance/locks', viewerCookie)
  const lock = w.json?.locks?.find((l) => l.user.id === user.id)
  check('el aviso aparece en la web con los 3 intentos y la foto de referencia', w.status === 200 && lock?.attempts?.length === 3 && !!lock?.referenceEnrollmentId, `${w.status} ${JSON.stringify(lock?.attempts?.length)}`)
  check('la lista no expone las claves de las fotos', !JSON.stringify(w.json).includes('marks/'))
  w = await web(`/api/attendance/marks/${lock?.attempts?.[0]?.id}/photo`, viewerCookie)
  const shot = w.json?.url ? await fetch(w.json.url) : null
  check('la selfie del intento se ve con URL firmada y queda en la bitácora', shot?.status === 200 && !!(await prisma.auditLog.findFirst({ where: { action: 'ATTENDANCE_MARK_PHOTO_VIEWED', performedBy: viewer.id } })), `${w.status} ${shot?.status}`)
  w = await web(`/api/attendance/locks/${lock?.id}/unlock`, viewerCookie, json('POST', { note: 'prueba' }))
  check('con permiso de ver: desbloquear -> 403', w.status === 403, String(w.status))
  w = await web(`/api/attendance/locks/${lock?.id}/unlock`, adminCookie, json('POST', { note: ' ' }))
  check('desbloquear sin motivo -> 400', w.status === 400, String(w.status))
  w = await web(`/api/attendance/locks/${lock?.id}/unlock`, adminCookie, json('POST', { note: 'Smoke: verificado por videollamada' }))
  check('desbloquear con motivo -> 200 y queda en la bitácora', w.status === 200 && !!(await prisma.auditLog.findFirst({ where: { action: 'ATTENDANCE_SHIFT_UNLOCKED', entityId: lock?.id } })), String(w.status))
  r = await mark(base(openShift.id, (await markAttempt()).attemptId))
  check('tras desbloquear vuelve a marcar, con 3 intentos nuevos', r.data?.mark?.status === 'VALID' && r.data.marking.attemptsLeft === 3 && r.data.marking.locked === false, JSON.stringify(r.data?.marking ?? r.json))

  console.log('\n27. Salida con la ventana cerrada y entrada abierta')
  const oldIn = await prisma.livenessAttempt.create({ data: { userId: user.id, purpose: 'mark', method: 'device_challenge_v1', steps: ['blink'], expiresAt: new Date(now), usedAt: new Date(now) } })
  await prisma.attendanceMark.create({
    data: { userId: user.id, shiftId: pastShift.id, clientMarkId: clientId(), type: 'IN', status: 'VALID', reasons: [], officialAt: new Date(now - 19 * H), latitude: center.latitude, longitude: center.longitude, livenessMethod: 'device_challenge_v1', livenessAttemptId: oldIn.id },
  })
  r = await call('GET', '/assignments', { token: phone.accessToken })
  const pending = r.data?.assignments?.flatMap((a) => a.shifts).find((s) => s.id === pastShift.id)
  check('la app sigue mostrando el turno vencido con la entrada abierta (toca SALIDA)', pending?.marking?.next === 'OUT', JSON.stringify(pending ?? null))
  r = await mark(base(pastShift.id, (await markAttempt()).attemptId))
  check('la salida se permite aunque la ventana cerró', r.status === 201 && r.data?.mark?.type === 'OUT' && r.data.mark.status === 'VALID', `${r.status} ${r.code}`)

  r = await call('GET', '/marks', { token: phone.accessToken })
  check('historial: mis marcaciones, la más reciente primero', r.status === 200 && r.data?.marks?.length >= 8 && r.data.marks[0].type === 'OUT' && r.data.marks[0].area.name === MARK_AREA, `${r.status} ${r.data?.marks?.length}`)

  w = await web(`/api/attendance/areas/${area.id}`, adminCookie, { method: 'DELETE' })
  check('un área con marcaciones no se puede eliminar -> 409', w.status === 409 && /marcaciones/.test(w.json?.error ?? ''), `${w.status} ${w.json?.error}`)
}


// ───────────────────────── Fase 7: revisión y reportes ─────────────────────────

async function fase7(user) {
  const DAY = 24 * 3_600_000
  const json = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const admin = await ensureUser(PHASE3_EMAILS.admin, 'ADMIN')
  const viewer = await ensureUser(PHASE3_EMAILS.admin2, 'ADMIN')
  const plainCookie = await webLogin(PHASE3_EMAILS.plain)
  const viewerCookie = await webLogin(PHASE3_EMAILS.admin2)
  const adminCookie = await webLogin(PHASE3_EMAILS.admin)
  const fakeAttempt = (userId) =>
    prisma.livenessAttempt.create({ data: { userId, purpose: 'mark', method: 'device_challenge_v1', steps: ['blink'], expiresAt: new Date(), usedAt: new Date() } })
  const rawMark = async (userId, shiftId, type, status, officialAt, reasons = []) =>
    prisma.attendanceMark.create({
      data: {
        userId,
        shiftId,
        clientMarkId: `smoke7-${Math.random()}`,
        type,
        status,
        reasons,
        officialAt,
        latitude: 4.6097,
        longitude: -74.0817,
        livenessMethod: 'device_challenge_v1',
        livenessAttemptId: (await fakeAttempt(userId)).id,
      },
    })

  console.log('\n28. Bandeja de revisión')
  let w = await web('/api/attendance/reviews', plainCookie)
  check('sin el módulo asistencia_reportes -> 403', w.status === 403, String(w.status))
  w = await web('/api/attendance/reviews', viewerCookie)
  const pendingOwn = (w.json?.marks ?? []).filter((m) => m.user.id === user.id)
  const outOfArea = pendingOwn.find((m) => m.reasons.includes('OUT_OF_AREA'))
  const lowGps = pendingOwn.find((m) => m.reasons.includes('LOW_GPS_ACCURACY'))
  check('aparecen las 2 marcaciones en revisión de la Fase 6, con área y referencia', w.status === 200 && !!outOfArea && !!lowGps && outOfArea.area.radiusMeters === 50 && !!outOfArea.referenceEnrollmentId, `${w.status} ${pendingOwn.length}`)
  check('con permiso de ver: no puede revisar y no se exponen claves de fotos', w.json?.canReview === false && !JSON.stringify(w.json).includes('marks/'))
  w = await web(`/api/attendance/reviews/${outOfArea?.id}`, viewerCookie, json('POST', { decision: 'APPROVED', note: 'x' }))
  check('con permiso de ver: aprobar -> 403', w.status === 403, String(w.status))
  w = await web(`/api/attendance/reviews/${outOfArea?.id}`, adminCookie, json('POST', { decision: 'APPROVED', note: '  ' }))
  check('sin nota -> 400', w.status === 400, String(w.status))
  const adminPending = await rawMark(admin.id, outOfArea?.shift.id, 'IN', 'PENDING_REVIEW', new Date(), ['OUT_OF_AREA'])
  w = await web(`/api/attendance/reviews/${adminPending.id}`, adminCookie, json('POST', { decision: 'APPROVED', note: 'yo mismo' }))
  check('nadie revisa sus propias marcaciones -> 403', w.status === 403, `${w.status} ${w.json?.error}`)
  w = await web(`/api/attendance/reviews/${outOfArea?.id}`, adminCookie, json('POST', { decision: 'APPROVED', note: 'Smoke: el evento se movió' }))
  check('aprobar con nota -> 200 y queda en la bitácora', w.status === 200 && !!(await prisma.auditLog.findFirst({ where: { action: 'ATTENDANCE_MARK_REVIEWED', entityId: outOfArea?.id } })), `${w.status} ${w.json?.error}`)
  w = await web(`/api/attendance/reviews/${outOfArea?.id}`, adminCookie, json('POST', { decision: 'REJECTED', note: 'cambio de opinión' }))
  check('la decisión es definitiva: revisar otra vez -> 409', w.status === 409, String(w.status))
  w = await web(`/api/attendance/reviews/${lowGps?.id}`, adminCookie, json('POST', { decision: 'REJECTED', note: 'Smoke: no estaba en el lugar' }))
  check('rechazar con nota -> 200', w.status === 200, String(w.status))
  const valid = await prisma.attendanceMark.findFirst({ where: { userId: user.id, status: 'VALID' } })
  w = await web(`/api/attendance/reviews/${valid?.id}`, adminCookie, json('POST', { decision: 'APPROVED', note: 'x' }))
  check('una marcación válida no se revisa -> 409', w.status === 409, String(w.status))
  w = await web('/api/attendance/reviews?state=done', viewerCookie)
  check('pestaña "revisadas": las dos, con la nota y quién decidió', w.json?.marks?.filter((m) => m.user.id === user.id && m.review?.reviewer).length === 2, JSON.stringify(w.json?.marks?.length))
  const phone = await loginAs('smoke-phone-MARK')
  const hist = await call('GET', '/marks', { token: phone.accessToken })
  const seen = hist.data?.marks?.find((m) => m.id === outOfArea?.id)
  check('la app ve la decisión del supervisor en el historial', seen?.review?.decision === 'APPROVED' && seen.review.note === 'Smoke: el evento se movió', JSON.stringify(seen?.review))

  console.log('\n29. Reporte por persona, área y fechas')
  const day = (offset) => new Date(Date.now() - 5 * 3_600_000 + offset * DAY).toISOString().slice(0, 10)
  const at = (d, hm) => new Date(`${d}T${hm}:00-05:00`)
  const area = await prisma.attendanceArea.create({ data: { name: `${AREA_PREFIX} reporte`, latitude: 4.6097, longitude: -74.0817, radiusMeters: 50 } })
  const [d2, d3, d4] = [day(-2), day(-3), day(-4)]
  const assignment = await prisma.attendanceAssignment.create({
    data: {
      areaId: area.id,
      userId: user.id,
      shifts: {
        create: [
          { startsAt: at(d2, '08:00'), endsAt: at(d2, '17:00') },
          { startsAt: at(d3, '08:00'), endsAt: at(d3, '17:00') },
          { startsAt: at(d4, '08:00'), endsAt: at(d4, '17:00') },
        ],
      },
    },
    include: { shifts: { orderBy: { startsAt: 'desc' } } },
  })
  const [s2, s3, s4] = assignment.shifts
  await rawMark(user.id, s2.id, 'IN', 'VALID', at(d2, '08:20'))
  await rawMark(user.id, s2.id, 'OUT', 'VALID', at(d2, '18:30'))
  await rawMark(user.id, s4.id, 'IN', 'PENDING_REVIEW', at(d4, '08:00'), ['OUT_OF_AREA'])
  await rawMark(user.id, s4.id, 'OUT', 'VALID', at(d4, '17:40'))
  const q = `from=${d4}&to=${d2}&areaId=${area.id}`

  w = await web(`/api/attendance/report?${q}`, plainCookie)
  check('sin el módulo -> 403', w.status === 403, String(w.status))
  w = await web(`/api/attendance/report?${q}`, viewerCookie)
  const byShift = (id) => w.json?.rows?.find((r) => r.shift.id === id)
  const r2 = byShift(s2.id)
  check('3 filas (una por turno) para esa área', w.status === 200 && w.json?.rows?.length === 3, `${w.status} ${w.json?.rows?.length} ${w.json?.error}`)
  check('turno con tardanza: 20 min tarde, 10:10 trabajadas, 1:30 extra por aprobar', r2?.lateMinutes === 20 && r2.workedMinutes === 610 && r2.overtimeMinutes === 90 && r2.overtime.state === 'to_approve', JSON.stringify(r2))
  check('turno sin marcaciones: ausente', byShift(s3.id)?.status === 'absent')
  const r4 = byShift(s4.id)
  check('turno con una marcación en revisión: horas provisionales y extra bloqueada hasta revisar', r4?.pendingReviews === 1 && r4.pendingMinutes === 580 && r4.overtimeMinutes === 40 && r4.overtime.state === 'blocked_by_review', JSON.stringify(r4))
  const sum = w.json?.summary?.find((s) => s.user.id === user.id)
  check('resumen por persona: 3 turnos, 1 tardanza, 1 ausencia', sum?.shifts === 3 && sum.lateCount === 1 && sum.absences === 1 && sum.workedMinutes === 610 + 580, JSON.stringify(sum))
  check('con permiso de ver: no puede decidir horas extra', w.json?.canDecide === false)
  w = await web(`/api/attendance/report?from=${day(-90)}&to=${d2}`, viewerCookie)
  check('rango de más de 62 días -> 400', w.status === 400, String(w.status))
  w = await web(`/api/attendance/report?from=${d2}&to=${d4}`, viewerCookie)
  check('desde después de hasta -> 400', w.status === 400, String(w.status))
  const csvRes = await fetch(`${BASE}/api/attendance/report?${q}&format=csv`, { headers: { cookie: viewerCookie } })
  const csvBytes = new Uint8Array(await csvRes.arrayBuffer())
  const csv = new TextDecoder('utf-8', { ignoreBOM: true }).decode(csvBytes)
  const csvRow = csv.split('\r\n').find((l) => l.startsWith(d2))
  check(
    'CSV para Excel: separador ";", BOM y los mismos números',
    csvRes.status === 200 && /text\/csv/.test(csvRes.headers.get('content-type') ?? '') && csv.charCodeAt(0) === 0xfeff && csv.includes('Tardanza (min)') && csvRow?.split(';')[14] === '20',
    `${csvRes.status} ${csvRow}`
  )
  check('...la exportación queda en la bitácora', !!(await prisma.auditLog.findFirst({ where: { action: 'ATTENDANCE_REPORT_EXPORTED', performedBy: viewer.id } })))

  console.log('\n30. Aprobación de horas extra')
  const ot = (cookie, body) => web('/api/attendance/overtime', cookie, json('POST', { userId: user.id, shiftId: s2.id, ...body }))
  w = await ot(viewerCookie, { decision: 'APPROVED' })
  check('con permiso de ver: aprobar -> 403', w.status === 403, String(w.status))
  w = await ot(adminCookie, { userId: admin.id, decision: 'APPROVED' })
  check('nadie aprueba sus propias horas extra -> 403', w.status === 403, String(w.status))
  w = await ot(adminCookie, { shiftId: s4.id, decision: 'APPROVED' })
  check('con marcaciones en revisión en el turno -> 409', w.status === 409, `${w.status} ${w.json?.error}`)
  w = await ot(adminCookie, { decision: 'APPROVED', minutes: 120 })
  check('aprobar más minutos de los calculados -> 400', w.status === 400, String(w.status))
  w = await ot(adminCookie, { decision: 'APPROVED', minutes: 60 })
  check('aprobar menos minutos sin explicar -> 400', w.status === 400, String(w.status))
  w = await ot(adminCookie, { decision: 'APPROVED' })
  check(
    'aprobar todo -> 200 (90 min) y queda en la bitácora',
    w.status === 200 && w.json?.approvedMinutes === 90 && !!(await prisma.auditLog.findFirst({ where: { action: 'ATTENDANCE_OVERTIME_DECIDED', performedBy: admin.id } })),
    `${w.status} ${w.json?.error}`
  )
  w = await web(`/api/attendance/report?${q}`, viewerCookie)
  check('el reporte la muestra aprobada', byShift(s2.id)?.overtime.state === 'approved' && byShift(s2.id)?.overtime.approvedMinutes === 90 && w.json.summary.find((s) => s.user.id === user.id)?.overtimeApprovedMinutes === 90)
  w = await ot(adminCookie, { decision: 'REJECTED' })
  check('rechazar sin nota -> 400', w.status === 400, String(w.status))
  w = await ot(adminCookie, { decision: 'REJECTED', note: 'Smoke: no autorizadas' })
  check('se puede cambiar la decisión: rechazada -> 200', w.status === 200, String(w.status))
  w = await web(`/api/attendance/report?${q}`, viewerCookie)
  check('...el reporte la muestra rechazada, 0 aprobadas', byShift(s2.id)?.overtime.state === 'rejected' && byShift(s2.id)?.overtime.approvedMinutes === 0)
  const s4in = await prisma.attendanceMark.findFirst({ where: { shiftId: s4.id, status: 'PENDING_REVIEW' } })
  await web(`/api/attendance/reviews/${s4in?.id}`, adminCookie, json('POST', { decision: 'REJECTED', note: 'Smoke: fuera del lugar' }))
  w = await web(`/api/attendance/report?${q}`, viewerCookie)
  const r4b = byShift(s4.id)
  check('entrada rechazada por el supervisor: el par no suma horas ni extra', r4b?.workedMinutes === 0 && r4b.overtimeMinutes === 0 && r4b.rejectedMarks === 1 && r4b.status === 'absent', JSON.stringify(r4b))
}

async function cleanupPhase6() {
  const users = await prisma.user.findMany({ where: { email: { in: [EMAIL, ...Object.values(PHASE3_EMAILS)] } }, select: { id: true } })
  const ids = users.map((u) => u.id)
  const c = r2()
  const withPhoto = await prisma.attendanceMark.findMany({ where: { userId: { in: ids }, selfieKey: { not: null } }, select: { selfieKey: true } })
  if (c) for (const { selfieKey } of withPhoto) await c.s3.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: selfieKey })).catch(() => {})
  await prisma.attendanceShiftLock.deleteMany({ where: { userId: { in: ids } } })
  await prisma.attendanceMarkReview.deleteMany({ where: { mark: { userId: { in: ids } } } })
  await prisma.attendanceOvertimeDecision.deleteMany({ where: { userId: { in: ids } } })
  await prisma.attendanceMark.deleteMany({ where: { userId: { in: ids } } })
  await prisma.auditLog.deleteMany({
    where: { entityType: { in: ['attendance_mark', 'attendance_shift_lock', 'attendance_overtime', 'attendance_report'] }, performedBy: { in: ids } },
  })
}

async function cleanupPhase5() {
  await prisma.attendanceArea.deleteMany({ where: { name: { startsWith: AREA_PREFIX } } })
  await prisma.team.deleteMany({ where: { name: SMOKE_TEAM } })
  await prisma.auditLog.deleteMany({ where: { module: 'asistencia_areas', description: { contains: 'Smoke' } } })
  await prisma.userPermission.deleteMany({ where: { module: 'asistencia_areas', user: { email: { in: Object.values(PHASE3_EMAILS) } } } })
}

async function cleanupPhase4() {
  const users = await prisma.user.findMany({ where: { email: { in: [EMAIL, ...Object.values(PHASE3_EMAILS)] } }, select: { id: true } })
  const ids = users.map((u) => u.id)
  const left = await prisma.faceEnrollment.findMany({ where: { userId: { in: ids }, imageKey: { not: null } }, select: { imageKey: true } })
  const c = r2()
  if (c) for (const { imageKey } of left) await c.s3.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: imageKey })).catch(() => {})
  await prisma.faceEnrollment.deleteMany({ where: { userId: { in: ids } } })
  await prisma.livenessAttempt.deleteMany({ where: { userId: { in: ids } } })
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
    await cleanupPhase6().catch((e) => console.error('Limpieza fase 6:', e.message))
    await cleanupPhase5().catch((e) => console.error('Limpieza fase 5:', e.message))
    await cleanupPhase4().catch((e) => console.error('Limpieza fase 4:', e.message))
    // Las entradas de bitácora de los registros faciales apuntan al id del registro
    await prisma.auditLog.deleteMany({ where: { entityType: 'face_enrollment', description: { contains: 'prueba.local' } } }).catch(() => {})
    await cleanupPhase3().catch((e) => console.error('Limpieza fase 3:', e.message))
    const u = await prisma.user.findUnique({ where: { email: EMAIL } })
    if (u) await prisma.user.delete({ where: { id: u.id } })
    await prisma.mobileLoginAttempt.deleteMany({ where: { OR: [{ key: `email:${EMAIL}` }, { key: 'email:nadie@prueba.local' }, { key: `ip:${FAKE_IP}` }] } })
    await prisma.$disconnect()
    console.log(`\nResultado: ${passed} correctas, ${failed} fallidas`)
    process.exit(failed ? 1 : 0)
  })
