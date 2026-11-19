import { prisma } from '@/lib/db/prisma'
import {
  buildAvatarKey,
  buildPublicFileUrl,
  deleteObjectFromR2,
  isAvatarKeyOf,
  parseManagedR2KeyFromUrl,
  uploadBufferToR2,
} from '@/lib/storage/r2'

/**
 * Foto de perfil del usuario (`User.image`), compartida por la web
 * (`/api/uploads/avatar`) y la app (`/api/mobile/v1/me/avatar`): la que se sube
 * en un lado se ve en el otro. El usuario sale siempre de la sesión o del token.
 */

export const AVATAR_MAX_BYTES = 3 * 1024 * 1024
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Tipo real del archivo por sus primeros bytes (no el que declara el cliente). */
export function sniffImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return null
}

async function removeOldAvatar(userId: string, oldUrl: string | null) {
  if (!oldUrl) return
  const key = parseManagedR2KeyFromUrl(oldUrl)
  // Solo se borran archivos de la carpeta de avatares de ESTE usuario
  if (key && isAvatarKeyOf(key, userId)) {
    try {
      await deleteObjectFromR2(key)
    } catch (err) {
      console.error('Error deleting previous avatar:', err)
    }
  }
}

/** Guarda la foto (ya validada por tamaño y tipo real) y borra la anterior. Devuelve la URL pública. */
export async function replaceAvatar(userId: string, buffer: Buffer, mimeType: string): Promise<string> {
  const key = buildAvatarKey(userId, mimeType)
  await uploadBufferToR2({ key, body: buffer, contentType: mimeType })
  const url = buildPublicFileUrl(key)
  const previous = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } })
  await prisma.user.update({ where: { id: userId }, data: { image: url } })
  await removeOldAvatar(userId, previous?.image ?? null)
  return url
}

export async function removeAvatar(userId: string): Promise<void> {
  const previous = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } })
  await prisma.user.update({ where: { id: userId }, data: { image: null } })
  await removeOldAvatar(userId, previous?.image ?? null)
}
