import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ImageUp,
  ListMusic,
  Loader2,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { PlaylistCover } from '../components/PlaylistCover'
import { SongList } from '../components/SongList'
import { PageLoader } from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import { usePlayer } from '../context/PlayerContext'
import { useToast } from '../context/ToastContext'
import { api, firstError } from '../lib/api'
import { cn, formatDate, formatTotalDuration, pluralize } from '../lib/format'
import type { PlaylistItem, Song } from '../types'

export function PlaylistPage() {
  const { id } = useParams()
  const playlistId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const { playQueue } = usePlayer()

  const [items, setItems] = useState<PlaylistItem[]>([])
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)

  const query = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: () => api.playlist(playlistId),
    enabled: Number.isFinite(playlistId),
  })

  const playlist = query.data

  useEffect(() => {
    if (playlist) {
      setItems(playlist.items ?? [])
    }
  }, [playlist])

  const isOwner = Boolean(user && playlist && playlist.user?.id === user.id)

  const reorder = useMutation({
    mutationFn: (ordered: PlaylistItem[]) =>
      api.reorderPlaylist(
        playlistId,
        ordered.map((item) => item.song?.id).filter((songId): songId is number => songId != null),
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(['playlist', playlistId], updated)
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
    },
    onError: (error) => {
      toast.error(firstError(error))
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] })
    },
  })

  const remove = useMutation({
    mutationFn: (songId: number) => api.removePlaylistItem(playlistId, songId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      toast.success('Canción quitada de la playlist.')
    },
    onError: (error) => toast.error(firstError(error)),
  })

  const update = useMutation({
    mutationFn: () =>
      api.updatePlaylist(playlistId, {
        name: name.trim(),
        description: description.trim() || null,
        is_public: isPublic,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['playlist', playlistId], updated)
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      setEditing(false)
      toast.success('Playlist actualizada.')
    },
    onError: (error) => toast.error(firstError(error)),
  })

  const destroy = useMutation({
    mutationFn: () => api.deletePlaylist(playlistId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      toast.success('Playlist eliminada.')
      navigate('/library', { replace: true })
    },
    onError: (error) => toast.error(firstError(error)),
  })

  const uploadCover = useMutation({
    mutationFn: (file: File) => api.uploadPlaylistCover(playlistId, file),
    onSuccess: (updated) => {
      queryClient.setQueryData(['playlist', playlistId], updated)
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      toast.success('Portada actualizada.')
    },
    onError: (error) => toast.error(firstError(error)),
  })

  const handleCoverSelected = (file: File) => {
    // Comprobación rápida en cliente para no subir 8 MB solo para que el
    // servidor los rechace. El servidor vuelve a validarlo.
    if (file.size > 8 * 1024 * 1024) {
      toast.error('La imagen supera el límite de 8 MB.')
      return
    }

    uploadCover.mutate(file)
  }

  const startEditing = () => {
    if (!playlist) {
      return
    }

    setName(playlist.name)
    setDescription(playlist.description ?? '')
    setIsPublic(playlist.is_public)
    setEditing(true)
  }

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!name.trim()) {
      toast.error('La playlist necesita un nombre.')
      return
    }

    update.mutate()
  }

  const handleDelete = () => {
    if (window.confirm('¿Eliminar esta playlist? Esta acción no se puede deshacer.')) {
      destroy.mutate()
    }
  }

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) {
      return
    }

    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setItems(next)
    reorder.mutate(next)
  }

  if (query.isLoading) {
    return <PageLoader label="Cargando playlist" />
  }

  if (query.isError || !playlist) {
    return (
      <EmptyState
        icon={ListMusic}
        title="Playlist no disponible"
        description={firstError(query.error)}
        action={
          <Link to="/library" className="btn-primary">
            Volver a la biblioteca
          </Link>
        }
      />
    )
  }

  const songs: Song[] = items
    .map((item) => item.song)
    .filter((song): song is Song => song != null)

  return (
    <div className="space-y-8">
      <Link to="/library" className="text-ink-300 hover:text-ink-100 inline-flex items-center gap-2 text-sm">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Biblioteca
      </Link>

      <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="relative shrink-0">
          <PlaylistCover
            playlist={playlist}
            className="size-40 shadow-2xl sm:size-48"
            rounded="rounded-2xl"
          />

          {isOwner ? (
            <>
              <label
                htmlFor="playlist-cover-input"
                className="bg-ink-950/70 absolute right-2 bottom-2 flex size-9 cursor-pointer items-center justify-center rounded-full text-white backdrop-blur transition-colors hover:bg-ink-950"
                title="Cambiar portada"
              >
                {uploadCover.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ImageUp className="size-4" aria-hidden="true" />
                )}
                <span className="sr-only">Cambiar la portada de la playlist</span>
              </label>

              <input
                id="playlist-cover-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                disabled={uploadCover.isPending}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]

                  if (file) {
                    handleCoverSelected(file)
                  }

                  // Permite volver a elegir el mismo archivo.
                  event.target.value = ''
                }}
              />
            </>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-accent-soft text-xs font-semibold tracking-wider uppercase">
            Playlist {playlist.is_public ? '· pública' : '· privada'}
          </p>

          {editing ? (
            <form onSubmit={handleUpdate} className="mt-3 space-y-3">
              <div>
                <label htmlFor="playlist-name" className="label">
                  Nombre
                </label>
                <input
                  id="playlist-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="field"
                  maxLength={120}
                  required
                />
              </div>
              <div>
                <label htmlFor="playlist-description" className="label">
                  Descripción
                </label>
                <textarea
                  id="playlist-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="field min-h-20 resize-y"
                  maxLength={2000}
                />
              </div>
              <label className="text-ink-200 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                  className="accent-accent size-4"
                />
                Playlist pública
              </label>

              <div className="flex gap-2">
                <button type="submit" disabled={update.isPending} className="btn-primary">
                  {update.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                  Guardar
                </button>
                <button type="button" onClick={() => setEditing(false)} className="btn-ghost">
                  <X className="size-4" aria-hidden="true" />
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                {playlist.name}
              </h1>
              {playlist.description ? (
                <p className="text-ink-200 mt-3 max-w-2xl text-sm">{playlist.description}</p>
              ) : null}
              <p className="text-ink-300 mt-3 text-sm">
                {playlist.user ? `${playlist.user.name} · ` : ''}
                {pluralize(playlist.songs_count, 'canción', 'canciones')}
                {playlist.duration_ms > 0 ? ` · ${formatTotalDuration(playlist.duration_ms)}` : ''}
                {playlist.updated_at ? ` · actualizada el ${formatDate(playlist.updated_at)}` : ''}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => playQueue(songs, 0)}
                  disabled={songs.length === 0}
                  className="btn-primary"
                >
                  <Play className="size-4 fill-current" aria-hidden="true" />
                  Reproducir
                </button>

                <Link to="/search" className="btn-outline">
                  <Plus className="size-4" aria-hidden="true" />
                  Añadir canciones
                </Link>

                {isOwner ? (
                  <>
                    <button type="button" onClick={startEditing} className="btn-ghost">
                      <Pencil className="size-4" aria-hidden="true" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={destroy.isPending}
                      className="btn-ghost text-red-300 hover:bg-red-500/10 hover:text-red-200"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Eliminar
                    </button>
                  </>
                ) : null}
              </div>
            </>
          )}
        </div>
      </header>

      {songs.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="Esta playlist está vacía"
          description="Busca canciones en el catálogo y añádelas con el botón de la lista."
          action={
            <Link to="/search" className="btn-primary">
              <Plus className="size-4" aria-hidden="true" />
              Buscar canciones
            </Link>
          }
        />
      ) : (
        <section aria-labelledby="tracks-heading">
          <h2 id="tracks-heading" className="sr-only">
            Canciones de la playlist
          </h2>

          {isOwner ? (
            <p className="text-ink-400 mb-2 px-2 text-xs">
              Arrastra las filas o usa las flechas para reordenar.
            </p>
          ) : null}

          <SongList
            songs={songs}
            label={`Canciones de ${playlist.name}`}
            rowProps={(_song, index) =>
              isOwner
                ? {
                    draggable: true,
                    onDragStart: () => setDragging(index),
                    onDragOver: (event) => event.preventDefault(),
                    onDrop: () => {
                      if (dragging !== null) {
                        move(dragging, index)
                      }

                      setDragging(null)
                    },
                    onDragEnd: () => setDragging(null),
                    className: cn(dragging === index && 'opacity-50'),
                  }
                : {}
            }
            extraActions={(song, index) =>
              isOwner ? (
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0 || reorder.isPending}
                    className="icon-btn"
                    aria-label={`Mover ${song.title} hacia arriba`}
                  >
                    <ChevronUp className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === songs.length - 1 || reorder.isPending}
                    className="icon-btn"
                    aria-label={`Mover ${song.title} hacia abajo`}
                  >
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(song.id)}
                    disabled={remove.isPending}
                    className="icon-btn hover:text-red-300"
                    aria-label={`Quitar ${song.title} de la playlist`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ) : null
            }
          />
        </section>
      )}
    </div>
  )
}
