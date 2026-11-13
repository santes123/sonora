import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, ListMusic, Loader2, Play, Plus } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { PlaylistCard } from '../components/PlaylistCard'
import { SongList } from '../components/SongList'
import { PageLoader } from '../components/Spinner'
import { usePlayer } from '../context/PlayerContext'
import { useToast } from '../context/ToastContext'
import { api, firstError } from '../lib/api'
import { cn, pluralize } from '../lib/format'

type Tab = 'favorites' | 'mine' | 'all'

export function LibraryPage() {
  const [tab, setTab] = useState<Tab>('favorites')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { playQueue } = usePlayer()

  const favorites = useQuery({
    queryKey: ['me', 'favorites'],
    queryFn: () => api.favorites(100),
    enabled: tab === 'favorites',
  })

  const mine = useQuery({
    queryKey: ['playlists', 'mine'],
    queryFn: () => api.playlists(true, 100),
  })

  const all = useQuery({
    queryKey: ['playlists', 'all'],
    queryFn: () => api.playlists(false, 100),
    enabled: tab === 'all',
  })

  const createMutation = useMutation({
    mutationFn: () =>
      api.createPlaylist({
        name: name.trim(),
        description: description.trim() || undefined,
        is_public: isPublic,
      }),
    onSuccess: (playlist) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      toast.success('Playlist creada.')
      setName('')
      setDescription('')
      setIsPublic(false)
      setCreating(false)
      navigate(`/playlists/${playlist.id}`)
    },
    onError: (error) => toast.error(firstError(error)),
  })

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!name.trim()) {
      toast.error('Ponle un nombre a la playlist.')
      return
    }

    createMutation.mutate()
  }

  const active = tab === 'mine' ? mine : all
  const playlists = active.data?.data ?? []
  const favoriteSongs = favorites.data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Biblioteca</h1>
          <p className="text-ink-300 mt-1 text-sm">
            {tab === 'favorites'
              ? `${pluralize(favorites.data?.meta.total ?? 0, 'canción que te gusta', 'canciones que te gustan')}.`
              : tab === 'mine'
                ? `${pluralize(mine.data?.meta.total ?? 0, 'playlist propia', 'playlists propias')}.`
                : `${pluralize(all.data?.meta.total ?? 0, 'playlist pública', 'playlists públicas')}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tab === 'favorites' && favoriteSongs.length > 0 ? (
            <button
              type="button"
              onClick={() => playQueue(favoriteSongs, 0)}
              className="btn-outline"
            >
              <Play className="size-4 fill-current" aria-hidden="true" />
              Reproducir
            </button>
          ) : null}

          <button type="button" onClick={() => setCreating((value) => !value)} className="btn-primary">
            <Plus className="size-4" aria-hidden="true" />
            Nueva playlist
          </button>
        </div>
      </div>

      {creating ? (
        <form onSubmit={handleCreate} className="card space-y-4 p-5">
          <h2 className="font-semibold text-white">Crear playlist</h2>

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
              placeholder="Mis favoritas de los 2000"
            />
          </div>

          <div>
            <label htmlFor="playlist-description" className="label">
              Descripción <span className="text-ink-400 font-normal">(opcional)</span>
            </label>
            <textarea
              id="playlist-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="field min-h-20 resize-y"
              maxLength={2000}
              placeholder="¿Qué tiene de especial esta playlist?"
            />
          </div>

          <label className="text-ink-200 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
              className="accent-accent size-4"
            />
            Hacerla pública (visible para toda la comunidad)
          </label>

          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Crear
            </button>
            <button type="button" onClick={() => setCreating(false)} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div
        role="tablist"
        aria-label="Filtrar la biblioteca"
        className="bg-ink-850 border-ink-700 inline-flex rounded-full border p-1"
      >
        {(
          [
            { id: 'favorites', label: 'Canciones que te gustan' },
            { id: 'mine', label: 'Mis playlists' },
            { id: 'all', label: 'Comunidad' },
          ] as { id: Tab; label: string }[]
        ).map((option) => (
          <button
            key={option.id}
            role="tab"
            type="button"
            aria-selected={tab === option.id}
            onClick={() => setTab(option.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              tab === option.id ? 'bg-accent text-white' : 'text-ink-300 hover:text-white',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'favorites' ? (
        favorites.isLoading ? (
          <PageLoader label="Cargando tus favoritas" />
        ) : favoriteSongs.length > 0 ? (
          <SongList songs={favoriteSongs} label="Canciones que te gustan" />
        ) : (
          <EmptyState
            icon={Heart}
            title="Todavía no te gusta ninguna canción"
            description="Pulsa el corazón en cualquier canción del catálogo y aparecerá aquí."
          />
        )
      ) : active.isLoading ? (
        <PageLoader label="Cargando playlists" />
      ) : playlists.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {playlists.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ListMusic}
          title={tab === 'mine' ? 'Aún no tienes playlists' : 'La comunidad no ha publicado playlists'}
          description={
            tab === 'mine'
              ? 'Crea una playlist y ve añadiendo canciones desde el catálogo.'
              : 'Cuando alguien comparta una playlist pública aparecerá aquí.'
          }
          action={
            tab === 'mine' ? (
              <button type="button" onClick={() => setCreating(true)} className="btn-primary">
                <Plus className="size-4" aria-hidden="true" />
                Crear mi primera playlist
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
