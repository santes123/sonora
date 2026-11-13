import { Link } from 'react-router-dom'
import { Lock, Users } from 'lucide-react'
import { Cover } from './Cover'
import { pluralize } from '../lib/format'
import type { Playlist } from '../types'

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <Link
      to={`/playlists/${playlist.id}`}
      className="card group hover:border-ink-500 focus-visible:border-accent block p-3 transition-colors"
    >
      <div className="relative">
        <Cover
          src={playlist.cover_url}
          alt={`Portada de ${playlist.name}`}
          className="aspect-square w-full"
          rounded="rounded-xl"
        />
        <span className="bg-ink-950/70 text-ink-200 absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-1 text-xs backdrop-blur">
          {playlist.is_public ? (
            <>
              <Users className="size-3" aria-hidden="true" />
              Pública
            </>
          ) : (
            <>
              <Lock className="size-3" aria-hidden="true" />
              Privada
            </>
          )}
        </span>
      </div>

      <h3 className="mt-3 truncate text-sm font-semibold text-white">{playlist.name}</h3>
      <p className="text-ink-300 mt-0.5 truncate text-xs">
        {pluralize(playlist.songs_count, 'canción', 'canciones')}
        {playlist.user ? ` · ${playlist.user.name}` : ''}
      </p>
    </Link>
  )
}
