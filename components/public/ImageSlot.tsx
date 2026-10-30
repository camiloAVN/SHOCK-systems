import Image from 'next/image'
import { ImageIcon } from 'lucide-react'
import type { SiteImage } from './site-content'

interface ImageSlotProps {
  image: SiteImage
  sizes: string
}

export function ImageSlot({ image, sizes }: ImageSlotProps) {
  return (
    <div className="slot">
      {image.src ? (
        <Image src={image.src} alt={image.alt} fill sizes={sizes} className="slot-img" />
      ) : (
        <div className="slot-empty" role="img" aria-label={image.alt}>
          <ImageIcon aria-hidden="true" />
          <span>{image.alt}</span>
        </div>
      )}
    </div>
  )
}
