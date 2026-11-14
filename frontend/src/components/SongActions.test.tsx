import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { SongActions } from './SongActions'

const deleteSong = vi.fn()
const updateSong = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    deleteSong: (id: number) => deleteSong(id),
    updateSong: (id: number, changes: unknown) => updateSong(id, changes),
    updateSongCover: vi.fn(),
  },
  firstError: (error: unknown) => (error instanceof Error ? error.message : 'Error'),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError, info: vi.fn() }),
}))

let currentUser: { id: number; role: 'user' | 'admin' } | null = null

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: currentUser }),
}))

vi.mock('./SongEditDialog', () => ({
  SongEditDialog: () => <div>diálogo de edición</div>,
}))

const uploader = {
  id: 3,
  name: 'Ana',
  email: 'ana@example.com',
  role: 'user' as const,
  avatar_url: null,
  created_at: null,
}

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
  uploader,
  created_at: null,
}

describe('SongActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentUser = { id: 3, role: 'user' }
    deleteSong.mockResolvedValue(undefined)
  })

  const renderActions = (element: ReactElement) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>)
  }

  it('no muestra acciones si el usuario no es el uploader ni administrador', () => {
    currentUser = { id: 99, role: 'user' }

    renderActions(<SongActions song={song} />)

    expect(screen.queryByRole('button', { name: /Acciones de/ })).toBeNull()
  })

  it('muestra las acciones al uploader', async () => {
    const user = userEvent.setup()

    renderActions(<SongActions song={song} />)

    await user.click(screen.getByRole('button', { name: /Acciones de/ }))

    expect(screen.getByRole('menuitem', { name: /Editar/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Eliminar/ })).toBeInTheDocument()
  })

  it('muestra las acciones a un administrador aunque no sea el uploader', async () => {
    const user = userEvent.setup()
    currentUser = { id: 99, role: 'admin' }

    renderActions(<SongActions song={song} />)

    await user.click(screen.getByRole('button', { name: /Acciones de/ }))

    expect(screen.getByRole('menuitem', { name: /Eliminar/ })).toBeInTheDocument()
  })

  it('pide confirmación en línea antes de eliminar', async () => {
    const user = userEvent.setup()

    renderActions(<SongActions song={song} />)

    await user.click(screen.getByRole('button', { name: /Acciones de/ }))
    await user.click(screen.getByRole('menuitem', { name: /Eliminar/ }))

    expect(screen.getByText(/No se puede deshacer/)).toBeInTheDocument()
    expect(deleteSong).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Sí, eliminar/ }))

    await waitFor(() => expect(deleteSong).toHaveBeenCalledWith(song.id))
    expect(toastSuccess).toHaveBeenCalledWith('Canción eliminada.')
  })

  it('permite cancelar la eliminación sin borrar nada', async () => {
    const user = userEvent.setup()

    renderActions(<SongActions song={song} />)

    await user.click(screen.getByRole('button', { name: /Acciones de/ }))
    await user.click(screen.getByRole('menuitem', { name: /Eliminar/ }))
    await user.click(screen.getByRole('button', { name: /Cancelar/ }))

    expect(deleteSong).not.toHaveBeenCalled()
  })

  it('abre el diálogo de edición', async () => {
    const user = userEvent.setup()

    renderActions(<SongActions song={song} />)

    await user.click(screen.getByRole('button', { name: /Acciones de/ }))
    await user.click(screen.getByRole('menuitem', { name: /Editar/ }))

    expect(screen.getByText('diálogo de edición')).toBeInTheDocument()
  })
})
