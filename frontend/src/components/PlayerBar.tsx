import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Cover } from './Cover'
import { usePlayer } from '../context/PlayerContext'
import { cn, formatDuration } from '../lib/format'

export function PlayerBar() {
  const {
    queue,
    current,
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    clearQueue,
  } = usePlayer()

  // Atajos globales: espacio play/pausa, flechas ±5 s, m silenciar, n/p pista.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const interactive = target?.closest(
        'input, textarea, select, button, a, [contenteditable="true"], [role="textbox"]',
      )

      if (interactive) {
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        togglePlay()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        seek(currentTime + 5)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        seek(currentTime - 5)
      } else if (event.key.toLowerCase() === 'm') {
        toggleMute()
      } else if (event.key.toLowerCase() === 'n') {
        next()
      } else if (event.key.toLowerCase() === 'p') {
        previous()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePlay, seek, currentTime, toggleMute, next, previous])

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  const remaining = duration > 0 ? duration : 0

  return (
    <section
      className="border-ink-700/80 bg-ink-900/95 fixed inset-x-0 bottom-16 z-40 border-t backdrop-blur-xl lg:bottom-0"
      aria-label="Reproductor"
    >
      <div className="bg-ink-700/60 h-0.5 w-full lg:hidden">
        <div
          className="bg-accent h-full transition-[width] duration-200"
          style={{ width: remaining > 0 ? `${Math.min(100, (currentTime / remaining) * 100)}%` : '0%' }}
        />
      </div>

      <div className="mx-auto flex h-20 w-full max-w-[1500px] items-center gap-2 px-3 sm:gap-4 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Cover
            src={current?.cover_url}
            alt={current ? `Portada de ${current.title}` : 'Sin reproducción'}
            className="size-12"
            rounded="rounded-lg"
            iconClassName="size-5"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {current ? current.title : 'Nada en reproducción'}
            </p>
            <p className="text-ink-300 truncate text-xs">
              {current ? (
                current.artist?.id ? (
                  <Link
                    to={`/artists/${current.artist.id}`}
                    className="hover:text-accent-soft hover:underline"
                  >
                    {current.artist_name ?? 'Artista desconocido'}
                  </Link>
                ) : (
                  <span>{current.artist_name ?? 'Artista desconocido'}</span>
                )
              ) : (
                'Elige una canción para empezar'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-none flex-col items-center gap-1 lg:flex-1">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={toggleShuffle}
              className={cn('icon-btn hidden sm:inline-flex', shuffle && 'text-accent-soft')}
              aria-label={shuffle ? 'Desactivar reproducción aleatoria' : 'Activar reproducción aleatoria'}
              aria-pressed={shuffle}
              title="Aleatorio"
            >
              <Shuffle className="size-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={previous}
              disabled={!current}
              className="icon-btn"
              aria-label="Canción anterior"
              title="Anterior"
            >
              <SkipBack className="size-5 fill-current" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              disabled={!current}
              className="bg-accent hover:bg-accent-strong flex size-10 items-center justify-center rounded-full text-white transition-colors disabled:opacity-40"
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? (
                <Pause className="size-5 fill-current" aria-hidden="true" />
              ) : (
                <Play className="ml-0.5 size-5 fill-current" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={next}
              disabled={!current}
              className="icon-btn"
              aria-label="Canción siguiente"
              title="Siguiente"
            >
              <SkipForward className="size-5 fill-current" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={cycleRepeat}
              className={cn('icon-btn hidden sm:inline-flex', repeat !== 'off' && 'text-accent-soft')}
              aria-label={
                repeat === 'off'
                  ? 'Activar repetición'
                  : repeat === 'all'
                    ? 'Repetir una sola canción'
                    : 'Desactivar repetición'
              }
              aria-pressed={repeat !== 'off'}
              title={repeat === 'one' ? 'Repetir canción' : 'Repetir cola'}
            >
              {repeat === 'one' ? (
                <Repeat1 className="size-4" aria-hidden="true" />
              ) : (
                <Repeat className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>

          <div className="hidden w-full max-w-md items-center gap-2 lg:flex">
            <span className="text-ink-400 w-10 text-right text-[11px] tabular-nums">
              {formatDuration(currentTime * 1000)}
            </span>
            <input
              type="range"
              min={0}
              max={remaining || 0}
              step={0.1}
              value={Math.min(currentTime, remaining || 0)}
              onChange={(event) => seek(Number(event.target.value))}
              disabled={!current}
              className="h-1 w-full cursor-pointer"
              aria-label="Posición de reproducción"
              aria-valuetext={`${formatDuration(currentTime * 1000)} de ${formatDuration(remaining * 1000)}`}
            />
            <span className="text-ink-400 w-10 text-[11px] tabular-nums">
              {formatDuration(remaining * 1000)}
            </span>
          </div>
        </div>

        <div className="hidden flex-1 items-center justify-end gap-1 lg:flex">
          <button
            type="button"
            onClick={toggleMute}
            className="icon-btn"
            aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            aria-pressed={muted}
          >
            <VolumeIcon className="size-4" aria-hidden="true" />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="h-1 w-24 cursor-pointer"
            aria-label="Volumen"
          />

          {queue.length > 0 ? (
            <button
              type="button"
              onClick={clearQueue}
              className="icon-btn ml-2"
              aria-label="Vaciar la cola de reproducción"
              title={`Vaciar cola (${queue.length})`}
            >
              <span className="relative">
                <ListMusic className="size-4" aria-hidden="true" />
                <span className="bg-accent absolute -top-1.5 -right-2 rounded-full px-1 text-[10px] leading-4 font-bold text-white">
                  {queue.length}
                </span>
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
