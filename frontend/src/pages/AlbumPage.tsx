import { ArrowLeft, Disc3, Play } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Cover } from '../components/Cover'
import { EmptyState } from '../components/EmptyState'
import { SongList } from '../components/SongList'
import { PageLoader } from '../components/Spinner'
import { usePlayer } from '../context/PlayerContext'
import { api, firstError } from '../lib/api'
import { formatTotalDuration, pluralize } from '../lib/format'

export function AlbumPage() {
  const { id } = useParams()
  const albumId = Number(id)
  const navigate = useNavigate()
  const { playQueue } = usePlayer()

  const query = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => api.album(albumId),
    enabled: Number.isFinite(albumId),
  })

  const album = query.data

  if (query.isLoading) {
    return <PageLoader label="Cargando álbum" />
  }

  if (query.isError || !album) {
    return (
      <EmptyState
        icon={Disc3}
        title="Álbum no encontrado"
        description={firstError(query.error)}
        action={
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            Volver
          </button>
        }
      />
    )
  }

  const songs = album.songs ?? []
  const totalMs = songs.reduce((acc, song) => acc + (song.duration_ms || 0), 0)

  return (
    <div className="space-y-8">
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
          src={album.cover_url}
          alt={`Portada de ${album.title}`}
          className="size-40 flex-none shadow-2xl sm:size-48"
          rounded="rounded-2xl"
          iconClassName="size-16"
        />

        <div className="min-w-0 flex-1 space-y-3">
          <span className="badge badge-accent">Álbum</span>
          <h1 className="truncate text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {album.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-300">
            {album.artist ? (
              <Link
                to={`/artists/${album.artist.id}`}
                className="font-semibold text-white hover:text-accent-soft hover:underline"
              >
                {album.artist.name}
              </Link>
            ) : (
              <span>Artista desconocido</span>
            )}
            {album.year && (
              <>
                <span>·</span>
                <span>{album.year}</span>
              </>
            )}
            <span>·</span>
            <span>{pluralize(songs.length, 'canción', 'canciones')}</span>
            {totalMs > 0 && (
              <>
                <span>·</span>
                <span>{formatTotalDuration(totalMs)}</span>
              </>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => playQueue(songs, 0)}
              disabled={songs.length === 0}
              className="btn-primary gap-2"
            >
              <Play className="size-5 fill-current" aria-hidden="true" />
              <span>Reproducir álbum</span>
            </button>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">Canciones</h2>
        {songs.length === 0 ? (
          <EmptyState
            icon={Disc3}
            title="Este álbum aún no tiene canciones"
            description="Las canciones añadidas con este álbum aparecerán aquí."
          />
        ) : (
          <SongList songs={songs} showAlbum={false} />
        )}
      </section>
    </div>
  )
}
