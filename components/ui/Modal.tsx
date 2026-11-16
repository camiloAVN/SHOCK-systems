'use client'

import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils/cn'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showCloseButton?: boolean
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  // En celular se abre como panel desde abajo; en pantallas grandes, centrado.
  // Nunca más alto que la pantalla: el contenido se desplaza por dentro.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex w-full flex-col bg-gray-900 border border-gray-800 shadow-2xl',
          'max-h-[92dvh] rounded-t-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl',
          'transform transition-all duration-200',
          sizes[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-800 px-4 py-3 sm:p-6">
            {title && (
              <h2 className="min-w-0 truncate text-lg font-semibold text-gray-100 sm:text-xl">{title}</h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="-mr-1 shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:text-gray-100"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">{children}</div>
      </div>
    </div>,
    document.body
  )
}
