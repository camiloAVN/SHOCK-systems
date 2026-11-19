import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth/check-permission'
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES, removeAvatar, replaceAvatar, sniffImageType } from '@/lib/users/avatar'

/**
 * Profile photo of the CURRENT user.
 * The target user always comes from the session — never from the URL or body —
 * so nobody can change another person's photo. Shared logic with the app: lib/users/avatar.ts
 */

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
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no soportado. Usa JPG, PNG o WEBP' }, { status: 400 })
    }
    if (file.size > AVATAR_MAX_BYTES) {
      return NextResponse.json({ error: 'La imagen no puede ser mayor a 3MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const realType = sniffImageType(buffer)
    if (!realType) {
      return NextResponse.json({ error: 'El archivo no es una imagen válida' }, { status: 400 })
    }

    const url = await replaceAvatar(actor.userId, buffer, realType)

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

    await removeAvatar(actor.userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting avatar:', error)
    return NextResponse.json({ error: 'Error al eliminar la foto' }, { status: 500 })
  }
}
