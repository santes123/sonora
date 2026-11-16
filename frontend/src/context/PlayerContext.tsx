import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useOffline } from './OfflineContext'
import { useToast } from './ToastContext'
import type { Song } from '../types'

export type RepeatMode = 'off' | 'all' | 'one'

interface PlayerContextValue {
  queue: Song[]
  current: Song | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  playQueue: (songs: Song[], startIndex?: number) => void
  playSong: (song: Song) => void
  togglePlay: () => void
  next: () => void
  previous: () => void
  seek: (seconds: number) => void
  setVolume: (value: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  addToQueue: (song: Song) => void
  clearQueue: () => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

const VOLUME_KEY = 'sonora:volume'

function fisherYates(values: number[]): number[] {
  const result = [...values]

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

function initialVolume(): number {
  const stored = window.localStorage.getItem(VOLUME_KEY)

  if (stored === null) {
    return 0.8
  }

  const parsed = Number(stored)

  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.8
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [queue, setQueue] = useState<Song[]>([])
  const [order, setOrder] = useState<number[]>([])
  const [cursor, setCursor] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(initialVolume)
  const [muted, setMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')

  // Pista ya registrada en el historial. Evita contar dos veces la misma
  // canción cuando el usuario pausa y reanuda.
  const recordedSongRef = useRef<number | null>(null)
  const queryClient = useQueryClient()
  const { isOnline, isDownloaded, markAccessed } = useOffline()
  const toast = useToast()

  const current = useMemo<Song | null>(() => {
    const queueIndex = order[cursor]

    return queueIndex !== undefined ? (queue[queueIndex] ?? null) : null
  }, [queue, order, cursor])

  const playQueue = useCallback(
    (songs: Song[], startIndex = 0) => {
      // Las canciones eliminadas no se reproducen: se quedan en la lista
      // (para que se vea que existen) pero el reproductor las salta.
      const playable = songs.filter((song) => !song.is_deleted)

      if (playable.length === 0) {
        toast.info('No hay canciones disponibles para reproducir.')

        return
      }

      const requested = songs[startIndex]
      const start =
        requested && !requested.is_deleted ? playable.indexOf(requested) : 0

      const indexes = playable.map((_, index) => index)

      setQueue(playable)

      if (shuffle) {
        const rest = indexes.filter((index) => index !== start)
        setOrder([start, ...fisherYates(rest)])
        setCursor(0)
      } else {
        setOrder(indexes)
        setCursor(start)
      }

      setIsPlaying(true)
    },
    [shuffle, toast],
  )

  const playSong = useCallback(
    (song: Song) => {
      if (song.is_deleted) {
        toast.info(`«${song.title}» ya no está disponible.`)

        return
      }

      if (current?.id === song.id) {
        setIsPlaying((playing) => !playing)

        return
      }

      playQueue([song])
    },
    [current, playQueue, toast],
  )

  const togglePlay = useCallback(() => {
    if (!current) {
      return
    }

    setIsPlaying((playing) => !playing)
  }, [current])

  const next = useCallback(() => {
    if (order.length === 0) {
      return
    }

    if (cursor + 1 < order.length) {
      setCursor(cursor + 1)

      return
    }

    if (repeat === 'all') {
      setCursor(0)
    } else {
      setIsPlaying(false)
    }
  }, [cursor, order.length, repeat])

  const previous = useCallback(() => {
    const audio = audioRef.current

    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      setCurrentTime(0)

      return
    }

    if (cursor > 0) {
      setCursor(cursor - 1)
    } else if (audio) {
      audio.currentTime = 0
      setCurrentTime(0)
    }
  }, [cursor])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    const limit = Number.isFinite(audio.duration) ? audio.duration : seconds
    const value = Math.min(Math.max(seconds, 0), limit)
    audio.currentTime = value
    setCurrentTime(value)
  }, [])

  const changeVolume = useCallback((value: number) => {
    const clamped = Math.min(1, Math.max(0, value))
    setVolumeState(clamped)
    setMuted(clamped === 0)
    window.localStorage.setItem(VOLUME_KEY, String(clamped))
  }, [])

  const toggleMute = useCallback(() => setMuted((value) => !value), [])

  const toggleShuffle = useCallback(() => {
    const enabled = !shuffle

    if (queue.length > 0 && current) {
      const currentQueueIndex = order[cursor]
      const indexes = queue.map((_, index) => index)

      if (enabled) {
        const rest = indexes.filter((index) => index !== currentQueueIndex)
        setOrder([currentQueueIndex, ...fisherYates(rest)])
        setCursor(0)
      } else {
        setOrder(indexes)
        setCursor(currentQueueIndex)
      }
    }

    setShuffle(enabled)
  }, [shuffle, queue, order, cursor, current])

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'))
  }, [])

  const addToQueue = useCallback(
    (song: Song) => {
      if (song.is_deleted) {
        return
      }

      if (queue.length === 0) {
        playQueue([song])

        return
      }

      if (queue.some((item) => item.id === song.id)) {
        return
      }

      setOrder((currentOrder) => [...currentOrder, queue.length])
      setQueue((currentQueue) => [...currentQueue, song])
    },
    [queue, playQueue],
  )

  const clearQueue = useCallback(() => {
    setQueue([])
    setOrder([])
    setCursor(0)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  // Carga el audio cuando cambia la canción actual.
  useEffect(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    if (!current?.stream_url) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      setCurrentTime(0)
      setDuration(0)

      return
    }

    if (audio.dataset.songId === String(current.id)) {
      return
    }

    audio.dataset.songId = String(current.id)
    audio.src = current.stream_url
    audio.load()
    recordedSongRef.current = null
    setCurrentTime(0)
    setDuration(0)
  }, [current])

  // Sincroniza play/pause del elemento con el estado.
  useEffect(() => {
    const audio = audioRef.current

    if (!audio || !current?.stream_url) {
      return
    }

    if (isPlaying) {
      void audio.play().catch(() => setIsPlaying(false))
    } else {
      audio.pause()
    }
  }, [isPlaying, current])

  useEffect(() => {
    const audio = audioRef.current

    if (audio) {
      audio.volume = muted ? 0 : volume
    }
  }, [volume, muted])

  // Media Session: metadatos y controles del sistema operativo/bloqueo.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) {
      return
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist_name ?? 'Artista desconocido',
      album: current.album_title ?? '',
      artwork: current.cover_url
        ? [{ src: current.cover_url, sizes: '512x512', type: 'image/webp' }]
        : [],
    })

    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true))
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false))
    navigator.mediaSession.setActionHandler('nexttrack', next)
    navigator.mediaSession.setActionHandler('previoustrack', previous)
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) {
        seek(details.seekTime)
      }
    })

    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
      navigator.mediaSession.setActionHandler('previoustrack', null)
      navigator.mediaSession.setActionHandler('seekto', null)
    }
  }, [current, next, previous, seek])

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    }
  }, [isPlaying])

  const handleEnded = useCallback(() => {
    const audio = audioRef.current

    if (repeat === 'one' && audio) {
      audio.currentTime = 0
      void audio.play()

      return
    }

    next()
  }, [repeat, next])

  /**
   * Registra la reproducción cuando el audio empieza a sonar de verdad.
   *
   * Se usa el evento `playing` y no el cambio de pista para no contar
   * canciones que el usuario nunca llegó a escuchar. La llamada es
   * "dispara y olvida": el reproductor no espera a la API y el backend
   * encola la escritura.
   *
   * Además marca la canción como usada: alimenta el LRU de las descargas
   * offline, para que lo que se escucha sea lo último que se expulsa.
   */
  const handlePlaying = useCallback(
    (event: SyntheticEvent<HTMLAudioElement>) => {
      const songId = Number(event.currentTarget.dataset.songId)

      if (!Number.isFinite(songId) || songId <= 0) {
        return
      }

      markAccessed(songId)

      // Pausar y reanudar no cuenta como una reproducción nueva.
      if (recordedSongRef.current === songId) {
        return
      }

      recordedSongRef.current = songId

      void api
        .recordPlay(songId)
        .then(() => {
          // La escritura está en cola: hay que dar margen al worker antes
          // de refrescar el carrusel, o se leería el historial sin la
          // canción recién escuchada.
          window.setTimeout(() => {
            void queryClient.invalidateQueries({ queryKey: ['history'] })
          }, 1200)
        })
        .catch(() => {
          // Perder una entrada del historial no debe interrumpir la música.
          recordedSongRef.current = null
        })
    },
    [queryClient, markAccessed],
  )

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      current,
      isPlaying,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      playQueue,
      playSong,
      togglePlay,
      next,
      previous,
      seek,
      setVolume: changeVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      addToQueue,
      clearQueue,
    }),
    [
      queue,
      current,
      isPlaying,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      playQueue,
      playSong,
      togglePlay,
      next,
      previous,
      seek,
      changeVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      addToQueue,
      clearQueue,
    ],
  )

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration
          setDuration(Number.isFinite(value) ? value : 0)
        }}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration
          setDuration(Number.isFinite(value) ? value : 0)
        }}
        onEnded={handleEnded}
        onPlaying={handlePlaying}
        onError={() => {
          setIsPlaying(false)

          // Sin conexión solo se puede escuchar lo descargado: avisar evita
          // que el usuario piense que la canción está rota.
          if (!isOnline && current && !isDownloaded(current.id)) {
            toast.info(
              `«${current.title}» no está disponible sin conexión. Descárgala para poder oírla.`,
            )
          }
        }}
        className="hidden"
      />
    </PlayerContext.Provider>
  )
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext)

  if (!context) {
    throw new Error('usePlayer debe usarse dentro de PlayerProvider')
  }

  return context
}
