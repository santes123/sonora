import { useState } from 'react'
import { cn } from '../lib/format'
import { initialOf, paletteFor } from '../lib/cover'
import type { Playlist } from '../types'

interface PlaylistCoverProps {
  playlist: Playlist
  className?: string
  rounded?: string
}

/**
 * Portada de una playlist.
 *
 * Si el usuario ha subido una imagen se muestra esa. Si no, se genera una
 * portada con la inicial de la playlist sobre un degradado derivado de su
 * nombre: estable, sin peticiones extra y sin ficheros que gestionar.
 */
export function PlaylistCover({ playlist, className, rounded = 'rounded-xl' }: PlaylistCoverProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(playlist.cover_url) && !failed

  if (showImage) {
    return (
      <div className={cn('bg-ink-800 relative shrink-0 overflow-hidden', rounded, className)}>
        <img
          src={playlist.cover_url ?? undefined}
          alt={`Portada de ${playlist.name}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  const palette = paletteFor(playlist.name || `playlist-${playlist.id}`)

  return (
    <div
      className={cn('relative flex shrink-0 items-center justify-center overflow-hidden', rounded, className)}
      style={{ backgroundImage: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}
      role="img"
      aria-label={`Portada de ${playlist.name}`}
    >
      <span
        className="text-5xl leading-none font-bold select-none"
        style={{ color: palette.foreground }}
        aria-hidden="true"
      >
        {initialOf(playlist.name)}
      </span>
    </div>
  )
}
