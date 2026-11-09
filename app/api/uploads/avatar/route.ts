import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireActiveUser } from '@/lib/auth/check-permission'
import {
  buildAvatarKey,
  buildPublicFileUrl,
  deleteObjectFromR2,
  isAvatarKeyOf,
  parseManagedR2KeyFromUrl,
  uploadBufferToR2,
} from '@/lib/storage/r2'

/**
 * Profile photo of the CURRENT user.
 * The target user always comes from the session — never from the URL or body —
 * so nobody can change another person's photo.
 */

const MAX_FILE_SIZE = 3 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Verify real file content (magic bytes), not only the client-declared MIME type
function sniffImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return null
}

async function removeOldAvatar(userId: string, oldUrl: string | null) {
  if (!oldUrl) return
  const key = parseManagedR2KeyFromUrl(oldUrl)
  // Only delete files that are inside this user's own avatar folder
  if (key && isAvatarKeyOf(key, userId)) {
    try {
      await deleteObjectFromR2(key)
    } catch (err) {
      console.error('Error deleting previous avatar:', err)
    }
  }
}

// POST /api/uploads/avatar — upload/replace my profile photo
export async function POST(request: NextRequest) {
  try {
    const actor = await requireActiveUser()
    if (!actor.hasPermission || !actor.userId) {
      return NextResponse.json({ error: actor.error }, { status: actor.status })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo no válido' }, { status: 400 })
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no soportado. Usa JPG, PNG o WEBP' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'La imagen no puede ser mayor a 3MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const realType = sniffImageType(buffer)
    if (!realType) {
      return NextResponse.json({ error: 'El archivo no es una imagen válida' }, { status: 400 })
    }

    const key = buildAvatarKey(actor.userId, realType)
    await uploadBufferToR2({ key, body: buffer, contentType: realType })
    const url = buildPublicFileUrl(key)

    const previous = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { image: true },
    })

    await prisma.user.update({
      where: { id: actor.userId },
      data: { image: url },
    })

    await removeOldAvatar(actor.userId, previous?.image ?? null)

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error uploading avatar:', error)
    return NextResponse.json({ error: 'Error al subir la foto' }, { status: 500 })
  }
}

// DELETE /api/uploads/avatar — remove my profile photo
export async function DELETE() {
  try {
    const actor = await requireActiveUser()
    if (!actor.hasPermission || !actor.userId) {
      return NextResponse.json({ error: actor.error }, { status: actor.status })
    }

    const previous = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { image: true },
    })

    await prisma.user.update({
      where: { id: actor.userId },
      data: { image: null },
    })

    await removeOldAvatar(actor.userId, previous?.image ?? null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting avatar:', error)
    return NextResponse.json({ error: 'Error al eliminar la foto' }, { status: 500 })
  }
}
