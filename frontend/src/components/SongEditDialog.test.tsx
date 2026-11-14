import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SongEditDialog } from './SongEditDialog'

const updateSong = vi.fn()
const updateSongCover = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    updateSong: (id: number, changes: unknown) => updateSong(id, changes),
    updateSongCover: (id: number, file: File) => updateSongCover(id, file),
  },
  firstError: (error: unknown) => (error instanceof Error ? error.message : 'Error'),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError, info: vi.fn() }),
}))

const song = {
  id: 7,
  title: 'Luz de Verano',
  artist_name: 'Las Olas',
  album_title: 'Pruebas de Sonora',
  track_number: 3,
  disc_number: null,
  year: 2024,
  genre: 'Indie',
  duration_ms: 7000,
  cover_url: '/api/v1/media/cover.webp',
  stream_url: '/api/v1/media/abc',
  is_liked: false,
  created_at: null,
}

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={client}>
      <SongEditDialog song={song} onClose={vi.fn()} />
    </QueryClientProvider>,
  )
}

describe('SongEditDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateSong.mockResolvedValue(song)
    updateSongCover.mockResolvedValue({ ...song, cover_url: '/api/v1/media/nueva.webp' })
  })

  it('muestra los valores actuales de la canción', () => {
    renderDialog()

    expect(screen.getByLabelText('Título')).toHaveValue('Luz de Verano')
    expect(screen.getByLabelText('Artista')).toHaveValue('Las Olas')
    expect(screen.getByLabelText('Álbum')).toHaveValue('Pruebas de Sonora')
    expect(screen.getByLabelText('Pista')).toHaveValue(3)
    expect(screen.getByLabelText('Año')).toHaveValue(2024)
    expect(screen.getByLabelText('Género')).toHaveValue('Indie')
  })

  it('envía los campos modificados y vacía los que se borran', async () => {
    const user = userEvent.setup()

    renderDialog()

    const album = screen.getByLabelText('Álbum')
    await user.clear(album)

    const genre = screen.getByLabelText('Género')
    await user.clear(genre)

    await user.click(screen.getByRole('button', { name: /Guardar cambios/ }))

    await waitFor(() =>
      expect(updateSong).toHaveBeenCalledWith(song.id, {
        title: 'Luz de Verano',
        artist_name: 'Las Olas',
        album_title: '',
        track_number: 3,
        disc_number: null,
        year: 2024,
        genre: '',
      }),
    )
  })

  it('envía null en los números que se dejan en blanco', async () => {
    const user = userEvent.setup()

    renderDialog()

    await user.clear(screen.getByLabelText('Año'))
    await user.clear(screen.getByLabelText('Pista'))

    await user.click(screen.getByRole('button', { name: /Guardar cambios/ }))

    await waitFor(() => {
      const [, changes] = updateSong.mock.calls[0]

      expect(changes.year).toBeNull()
      expect(changes.track_number).toBeNull()
    })
  })

  it('sube la carátula en cuanto se elige el fichero', async () => {
    const user = userEvent.setup()

    renderDialog()

    const input = document.getElementById('song-cover-input') as HTMLInputElement
    const file = new File(['imagen'], 'caratula.jpg', { type: 'image/jpeg' })

    await user.upload(input, file)

    await waitFor(() => expect(updateSongCover).toHaveBeenCalledWith(song.id, file))
    expect(updateSong).not.toHaveBeenCalled()
  })
})
