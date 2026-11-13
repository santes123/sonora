import { Heart } from 'lucide-react'
import { useLikes } from '../context/LikesContext'
import { cn } from '../lib/format'
import type { Song } from '../types'

interface LikeButtonProps {
  song: Song
  className?: string
}

/**
 * Botón de "me gusta".
 *
 * Es el mismo control en las filas de canciones y en el reproductor, para que
 * el usuario vea el mismo estado en los dos sitios. El estado se aplica de
 * forma optimista: el corazón cambia al instante y se revierte solo si la
 * petición al servidor falla.
 */
export function LikeButton({ song, className }: LikeButtonProps) {
  const { isLiked, toggleLike, isPending } = useLikes()
  const liked = isLiked(song)

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        toggleLike(song)
      }}
      disabled={isPending(song.id)}
      className={cn('icon-btn', liked && 'text-accent-soft', className)}
      aria-label={
        liked
          ? `Quitar «${song.title}» de tus canciones que te gustan`
          : `Añadir «${song.title}» a tus canciones que te gustan`
      }
      aria-pressed={liked}
      title={liked ? 'Quitar de tus favoritas' : 'Añadir a tus favoritas'}
    >
      <Heart className={cn('size-4', liked && 'fill-current')} aria-hidden="true" />
    </button>
  )
}
