import { Pause, Play } from 'lucide-react'
import { Cover } from './Cover'
import { SongActions } from './SongActions'
import { usePlayer } from '../context/PlayerContext'
import { cn } from '../lib/format'
import type { Song } from '../types'

interface SongCardProps {
  song: Song
  queue: Song[]
  index: number
  className?: string
}

/**
 * Tarjeta de canción para los carruseles horizontales.
 *
 * A diferencia de `SongRow`, que es una fila de una lista, la tarjeta es
 * cuadrada y muestra la portada grande: es la unidad visual de "Añadido
 * recientemente" y de "Escuchado recientemente".
 */
export function SongCard({ song, queue, index, className }: SongCardProps) {
  const { current, isPlaying, playQueue, togglePlay } = usePlayer()
  const isCurrent = current?.id === song.id
  const isPlayingThis = isCurrent && isPlaying

  const handlePlay = () => {
    if (isCurrent) {
      togglePlay()

      return
    }

    playQueue(queue, index)
  }

  return (
    <div className={cn('group w-40 shrink-0 sm:w-44', className)}>
      <div className="relative">
        <Cover
          src={song.cover_url}
          alt={`Portada de ${song.title}`}
          className="aspect-square w-full"
          rounded="rounded-xl"
        />

        <button
          type="button"
          onClick={handlePlay}
          aria-label={
            isPlayingThis
              ? `Pausar ${song.title}`
              : `Reproducir ${song.title}${song.artist_name ? ` de ${song.artist_name}` : ''}`
          }
          className="bg-accent hover:bg-accent-strong absolute right-2 bottom-2 flex size-10 items-center justify-center rounded-full text-white shadow-lg transition-colors"
        >
          {isPlayingThis ? (
            <Pause className="size-4 fill-current" aria-hidden="true" />
          ) : (
            <Play className="ml-0.5 size-4 fill-current" aria-hidden="true" />
          )}
        </button>

        <div className="absolute top-2 right-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <SongActions song={song} />
        </div>
      </div>

      <p className="mt-2 truncate text-sm font-medium text-white">{song.title}</p>
      <p className="text-ink-300 truncate text-xs">
        {song.artist_name ?? 'Artista desconocido'}
      </p>
    </div>
  )
}
