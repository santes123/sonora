import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ListMusic, Play, Sparkles, Upload } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { PlaylistCard } from '../components/PlaylistCard'
import { RecentlyPlayed } from '../components/RecentlyPlayed'
import { SongList } from '../components/SongList'
import { PageLoader } from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import { usePlayer } from '../context/PlayerContext'
import { api, firstError } from '../lib/api'
import { greeting, pluralize } from '../lib/format'

export function HomePage() {
  const { user } = useAuth()
  const { playQueue } = usePlayer()

  const recent = useQuery({
    queryKey: ['songs', 'recent'],
    queryFn: () => api.songs({ sort: 'newest', per_page: 12 }),
  })

  const playlists = useQuery({
    queryKey: ['playlists', 'mine'],
    queryFn: () => api.playlists(true, 8),
  })

  if (recent.isLoading) {
    return <PageLoader label="Cargando tu biblioteca" />
  }

  if (recent.isError) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No hemos podido cargar el catálogo"
        description={firstError(recent.error)}
        action={
          <button type="button" onClick={() => recent.refetch()} className="btn-primary">
            Reintentar
          </button>
        }
      />
    )
  }

  const songs = recent.data?.data ?? []
  const totalSongs = recent.data?.meta.total ?? 0

  return (
    <div className="space-y-10">
      <section className="card from-accent/25 via-ink-850 to-ink-850 relative overflow-hidden bg-gradient-to-br p-6 sm:p-8">
        <div
          className="bg-hot/20 absolute -top-20 -right-16 size-64 rounded-full blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <p className="text-accent-soft text-sm font-semibold">
            {greeting()}
            {user ? `, ${user.name.split(' ')[0]}` : ''}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Todo tu catálogo, listo para sonar.
          </h1>
          <p className="text-ink-200 mt-2 max-w-2xl text-sm sm:text-base">
            {totalSongs > 0
              ? `${pluralize(totalSongs, 'canción disponible', 'canciones disponibles')} en el catálogo comunitario.`
              : 'El catálogo está vacío. Sube la primera canción y estrena Sonora.'}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {songs.length > 0 ? (
              <button type="button" onClick={() => playQueue(songs, 0)} className="btn-primary">
                <Play className="size-4 fill-current" aria-hidden="true" />
                Reproducir lo reciente
              </button>
            ) : null}
            <Link to="/search" className="btn-outline">
              Explorar catálogo
            </Link>
            <Link to="/upload" className="btn-ghost">
              <Upload className="size-4" aria-hidden="true" />
              Subir música
            </Link>
          </div>
        </div>
      </section>

      {songs.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="Todavía no hay canciones"
          description="Sube tu primer MP3, FLAC o M4A. Extraemos la carátula y los metadatos automáticamente."
          action={
            <Link to="/upload" className="btn-primary">
              <Upload className="size-4" aria-hidden="true" />
              Subir la primera canción
            </Link>
          }
        />
      ) : (
        <section aria-labelledby="recent-heading">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="recent-heading" className="text-xl font-bold text-white">
              Añadido recientemente
            </h2>
            <Link to="/search" className="text-ink-300 hover:text-accent-soft text-sm">
              Ver todo
            </Link>
          </div>
          <SongList songs={songs} label="Canciones recientes" />
        </section>
      )}

      <section aria-labelledby="playlists-heading">
        <div className="mb-3 flex items-end justify-between">
          <h2 id="playlists-heading" className="text-xl font-bold text-white">
            Tus playlists
          </h2>
          <Link to="/library" className="text-ink-300 hover:text-accent-soft text-sm">
            Gestionar
          </Link>
        </div>

        {playlists.isLoading ? (
          <p className="text-ink-400 text-sm">Cargando playlists…</p>
        ) : playlists.data && playlists.data.data.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {playlists.data.data.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        ) : (
          <div className="card flex items-center justify-between gap-4 px-5 py-4">
            <p className="text-ink-300 text-sm">
              Aún no has creado playlists. Organiza tus canciones favoritas.
            </p>
            <Link to="/library" className="btn-outline shrink-0">
              Crear playlist
            </Link>
          </div>
        )}
      </section>

      <RecentlyPlayed />
    </div>
  )
}
