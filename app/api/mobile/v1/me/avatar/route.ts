import { MobileApiError, mobileOk } from '@/lib/mobile/errors'
import { authedMobileRoute } from '@/lib/mobile/handler'
import { loadMe } from '@/lib/mobile/profile'
import { AVATAR_MAX_BYTES, removeAvatar, replaceAvatar, sniffImageType } from '@/lib/users/avatar'

export const dynamic = 'force-dynamic'

// Foto de perfil (la misma de la web: User.image). No es la foto del registro facial,
// que vive en el bucket privado y no se muestra en ningún perfil.

// POST /api/mobile/v1/me/avatar — multipart `photo` (JPEG/PNG/WEBP, máx. 3 MB)
export const POST = authedMobileRoute(async (request, actor) => {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw new MobileApiError('VALIDATION_ERROR', 'Se esperaba un formulario multipart con la foto')
  }
  const photo = form.get('photo')
  if (!(photo instanceof File)) throw new MobileApiError('VALIDATION_ERROR', 'Falta la foto')
  if (photo.size > AVATAR_MAX_BYTES) throw new MobileApiError('IMAGE_TOO_LARGE')
  const buffer = Buffer.from(await photo.arrayBuffer())
  const type = sniffImageType(buffer)
  if (!type) throw new MobileApiError('INVALID_IMAGE')

  await replaceAvatar(actor.userId, buffer, type)
  return mobileOk(await loadMe(actor.userId, actor.installationId))
})

// DELETE /api/mobile/v1/me/avatar — quitar la foto de perfil
export const DELETE = authedMobileRoute(async (_request, actor) => {
  await removeAvatar(actor.userId)
  return mobileOk(await loadMe(actor.userId, actor.installationId))
})
