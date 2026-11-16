import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, MoreVertical, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { api, firstError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { SongEditDialog } from './SongEditDialog'
import { cn } from '../lib/format'
import type { Song } from '../types'

interface SongActionsProps {
  song: Song
  /** Callback tras borrar la canción (por ejemplo, refrescar la lista). */
  onDeleted?: () => void
}

/**
 * Menú de acciones de una canción: editar metadatos y carátula, o eliminarla.
 *
 * Solo aparece para quien subió la canción o para un administrador, que es
 * exactamente lo que comprueba la Policy del backend.
 */
export function SongActions({ song, onDeleted }: SongActionsProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const toast = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const isAdmin = user?.role === 'admin'
  const canManage = Boolean(user && (isAdmin || song.uploader?.id === user.id))
  const unavailable = song.is_deleted

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['songs'] })
    queryClient.invalidateQueries({ queryKey: ['playlists'] })
    queryClient.invalidateQueries({ queryKey: ['home'] })
    queryClient.invalidateQueries({ queryKey: ['history'] })
    queryClient.invalidateQueries({ queryKey: ['favorites'] })
  }

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

  const remove = useMutation({
    mutationFn: () => api.deleteSong(song.id),
    onSuccess: () => {
      invalidate()
      toast.success('Canción eliminada.')
      setOpen(false)
      onDeleted?.()
    },
    onError: (error) => toast.error(firstError(error)),
  })

  const restore = useMutation({
    mutationFn: () => api.restoreSong(song.id),
    onSuccess: () => {
      invalidate()
      toast.success('Canción restaurada.')
      setOpen(false)
    },
    onError: (error) => toast.error(firstError(error)),
  })

  // Una canción eliminada solo la restaura el administrador.
  if (!canManage && !(unavailable && isAdmin)) {
    return null
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setConfirmingDelete(false)
            setOpen((value) => !value)
          }}
          className="icon-btn"
          aria-label={`Acciones de ${song.title}`}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <MoreVertical className="size-4" aria-hidden="true" />
        </button>

        {open ? (
          <div
            role="menu"
            aria-label={`Acciones de ${song.title}`}
            className="border-ink-600 bg-ink-850 absolute right-0 bottom-full z-50 mb-2 w-56 rounded-xl border p-1.5 shadow-2xl"
          >
            {unavailable ? (
              // Una canción eliminada solo se puede restaurar (y solo el
              // administrador): el resto de acciones no aplican.
              <button
                type="button"
                role="menuitem"
                onClick={() => restore.mutate()}
                disabled={restore.isPending}
                className="text-ink-200 hover:bg-ink-700 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors disabled:opacity-50"
              >
                {restore.isPending ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
                )}
                Restaurar
              </button>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    setEditing(true)
                  }}
                  className="text-ink-200 hover:bg-ink-700 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors"
                >
                  <Pencil className="size-4 shrink-0" aria-hidden="true" />
                  Editar
                </button>

                {confirmingDelete ? (
                  <div className="rounded-lg px-2 py-2">
                    <p className="text-ink-200 text-xs font-medium">
                      ¿Eliminar «{song.title}»? No se puede deshacer.
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => remove.mutate()}
                        disabled={remove.isPending}
                        className="text-red-300 hover:text-red-200 inline-flex items-center gap-1 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {remove.isPending ? (
                          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                        ) : null}
                        Sí, eliminar
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(false)}
                        className="text-ink-400 hover:text-ink-100 text-xs transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setConfirmingDelete(true)}
                    className={cn(
                      'text-ink-200 hover:bg-ink-700 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors',
                    )}
                  >
                    <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                    Eliminar
                  </button>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>

      {editing ? <SongEditDialog song={song} onClose={() => setEditing(false)} /> : null}
    </>
  )
}
