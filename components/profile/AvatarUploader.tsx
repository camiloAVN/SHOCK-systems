'use client'

import { useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Camera, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useAuthStore } from '@/store/authStore'

const OUTPUT_SIZE = 512

/** Center-crop to a square and downscale to 512px before uploading (faster, lighter). */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2
  const target = Math.min(OUTPUT_SIZE, side)
  const canvas = document.createElement('canvas')
  canvas.width = target
  canvas.height = target
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, target, target)
  bitmap.close?.()
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.88)
  )
}

interface AvatarUploaderProps {
  image: string | null
  name: string | null
  email: string
  onChange: (url: string | null) => void
}

export function AvatarUploader({ image, name, email, onChange }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const { update } = useSession()
  const { user, setUser } = useAuthStore()

  const syncSession = async (url: string | null) => {
    onChange(url)
    if (user) setUser({ ...user, image: url })
    try {
      await update({ image: url })
    } catch {
      /* the store already reflects the change */
    }
  }

  const handleFile = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Usa una imagen JPG, PNG o WEBP')
      return
    }
    setBusy(true)
    try {
      let blob: Blob = file
      try {
        blob = await toSquareJpeg(file)
      } catch {
        /* fallback: send original file */
      }
      const fd = new FormData()
      fd.append('file', new File([blob], 'avatar.jpg', { type: blob.type || file.type }))
      const res = await fetch('/api/uploads/avatar', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo subir la foto')
      await syncSession(data.url)
      toast.success('Foto de perfil actualizada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo subir la foto')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    if (!confirm('¿Quitar tu foto de perfil?')) return
    setBusy(true)
    try {
      const res = await fetch('/api/uploads/avatar', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await syncSession(null)
      toast.success('Foto eliminada')
    } catch {
      toast.error('No se pudo eliminar la foto')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="group relative">
        <UserAvatar src={image} name={name} email={email} size="2xl" className="shadow-xl shadow-black/40" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-wait"
          aria-label="Cambiar foto de perfil"
        >
          <Camera className="h-7 w-7" />
        </button>
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          </span>
        )}
      </div>

      <div className="text-center sm:text-left">
        <p className="text-lg font-semibold text-gray-100">{name || 'Sin nombre'}</p>
        <p className="text-sm text-gray-400">{email}</p>
        <p className="mt-1 text-xs text-gray-500">JPG, PNG o WEBP · se recorta en cuadrado · máx. 3MB</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button size="sm" onClick={() => inputRef.current?.click()} isLoading={busy}>
            {!busy && <Upload className="mr-1.5 h-4 w-4" />}
            {image ? 'Cambiar foto' : 'Subir foto'}
          </Button>
          {image && (
            <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={handleRemove} disabled={busy}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Quitar
            </Button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
    </div>
  )
}
