import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, firstError } from '../lib/api'
import {
  applyIntent,
  createIntentTracker,
  resolveLiked,
  revertIntent,
  type LikeOverrides,
} from '../lib/likes'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import type { Song } from '../types'

interface LikesContextValue {
  /**
   * Estado efectivo de "me gusta" de una canción, combinando el `is_liked`
   * que viaja en el payload con las decisiones que el usuario acaba de tomar.
   */
  isLiked: (song: Song) => boolean
  /** Alterna el "me gusta" de forma optimista. */
  toggleLike: (song: Song) => void
  /** `true` mientras hay una mutación en vuelo para esa canción. */
  isPending: (songId: number) => boolean
}

const LikesContext = createContext<LikesContextValue | null>(null)

interface LikeMutation {
  songId: number
  /** Estado objetivo pedido por el usuario. */
  liked: boolean
  /** Estado anterior, para poder revertir si la mutación falla. */
  previous: boolean
}

/**
 * Store de "me gusta".
 *
 * Cada payload de la API trae su propio `is_liked`, que es una foto del
 * servidor en el momento de la petición. La misma canción puede aparecer a la
 * vez en una fila, en el reproductor y en la biblioteca, y cada una con su
 * propia foto: si solo se usara el payload, el corazón parpadearía entre
 * "me gusta" y "no me gusta" según dónde se mire.
 *
 * Aquí se mantiene un mapa de *decisiones del usuario* que tiene prioridad
 * sobre el payload. Se aplica de forma optimista (el corazón responde al
 * instante) y el servidor sigue siendo la fuente de verdad: si la mutación
 * falla, la decisión se revierte.
 *
 * Las decisiones viven solo en memoria. Al recargar la página, el payload
 * refrescado del servidor manda de nuevo.
 */
export function LikesProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<LikeOverrides>({})
  const [pendingIds, setPendingIds] = useState<number[]>([])
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()

  // Intención vigente por canción. Permite ignorar el resultado de una
  // mutación antigua cuando el usuario ya ha pedido lo contrario.
  const intentRef = useRef(createIntentTracker())

  // Al cambiar de usuario (login, logout o cambio de cuenta) el estado de
  // "me gusta" deja de tener sentido: se descarta.
  useEffect(() => {
    intentRef.current.clear()
    setOverrides({})
    setPendingIds([])
  }, [user?.id])

  const mutation = useMutation({
    mutationFn: ({ songId, liked }: LikeMutation) =>
      liked ? api.likeSong(songId) : api.unlikeSong(songId),

    onMutate: ({ songId, liked }) => {
      intentRef.current.set(songId, liked)
      setOverrides((current) => applyIntent(current, songId, liked))
      setPendingIds((current) => (current.includes(songId) ? current : [...current, songId]))
    },

    onSuccess: (updated, { songId, liked }) => {
      // Solo se aplica si esta mutación sigue siendo la intención vigente:
      // si el usuario ya pidió lo contrario, manda la petición más reciente.
      if (!intentRef.current.isCurrent(songId, liked)) {
        return
      }

      // El servidor confirma el estado; se usa su respuesta como verdad.
      setOverrides((current) => applyIntent(current, songId, updated.is_liked))

      // Las listas montadas se refrescan para que `is_liked` viaje ya
      // calculado en el payload. Solo se refetchea lo que está en pantalla.
      void queryClient.invalidateQueries({ queryKey: ['songs'] })
      void queryClient.invalidateQueries({ queryKey: ['album'] })
      void queryClient.invalidateQueries({ queryKey: ['artist'] })
      void queryClient.invalidateQueries({ queryKey: ['playlist'] })
      void queryClient.invalidateQueries({ queryKey: ['me', 'favorites'] })
    },

    onError: (error, { songId, liked, previous }) => {
      // Revierte la decisión optimista solo si no hay una más reciente.
      if (intentRef.current.isCurrent(songId, liked)) {
        intentRef.current.set(songId, previous)
        setOverrides((current) => revertIntent(current, songId, previous))
      }

      toast.error(firstError(error))
    },

    onSettled: (_result, _error, { songId }) => {
      setPendingIds((current) => current.filter((id) => id !== songId))
    },
  })

  const isLiked = useCallback((song: Song) => resolveLiked(song, overrides), [overrides])

  const toggleLike = useCallback(
    (song: Song) => {
      const previous = resolveLiked(song, overrides)

      mutation.mutate({ songId: song.id, liked: !previous, previous })
    },
    [mutation, overrides],
  )

  const isPending = useCallback((songId: number) => pendingIds.includes(songId), [pendingIds])

  const value = useMemo<LikesContextValue>(
    () => ({ isLiked, toggleLike, isPending }),
    [isLiked, toggleLike, isPending],
  )

  return <LikesContext.Provider value={value}>{children}</LikesContext.Provider>
}

export function useLikes(): LikesContextValue {
  const context = useContext(LikesContext)

  if (!context) {
    throw new Error('useLikes debe usarse dentro de LikesProvider')
  }

  return context
}
