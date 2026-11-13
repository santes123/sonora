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
import { listDownloads, touchDownload } from '../offline/db'
import {
  deleteAllDownloads,
  deleteDownload,
  downloadSongs,
  OfflineError,
} from '../offline/downloader'
import {
  calculateBudget,
  estimateStorage,
  isPersistentStorageGranted,
  requestPersistentStorage,
  type OfflineBudget,
} from '../offline/quota'
import { isOfflineSupported } from '../offline/sw-bridge'
import type { DownloadSummary } from '../offline/types'
import type { Song } from '../types'

export type { DownloadSummary }

/**
 * Estado global de la functionality offline.
 *
 * Concentra tres cosas que de otro modo se repetirían en cada pantalla:
 * si hay conexión, qué hay descargado y cuánto espacio queda.
 */

export interface OfflineContextValue {
  /** ¿El navegador tiene conexión? */
  isOnline: boolean
  /** Descargas registradas en el dispositivo. */
  downloads: DownloadSummary[]
  /** Presupuesto de almacenamiento offline. */
  budget: OfflineBudget
  /** El navegador ha concedido almacenamiento persistente. */
  persisted: boolean
  /** Canciones que se están descargando ahora mismo. */
  downloading: number[]
  /** Progreso de la descarga en curso (0-100). */
  progress: number
  /** ¿La descarga offline está disponible en este navegador? */
  supported: boolean
  isDownloaded: (songId: number) => boolean
  downloadSong: (song: Song) => Promise<void>
  downloadPlaylist: (songs: Song[], playlistId: number) => Promise<void>
  removeSong: (songId: number) => Promise<void>
  removeAll: () => Promise<void>
  /** Marca una canción como usada (alimenta el LRU). */
  markAccessed: (songId: number) => void
  /** Refresca las descargas y el presupuesto. */
  refresh: () => Promise<void>
}

const OfflineContext = createContext<OfflineContextValue | null>(null)

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [downloads, setDownloads] = useState<DownloadSummary[]>([])
  const [budget, setBudget] = useState<OfflineBudget>({ limit: 0, used: 0, available: 0 })
  const [persisted, setPersisted] = useState(false)
  const [downloading, setDownloading] = useState<number[]>([])
  const [progress, setProgress] = useState(0)
  const [supported, setSupported] = useState(false)

  // El aviso de almacenamiento persistente se muestra una sola vez: la
  // decisión se recuerda en memoria durante toda la sesión.
  const persistenceAsked = useRef(false)
  const [persistNotice, setPersistNotice] = useState<((allow: boolean) => void) | null>(null)

  const refresh = useCallback(async () => {
    const records = await listDownloads()
    const used = records.reduce((total, record) => total + record.bytes, 0)

    setDownloads(
      records.map((record) => ({
        songId: record.songId,
        title: record.title,
        artistName: record.artistName,
        albumTitle: record.albumTitle,
        durationMs: record.durationMs,
        coverUrl: record.coverUrl,
        cacheKey: record.cacheKey,
        coverCacheKey: record.coverCacheKey,
        bytes: record.bytes,
        cachedAt: record.cachedAt,
        lastAccessedAt: record.lastAccessedAt,
        playlistIds: record.playlistIds,
      })),
    )

    setBudget(calculateBudget(await estimateStorage(), used))
  }, [])

  useEffect(() => {
    void refresh()
    void isPersistentStorageGranted().then(setPersisted)
    void isOfflineSupported().then(setSupported)
  }, [refresh])

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  /**
   * Pide al navegador almacenamiento persistente la primera vez.
   *
   * Sin persistencia el navegador puede borrar las descargas cuando le
   * parezca. Se pregunta con aviso previo: el usuario tiene que entender
   * qué se le pide y por qué.
   */
  const ensurePersistence = useCallback(async (): Promise<boolean> => {
    if (persistenceAsked.current) {
      return true
    }

    persistenceAsked.current = true

    const answer = await new Promise<boolean>((resolve) => {
      setPersistNotice(() => resolve)
    })

    setPersistNotice(null)

    if (!answer) {
      // El usuario ha rechazado: se descarga igualmente, pero avisando de
      // que el navegador puede borrar lo descargado.
      return false
    }

    const granted = await requestPersistentStorage()

    setPersisted(granted)

    return granted
  }, [])

  const runDownload = useCallback(
    async (songs: Song[], playlistId?: number) => {
      if (songs.length === 0) {
        return
      }

      const ids = songs.map((song) => song.id)

      setDownloading(ids)
      setProgress(0)

      try {
        await ensurePersistence()

        const outcome = await downloadSongs(songs, {
          playlistId,
          onProgress: ({ completed, total }) => {
            setProgress(total > 0 ? Math.round((completed / total) * 100) : 0)
          },
        })

        await refresh()

        return outcome
      } finally {
        setDownloading([])
        setProgress(0)
      }
    },
    [ensurePersistence, refresh],
  )

  const downloadSong = useCallback(
    async (song: Song) => {
      await runDownload([song])
    },
    [runDownload],
  )

  const downloadPlaylist = useCallback(
    async (songs: Song[], playlistId: number) => {
      await runDownload(songs, playlistId)
    },
    [runDownload],
  )

  const removeSong = useCallback(
    async (songId: number) => {
      await deleteDownload(songId)
      await refresh()
    },
    [refresh],
  )

  const removeAll = useCallback(async () => {
    await deleteAllDownloads()
    await refresh()
  }, [refresh])

  const markAccessed = useCallback((songId: number) => {
    void touchDownload(songId)
  }, [])

  const isDownloaded = useCallback(
    (songId: number) => downloads.some((download) => download.songId === songId),
    [downloads],
  )

  const value = useMemo<OfflineContextValue>(
    () => ({
      isOnline,
      downloads,
      budget,
      persisted,
      downloading,
      progress,
      supported,
      isDownloaded,
      downloadSong,
      downloadPlaylist,
      removeSong,
      removeAll,
      markAccessed,
      refresh,
    }),
    [
      isOnline,
      downloads,
      budget,
      persisted,
      downloading,
      progress,
      supported,
      isDownloaded,
      downloadSong,
      downloadPlaylist,
      removeSong,
      removeAll,
      markAccessed,
      refresh,
    ],
  )

  return (
    <OfflineContext.Provider value={value}>
      {children}
      {persistNotice ? (
        <PersistenceNotice onAnswer={(allow) => persistNotice(allow)} />
      ) : null}
    </OfflineContext.Provider>
  )
}

/**
 * Aviso que pide permiso de almacenamiento persistente.
 *
 * Se explica en lenguaje llano: el navegador puede borrar lo descargado si
 * necesita espacio, y con almacenamiento persistente no lo hace.
 */
function PersistenceNotice({ onAnswer }: { onAnswer: (allow: boolean) => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="persist-title"
    >
      <div className="bg-ink-900 border-ink-700 w-full max-w-md rounded-2xl border p-6 shadow-2xl">
        <h2 id="persist-title" className="text-lg font-bold text-white">
          Conservar tus descargas
        </h2>

        <p className="text-ink-200 mt-2 text-sm">
          Si el navegador necesita espacio, puede borrar lo que has descargado. Si permites el
          almacenamiento persistente, lo conservará hasta que lo borres tú.
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => onAnswer(false)} className="btn-ghost">
            Ahora no
          </button>
          <button type="button" onClick={() => onAnswer(true)} className="btn-primary">
            Permitir
          </button>
        </div>
      </div>
    </div>
  )
}

export function useOffline(): OfflineContextValue {
  const context = useContext(OfflineContext)

  if (!context) {
    throw new Error('useOffline debe usarse dentro de OfflineProvider')
  }

  return context
}

export { OfflineError }
