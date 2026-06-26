'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

interface CameraCaptureProps {
  isOpen: boolean
  onCapture: (file: File) => void
  onClose: () => void
}

type FacingMode = 'environment' | 'user'

/**
 * In-browser camera capture using getUserMedia. Works on Android and iOS Safari
 * as well as desktop webcams. The captured frame is handed back as a JPEG File;
 * the caller is responsible for optimizing it before upload.
 */
export function CameraCapture({ isOpen, onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<FacingMode>('environment')
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setIsReady(false)
  }, [])

  const startStream = useCallback(async () => {
    setError(null)
    setIsReady(false)
    stopStream()

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite acceder a la cámara.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => {})
      }
      setIsReady(true)
    } catch {
      setError(
        'No se pudo acceder a la cámara. Revisa los permisos del navegador e inténtalo de nuevo.'
      )
    }
  }, [facingMode, stopStream])

  // Start when opened or when the camera is switched; always clean up on close.
  useEffect(() => {
    if (isOpen) {
      void startStream()
    }
    return () => stopStream()
  }, [isOpen, startStream, stopStream])

  const handleCapture = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `captura-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        })
        stopStream()
        onCapture(file)
      },
      'image/jpeg',
      0.92
    )
  }, [onCapture, stopStream])

  const toggleFacing = useCallback(() => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }, [])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tomar foto" size="lg">
      <div className="space-y-4">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-400" />
              <p className="text-sm text-gray-300">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void startStream()}
              >
                Reintentar
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-contain"
              />
              {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-gray-400">Iniciando cámara…</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleFacing}
            disabled={!!error}
            title="Cambiar cámara"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Cambiar
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCapture}
              disabled={!isReady || !!error}
            >
              <Camera className="mr-2 h-4 w-4" />
              Capturar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
