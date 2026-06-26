'use client'

/**
 * Client-side image optimization for product images.
 *
 * Runs entirely in the browser using the native Canvas API (zero dependencies,
 * zero server/deploy cost): decodes the source honoring its EXIF orientation
 * (fixes rotated phone photos), downscales to a sane max dimension and re-encodes
 * to WebP. Falls back to JPEG when WebP encoding is unavailable.
 *
 * The optimized file is what gets uploaded to R2, so large originals from phones
 * or downloaded from the web end up small (~80-90% lighter) before they ever
 * leave the device.
 */

export interface OptimizeImageOptions {
  /** Max width/height in px; the image is only ever downscaled, never upscaled. */
  maxDimension?: number
  /** Encoder quality 0..1 (WebP/JPEG). */
  quality?: number
  /** Preferred output type; falls back to JPEG if the browser can't encode it. */
  preferredType?: 'image/webp' | 'image/jpeg'
}

export interface OptimizedImage {
  file: File
  width: number
  height: number
  originalSize: number
  optimizedSize: number
  type: string
}

const DEFAULTS = {
  maxDimension: 1600,
  quality: 0.82,
  preferredType: 'image/webp' as const,
}

function decodeViaImageElement(source: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen. ¿El formato es válido?'))
    }
    img.src = url
  })
}

async function decodeImage(
  source: Blob
): Promise<ImageBitmap | HTMLImageElement> {
  // Primary path: createImageBitmap applies EXIF orientation (rotated phone
  // photos come out upright). On iOS the same call decodes HEIC natively.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(source, { imageOrientation: 'from-image' })
    } catch {
      // Some engines reject the options bag — retry without it.
      try {
        return await createImageBitmap(source)
      } catch {
        // Fall through to the <img> decoder below.
      }
    }
  }
  return decodeViaImageElement(source)
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

/**
 * Optimize a single image file. Returns a new File (WebP when supported) ready
 * to upload. Throws with a user-friendly message if the image can't be decoded.
 */
export async function optimizeImage(
  input: File,
  options?: OptimizeImageOptions
): Promise<OptimizedImage> {
  const opts = { ...DEFAULTS, ...options }

  const decoded = await decodeImage(input)
  const naturalW =
    decoded instanceof HTMLImageElement ? decoded.naturalWidth : decoded.width
  const naturalH =
    decoded instanceof HTMLImageElement ? decoded.naturalHeight : decoded.height

  if (!naturalW || !naturalH) {
    throw new Error('La imagen está vacía o dañada.')
  }

  const scale = Math.min(1, opts.maxDimension / Math.max(naturalW, naturalH))
  const targetW = Math.max(1, Math.round(naturalW * scale))
  const targetH = Math.max(1, Math.round(naturalH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Tu navegador no soporta el procesamiento de imágenes.')
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(decoded as CanvasImageSource, 0, 0, targetW, targetH)

  // Release the decoded bitmap as soon as it's drawn.
  if ('close' in decoded && typeof decoded.close === 'function') {
    decoded.close()
  }

  let outType: string = opts.preferredType
  let blob = await canvasToBlob(canvas, outType, opts.quality)

  // toBlob returns null or a different type when the encoder is unsupported.
  if (!blob || blob.type !== outType) {
    outType = 'image/jpeg'
    blob = await canvasToBlob(canvas, outType, opts.quality)
  }

  if (!blob) {
    throw new Error('No se pudo procesar la imagen.')
  }

  const ext = outType === 'image/webp' ? 'webp' : 'jpg'
  const baseName =
    input.name.replace(/\.[^.]+$/, '').trim() || `imagen-${Date.now()}`
  const file = new File([blob], `${baseName}.${ext}`, { type: outType })

  return {
    file,
    width: targetW,
    height: targetH,
    originalSize: input.size,
    optimizedSize: blob.size,
    type: outType,
  }
}
