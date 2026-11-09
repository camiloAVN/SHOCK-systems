'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

const sizes = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
  '2xl': 'h-32 w-32 text-3xl',
}

export function initialsOf(name?: string | null, email?: string | null) {
  const base = (name || '').trim()
  if (base) {
    const parts = base.split(/\s+/)
    return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
  }
  return (email?.[0] || 'U').toUpperCase()
}

interface UserAvatarProps {
  src?: string | null
  name?: string | null
  email?: string | null
  size?: keyof typeof sizes
  className?: string
  ring?: boolean
}

/** Profile photo with initials fallback (also used when the image fails to load). */
export function UserAvatar({ src, name, email, size = 'md', className, ring }: UserAvatarProps) {
  const [failed, setFailed] = useState<string | null>(null)
  const showImg = !!src && failed !== src

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-orange-500 to-amber-500 font-semibold text-white',
        ring && 'ring-2 ring-[#0d0d0d] ring-offset-0',
        sizes[size],
        className
      )}
      aria-label={name || email || 'Usuario'}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={name || 'Foto de perfil'}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src!)}
        />
      ) : (
        initialsOf(name, email)
      )}
    </span>
  )
}
