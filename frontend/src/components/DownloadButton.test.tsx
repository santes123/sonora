import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DownloadButton } from './DownloadButton'

const downloadSong = vi.fn()
const removeSong = vi.fn()
const isDownloaded = vi.fn()

vi.mock('../context/OfflineContext', () => ({
  useOffline: () => ({
    isDownloaded,
    downloadSong,
    removeSong,
    downloading: [],
  }),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
const toastInfo = vi.fn()

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError, info: toastInfo }),
}))

const song = {
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

describe('DownloadButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDownloaded.mockReturnValue(false)
    downloadSong.mockResolvedValue(undefined)
    removeSong.mockResolvedValue(undefined)
  })

  it('ofrece descargar cuando la canción no está descargada', async () => {
    const user = userEvent.setup()

    render(<DownloadButton song={song} />)

    const button = screen.getByRole('button', { name: /Descargar «Luz de Verano»/ })

    expect(button).toHaveAttribute('aria-pressed', 'false')

    await user.click(button)

    await waitFor(() => expect(downloadSong).toHaveBeenCalledWith(song))
    expect(toastSuccess).toHaveBeenCalledWith('«Luz de Verano» descargada.')
  })

  it('ofrece quitar cuando la canción ya está descargada', async () => {
    const user = userEvent.setup()
    isDownloaded.mockReturnValue(true)

    render(<DownloadButton song={song} />)

    const button = screen.getByRole('button', { name: /Quitar «Luz de Verano»/ })

    expect(button).toHaveAttribute('aria-pressed', 'true')

    await user.click(button)

    await waitFor(() => expect(removeSong).toHaveBeenCalledWith(7))
    expect(toastInfo).toHaveBeenCalledWith('Descarga eliminada.')
  })

  it('avisa del error si la descarga falla', async () => {
    const user = userEvent.setup()
    downloadSong.mockRejectedValue(new Error('No hay espacio suficiente'))

    render(<DownloadButton song={song} />)

    await user.click(screen.getByRole('button', { name: /Descargar «Luz de Verano»/ }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('No hay espacio suficiente'))
  })
})
