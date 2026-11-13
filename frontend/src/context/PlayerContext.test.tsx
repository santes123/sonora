import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerProvider, usePlayer } from './PlayerContext'
import type { Song } from '../types'

/**
 * El reproductor solo necesita dos cosas del resto de la app: la API para
 * registrar la reproducción y el estado offline para saber si una canción
 * está descargada. Aquí se aíslan las dos.
 */

const recordPlay = vi.fn()
const toastInfo = vi.fn()
const toastError = vi.fn()
const toastSuccess = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    recordPlay: (...args: unknown[]) => recordPlay(...args),
  },
  firstError: (error: unknown) => (error instanceof Error ? error.message : 'error'),
}))

vi.mock('./ToastContext', () => ({
  useToast: () => ({ info: toastInfo, error: toastError, success: toastSuccess }),
}))

let offlineState = {
  isOnline: true,
  isDownloaded: () => false,
  markAccessed: vi.fn(),
}

vi.mock('./OfflineContext', () => ({
  useOffline: () => offlineState,
}))

const song: Song = {
  id: 7,
  title: 'Luz de Verano',
  artist_name: 'Las Olas',
  album_title: 'Pruebas de Sonora',
  track_number: null,
  disc_number: null,
  year: null,
  genre: null,
  duration_ms: 7000,
  cover_url: null,
  stream_url: '/api/v1/media/abc',
  is_liked: false,
  created_at: null,
}

function Harness() {
  const { playSong, current } = usePlayer()

  return (
    <div>
      <button type="button" onClick={() => playSong(song)}>
        Reproducir
      </button>
      <span data-testid="current">{current?.title ?? '—'}</span>
    </div>
  )
}

function renderPlayer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const view = render(
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
        <Harness />
      </PlayerProvider>
    </QueryClientProvider>,
  )

  const audio = view.container.querySelector('audio') as HTMLAudioElement

  return { ...view, audio }
}

describe('PlayerContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    offlineState = {
      isOnline: true,
      isDownloaded: () => false,
      markAccessed: vi.fn(),
    }
    recordPlay.mockResolvedValue({ data: { status: 'queued' } })
  })

  it('carga la canción en el elemento de audio', async () => {
    const { audio } = renderPlayer()

    act(() => {
      screen.getByRole('button', { name: 'Reproducir' }).click()
    })

    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('Luz de Verano'))
    expect(audio.src).toContain('/api/v1/media/abc')
  })

  it('avisa cuando la canción no está disponible sin conexión', async () => {
    offlineState = {
      isOnline: false,
      isDownloaded: () => false,
      markAccessed: vi.fn(),
    }

    const { audio } = renderPlayer()

    act(() => {
      screen.getByRole('button', { name: 'Reproducir' }).click()
    })

    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('Luz de Verano'))

    act(() => {
      audio.dispatchEvent(new Event('error'))
    })

    expect(toastInfo).toHaveBeenCalledWith(
      '«Luz de Verano» no está disponible sin conexión. Descárgala para poder oírla.',
    )
  })

  it('no avisa si la canción está descargada', async () => {
    offlineState = {
      isOnline: false,
      isDownloaded: () => true,
      markAccessed: vi.fn(),
    }

    const { audio } = renderPlayer()

    act(() => {
      screen.getByRole('button', { name: 'Reproducir' }).click()
    })

    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('Luz de Verano'))

    act(() => {
      audio.dispatchEvent(new Event('error'))
    })

    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('no avisa si hay conexión', async () => {
    const { audio } = renderPlayer()

    act(() => {
      screen.getByRole('button', { name: 'Reproducir' }).click()
    })

    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('Luz de Verano'))

    act(() => {
      audio.dispatchEvent(new Event('error'))
    })

    expect(toastInfo).not.toHaveBeenCalled()
  })
})
