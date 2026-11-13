import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ListPlus, Loader2, Plus } from 'lucide-react'
import { api, firstError } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { cn } from '../lib/format'
import type { Song } from '../types'

export function AddToPlaylistMenu({ song }: { song: Song }) {
  const [open, setOpen] = useState(false)
  const [addedTo, setAddedTo] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['playlists', 'mine'],
    queryFn: () => api.playlists(true),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (playlistId: number) => api.addPlaylistItem(playlistId, song.id),
    onSuccess: (_playlist, playlistId) => {
      setAddedTo(playlistId)
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      toast.success('Canción añadida a la playlist.')
      window.setTimeout(() => setOpen(false), 300)
    },
    onError: (error) => toast.error(firstError(error)),
  })

  useEffect(() => {
    if (!open) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setAddedTo(null)
          setOpen((value) => !value)
        }}
        className="icon-btn"
        aria-label={`Añadir ${song.title} a una playlist`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ListPlus className="size-4" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Añadir a playlist"
          className="border-ink-600 bg-ink-850 absolute right-0 bottom-full z-50 mb-2 w-64 rounded-xl border p-2 shadow-2xl"
        >
          <p className="text-ink-300 px-2 pt-1 pb-2 text-xs font-semibold tracking-wide uppercase">
            Añadir a playlist
          </p>

          {isLoading ? (
            <div className="text-ink-300 flex items-center gap-2 px-2 py-3 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Cargando…
            </div>
          ) : null}

          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {data?.data.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                role="menuitem"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(playlist.id)}
                className={cn(
                  'text-ink-200 hover:bg-ink-700 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors',
                  mutation.isPending && 'opacity-60',
                )}
              >
                {addedTo === playlist.id ? (
                  <Check className="text-accent-soft size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <span className="bg-ink-700 flex size-4 shrink-0 items-center justify-center rounded-sm">
                    <span className="bg-accent size-1.5 rounded-full" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{playlist.name}</span>
                <span className="text-ink-400 text-xs">{playlist.songs_count}</span>
              </button>
            ))}
          </div>

          {!isLoading && data?.data.length === 0 ? (
            <p className="text-ink-300 px-2 py-2 text-sm">Todavía no tienes playlists.</p>
          ) : null}

          <Link
            to="/library"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="text-accent-soft hover:bg-ink-700 border-ink-700 mt-1 flex items-center gap-2 rounded-lg border-t px-2 py-2 text-sm"
          >
            <Plus className="size-4" aria-hidden="true" />
            Crear o gestionar playlists
          </Link>
        </div>
      ) : null}
    </div>
  )
}
