import { useState } from 'react'
import { Music2 } from 'lucide-react'
import { cn } from '../lib/format'

interface CoverProps {
  src?: string | null
  alt: string
  className?: string
  rounded?: string
  iconClassName?: string
}

export function Cover({ src, alt, className, rounded = 'rounded-xl', iconClassName }: CoverProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed

  return (
    <div className={cn('bg-ink-800 relative shrink-0 overflow-hidden', rounded, className)}>
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="from-accent/40 via-ink-800 to-hot/20 flex h-full w-full items-center justify-center bg-gradient-to-br"
          aria-hidden="true"
        >
          <Music2 className={cn('size-1/3 text-white/60', iconClassName)} />
        </div>
      )}
    </div>
  )
}
