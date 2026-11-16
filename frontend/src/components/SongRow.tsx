import type { HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AudioLines, Pause, Play } from 'lucide-react'
import { AddToPlaylistMenu } from './AddToPlaylistMenu'
import { Cover } from './Cover'
import { DownloadButton } from './DownloadButton'
import { LikeButton } from './LikeButton'
import { SongActions } from './SongActions'
import { usePlayer } from '../context/PlayerContext'
import { useToast } from '../context/ToastContext'
import { cn, formatDuration } from '../lib/format'
import type { Song } from '../types'

interface SongRowProps {
  song: Song
  index: number
  queue: Song[]
  showAlbum?: boolean
  extraActions?: ReactNode
  rowProps?: HTMLAttributes<HTMLDivElement>
}

export function SongRow({
  song,
  index,
  queue,
  showAlbum = true,
  extraActions,
  rowProps,
}: SongRowProps) {
  const { current, isPlaying, playQueue, togglePlay } = usePlayer()
  const toast = useToast()
  const isCurrent = current?.id === song.id
  const isPlayingThis = isCurrent && isPlaying

  // Una canción eliminada se sigue viendo (puede estar en la playlist de otra
  // persona), pero no se reproduce.
  const unavailable = song.is_deleted

  const actionLabel = unavailable
    ? `${song.title} no está disponible`
    : isPlayingThis
      ? `Pausar ${song.title}`
      : `Reproducir ${song.title}${song.artist_name ? ` de ${song.artist_name}` : ''}`

  const handlePlay = () => {
    if (unavailable) {
      toast.info(`«${song.title}» ya no está disponible.`)

      return
    }

    if (isCurrent) {
      togglePlay()

      return
    }

    playQueue(queue, index)
  }

  return (
    <div
      {...rowProps}
      className={cn(
        'group hover:bg-ink-800/70 grid grid-cols-[2.75rem_1fr_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors md:grid-cols-[2rem_minmax(0,2.2fr)_minmax(0,1.6fr)_auto_auto]',
        isCurrent && 'bg-ink-800/40',
        rowProps?.className,
      )}
    >
      <button
        type="button"
        onClick={handlePlay}
        disabled={unavailable}
        aria-label={actionLabel}
        className="relative md:hidden disabled:cursor-not-allowed"
      >
        <Cover
          src={song.cover_url}
          alt=""
          className="size-11"
          rounded="rounded-lg"
          iconClassName="size-4"
        />
        <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          {isPlayingThis ? (
            <Pause className="size-4 fill-current text-white" aria-hidden="true" />
          ) : (
            <Play className="size-4 fill-current text-white" aria-hidden="true" />
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={handlePlay}
        disabled={unavailable}
        aria-label={actionLabel}
        className="relative hidden size-8 items-center justify-center rounded-lg md:flex disabled:cursor-not-allowed"
      >
        {isPlayingThis ? (
          <AudioLines className="text-accent-soft size-4" aria-hidden="true" />
        ) : unavailable ? (
          <span className="text-ink-600 text-xs">—</span>
        ) : (
          <span
            className={cn(
              'text-sm tabular-nums',
              isCurrent ? 'text-accent-soft' : 'text-ink-400',
            )}
          >
            {index + 1}
          </span>
        )}
        <span className="absolute inset-0 hidden items-center justify-center rounded-lg group-hover:flex">
          {isPlayingThis ? (
            <Pause className="size-4 fill-current text-white" aria-hidden="true" />
          ) : (
            <Play className="size-4 fill-current text-white" aria-hidden="true" />
          )}
        </span>
      </button>

      <div className="min-w-0">
        <p
          className={cn(
            'truncate text-sm font-medium',
            unavailable ? 'text-ink-500' : isCurrent ? 'text-accent-soft' : 'text-white',
          )}
        >
          {song.title}
        </p>
        <p className="text-ink-300 truncate text-sm">
          {song.artist?.id ? (
            <Link
              to={`/artists/${song.artist.id}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-accent-soft hover:underline"
            >
              {song.artist_name ?? 'Artista desconocido'}
            </Link>
          ) : (
            <span>{song.artist_name ?? 'Artista desconocido'}</span>
          )}
          {unavailable ? (
            <span className="text-ink-500 ml-2 rounded-full border border-ink-600 px-2 py-0.5 text-xs">
              No disponible
            </span>
          ) : (
            <span className="text-ink-400 md:hidden"> · {formatDuration(song.duration_ms)}</span>
          )}
        </p>
      </div>

      {showAlbum ? (
        <p className="text-ink-300 hidden truncate text-sm md:block">
          {song.album?.id ? (
            <Link
              to={`/albums/${song.album.id}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-accent-soft hover:underline"
            >
              {song.album_title ?? '—'}
            </Link>
          ) : (
            <span>{song.album_title ?? '—'}</span>
          )}
        </p>
      ) : (
        <span className="hidden md:block" aria-hidden="true" />
      )}

      <p className="text-ink-300 hidden text-sm tabular-nums md:block">
        {formatDuration(song.duration_ms)}
      </p>

      <div className="flex items-center gap-0.5">
        {/* Una canción eliminada no se puede marcar ni descargar. */}
        {unavailable ? null : (
          <>
            <LikeButton song={song} />
            <DownloadButton song={song} />
            <AddToPlaylistMenu song={song} />
          </>
        )}
        <SongActions song={song} />
        {extraActions}
      </div>
    </div>
  )
}
