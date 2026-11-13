import type { HTMLAttributes, ReactNode } from 'react'
import { SongRow } from './SongRow'
import type { Song } from '../types'

interface SongListProps {
  songs: Song[]
  label?: string
  showAlbum?: boolean
  extraActions?: (song: Song, index: number) => ReactNode
  rowProps?: (song: Song, index: number) => HTMLAttributes<HTMLDivElement>
}

export function SongList({ songs, label = 'Canciones', showAlbum, extraActions, rowProps }: SongListProps) {
  return (
    <ul className="space-y-0.5" aria-label={label}>
      {songs.map((song, index) => (
        <li key={song.id}>
          <SongRow
            song={song}
            index={index}
            queue={songs}
            showAlbum={showAlbum}
            extraActions={extraActions?.(song, index)}
            rowProps={rowProps?.(song, index)}
          />
        </li>
      ))}
    </ul>
  )
}
