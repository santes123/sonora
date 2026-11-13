import type { HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AudioLines, Pause, Play } from 'lucide-react'
import { AddToPlaylistMenu } from './AddToPlaylistMenu'
import { Cover } from './Cover'
import { LikeButton } from './LikeButton'
import { usePlayer } from '../context/PlayerContext'
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
  const isCurrent = current?.id === song.id
  const isPlayingThis = isCurrent && isPlaying
  const actionLabel = isPlayingThis
    ? `Pausar ${song.title}`
    : `Reproducir ${song.title}${song.artist_name ? ` de ${song.artist_name}` : ''}`

  const handlePlay = () => {
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
        aria-label={actionLabel}
        className="relative md:hidden"
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
        aria-label={actionLabel}
        className="relative hidden size-8 items-center justify-center rounded-lg md:flex"
      >
        {isPlayingThis ? (
          <AudioLines className="text-accent-soft size-4" aria-hidden="true" />
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
        <p className={cn('truncate text-sm font-medium', isCurrent ? 'text-accent-soft' : 'text-white')}>
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
          <span className="text-ink-400 md:hidden"> · {formatDuration(song.duration_ms)}</span>
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
        <LikeButton song={song} />
        <AddToPlaylistMenu song={song} />
        {extraActions}
      </div>
    </div>
  )
}
