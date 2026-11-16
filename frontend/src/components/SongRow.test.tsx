import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SongRow } from './SongRow'

/**
 * La fila de una canción eliminada: se sigue viendo (puede estar en la
 * playlist de otra persona) pero no se reproduce.
 */

const playQueue = vi.fn()
const toastInfo = vi.fn()

vi.mock('../context/PlayerContext', () => ({
  usePlayer: () => ({
    current: null,
    isPlaying: false,
    playQueue,
    togglePlay: vi.fn(),
  }),
}))

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ info: toastInfo, error: vi.fn(), success: vi.fn() }),
}))

vi.mock('./LikeButton', () => ({ LikeButton: () => <button type="button">Me gusta</button> }))
vi.mock('./DownloadButton', () => ({ DownloadButton: () => <button type="button">Descargar</button> }))
vi.mock('./AddToPlaylistMenu', () => ({
  AddToPlaylistMenu: () => <button type="button">Añadir a la lista</button>,
}))
vi.mock('./SongActions', () => ({ SongActions: () => <button type="button">Acciones</button> }))

const song = {
  id: 7,
  title: 'Luz de Verano',
  artist_name: 'Las Olas',
  album_title: null,
  track_number: null,
  disc_number: null,
  year: null,
  genre: null,
  duration_ms: 7000,
  cover_url: null,
  stream_url: '/api/v1/media/abc',
  is_liked: false,
  is_deleted: false,
  created_at: null,
}

describe('SongRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reproduce la canción cuando está disponible', async () => {
    const user = userEvent.setup()

    render(<SongRow song={song} index={0} queue={[song]} />)

    // Hay dos botones de reproducción (móvil y escritorio).
    await user.click(screen.getAllByRole('button', { name: /Reproducir Luz de Verano/ })[0])

    expect(playQueue).toHaveBeenCalledWith([song], 0)
  })

  it('muestra las canciones eliminadas como no disponibles', () => {
    render(<SongRow song={{ ...song, is_deleted: true }} index={0} queue={[song]} />)

    expect(screen.getByText('No disponible')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /no está disponible/ })[0]).toBeDisabled()
  })

  it('no reproduce una canción eliminada', async () => {
    const user = userEvent.setup()

    render(<SongRow song={{ ...song, is_deleted: true }} index={0} queue={[song]} />)

    // El botón está deshabilitado: no hay nada que reproducir.
    await user.click(screen.getAllByRole('button', { name: /no está disponible/ })[0])

    expect(playQueue).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('oculta las acciones de marcar y descargar en una canción eliminada', () => {
    render(<SongRow song={{ ...song, is_deleted: true }} index={0} queue={[song]} />)

    expect(screen.queryByRole('button', { name: 'Me gusta' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Descargar' })).toBeNull()
  })
})
