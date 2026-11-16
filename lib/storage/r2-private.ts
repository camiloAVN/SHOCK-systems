import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Bucket R2 PRIVADO de la app de asistencia (fotos de referencia y selfies).
 *
 * Es un bucket distinto del público de la plataforma (`lib/storage/r2.ts`, productos y
 * avatares): no tiene dominio público y solo se lee con URLs firmadas de corta duración.
 * Usa su propio token (`R2_ATT_*`), limitado a este bucket.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

let client: S3Client | null = null
function getClient(): { s3: S3Client; bucket: string } {
  const bucket = requireEnv('R2_ATT_BUCKET')
  if (!client) {
    const accountId = requireEnv('R2_ATT_ACCOUNT_ID')
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv('R2_ATT_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('R2_ATT_SECRET_ACCESS_KEY'),
      },
    })
  }
  return { s3: client, bucket }
}

/** Clave de la foto de referencia: enrollments/<usuario>/<registro>.jpg */
export function enrollmentImageKey(userId: string, enrollmentId: string): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '')
  return `enrollments/${safe(userId)}/${safe(enrollmentId)}.jpg`
}

/** Clave de la selfie de una marcación: marks/<usuario>/<marcación>.jpg */
export function markImageKey(userId: string, markId: string): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '')
  return `marks/${safe(userId)}/${safe(markId)}.jpg`
}

/** Descarga un objeto del bucket privado (p. ej. la foto de referencia para compararla). */
export async function getPrivateObject(key: string): Promise<Buffer> {
  const { s3, bucket } = getClient()
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!result.Body) throw new Error(`Objeto vacío en el bucket privado: ${key}`)
  return Buffer.from(await result.Body.transformToByteArray())
}

export async function putPrivateObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const { s3, bucket } = getClient()
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }))
}

export async function deletePrivateObject(key: string): Promise<void> {
  const { s3, bucket } = getClient()
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

/** URL de lectura firmada; caduca a los `expiresInSeconds` (5 minutos por defecto). */
export async function signedReadUrl(key: string, expiresInSeconds = 300): Promise<string> {
  const { s3, bucket } = getClient()
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: expiresInSeconds })
}
