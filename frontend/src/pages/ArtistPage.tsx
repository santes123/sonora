import { ArrowLeft, Disc3, Mic2, Play } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Cover } from '../components/Cover'
import { EmptyState } from '../components/EmptyState'
import { SongList } from '../components/SongList'
import { PageLoader } from '../components/Spinner'
import { usePlayer } from '../context/PlayerContext'
import { api, firstError } from '../lib/api'
import { pluralize } from '../lib/format'

export function ArtistPage() {
  const { id } = useParams()
  const artistId = Number(id)
  const navigate = useNavigate()
  const { playQueue } = usePlayer()

  const query = useQuery({
    queryKey: ['artist', artistId],
    queryFn: () => api.artist(artistId),
    enabled: Number.isFinite(artistId),
  })

  const artist = query.data

  if (query.isLoading) {
    return <PageLoader label="Cargando artista" />
  }

  if (query.isError || !artist) {
    return (
      <EmptyState
        icon={Mic2}
        title="Artista no encontrado"
        description={firstError(query.error)}
        action={
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            Volver
          </button>
        }
      />
    )
  }

  const songs = artist.songs ?? []
  const albums = artist.albums ?? []

  return (
    <div className="space-y-10">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="icon-btn -ml-2 gap-2 text-sm text-ink-300 hover:text-white"
        aria-label="Volver atrás"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        <span>Volver</span>
      </button>

      <header className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:p-8">
        <Cover
          src={artist.image_url}
          alt={`Foto de ${artist.name}`}
          className="size-36 flex-none shadow-2xl sm:size-44"
          rounded="rounded-full"
          iconClassName="size-16"
        />

        <div className="min-w-0 flex-1 space-y-3">
          <span className="badge badge-accent">Artista</span>
          <h1 className="truncate text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {artist.name}
          </h1>

          {artist.bio && (
            <p className="max-w-2xl text-sm leading-relaxed text-ink-300 line-clamp-3">
              {artist.bio}
            </p>
          )}

          <div className="flex items-center gap-2 text-sm text-ink-300">
            <span>{pluralize(artist.songs_count ?? songs.length, 'canción', 'canciones')}</span>
            <span>·</span>
            <span>{pluralize(artist.albums_count ?? albums.length, 'álbum', 'álbumes')}</span>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => playQueue(songs, 0)}
              disabled={songs.length === 0}
              className="btn-primary gap-2"
            >
              <Play className="size-5 fill-current" aria-hidden="true" />
              <span>Reproducir artista</span>
            </button>
          </div>
        </div>
      </header>

      {albums.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">Discografía</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {albums.map((album) => (
              <Link
                key={album.id}
                to={`/albums/${album.id}`}
                className="card group flex flex-col p-4 transition-transform hover:-translate-y-1 hover:shadow-lg"
              >
                <Cover
                  src={album.cover_url}
                  alt={`Portada de ${album.title}`}
                  className="aspect-square w-full shadow-md"
                  rounded="rounded-xl"
                  iconClassName="size-10"
                />
                <h3 className="mt-3 truncate text-sm font-semibold text-white group-hover:text-accent-soft">
                  {album.title}
                </h3>
                <p className="text-xs text-ink-400">
                  {album.year ?? 'Álbum'}
                  {album.songs_count != null && ` · ${album.songs_count} pistas`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">Canciones populares</h2>
        {songs.length === 0 ? (
          <EmptyState
            icon={Disc3}
            title="Sin canciones registradas"
            description="Este artista aún no tiene canciones cargadas en el catálogo."
          />
        ) : (
          <SongList songs={songs} showAlbum />
        )}
      </section>
    </div>
  )
}
