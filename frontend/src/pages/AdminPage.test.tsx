import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminPage } from './AdminPage'

const adminSettings = vi.fn()
const updateAdminSettings = vi.fn()
const adminUsers = vi.fn()
const createUser = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    adminSettings: () => adminSettings(),
    updateAdminSettings: (changes: unknown) => updateAdminSettings(changes),
    adminUsers: () => adminUsers(),
    createUser: (payload: unknown) => createUser(payload),
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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentUser = { id: 1, role: 'admin' }
    adminSettings.mockResolvedValue({ registration_enabled: false, allow_indexing: false })
    adminUsers.mockResolvedValue({
      data: [{ id: 1, name: 'Administrador', email: 'admin@sonora.local', role: 'admin' }],
      meta: { total: 1 },
    })
    updateAdminSettings.mockResolvedValue({ registration_enabled: true, allow_indexing: false })
    createUser.mockResolvedValue({
      id: 9,
      name: 'Persona Invitada',
      email: 'invitada@example.com',
      role: 'user',
    })
  })

  it('no muestra el panel a un usuario normal', async () => {
    currentUser = { id: 2, role: 'user' }

    renderPage()

    await waitFor(() => expect(screen.getByText('Esta sección es solo para administradores.')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Guardar ajustes' })).toBeNull()
  })

  it('muestra los ajustes del sitio', async () => {
    renderPage()

    await waitFor(() =>
      expect(screen.getByLabelText(/Permitir registro público/)).toBeInTheDocument(),
    )

    expect(screen.getByLabelText(/Permitir registro público/)).not.toBeChecked()
    expect(screen.getByLabelText(/Permitir indexación/)).not.toBeChecked()
  })

  it('guarda los ajustes marcados', async () => {
    const user = userEvent.setup()

    renderPage()

    const registration = await screen.findByLabelText(/Permitir registro público/)

    await user.click(registration)
    await user.click(screen.getByRole('button', { name: 'Guardar ajustes' }))

    await waitFor(() =>
      expect(updateAdminSettings).toHaveBeenCalledWith({
        registration_enabled: true,
        allow_indexing: false,
      }),
    )
    expect(toastSuccess).toHaveBeenCalledWith('Ajustes guardados.')
  })

  it('registra un usuario nuevo', async () => {
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('Nombre'), 'Persona Invitada')
    await user.type(screen.getByLabelText('Correo electrónico'), 'invitada@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'secreto123')
    await user.type(screen.getByLabelText('Repite la contraseña'), 'secreto123')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith({
        name: 'Persona Invitada',
        email: 'invitada@example.com',
        password: 'secreto123',
        password_confirmation: 'secreto123',
        role: 'user',
      }),
    )
    expect(toastSuccess).toHaveBeenCalledWith('Cuenta creada para invitada@example.com.')
  })

  it('no envía el formulario si la contraseña no coincide', async () => {
    const user = userEvent.setup()

    renderPage()

    await user.type(await screen.findByLabelText('Nombre'), 'Persona Invitada')
    await user.type(screen.getByLabelText('Correo electrónico'), 'invitada@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'secreto123')
    await user.type(screen.getByLabelText('Repite la contraseña'), 'otra-cosa')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(createUser).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('La confirmación de contraseña no coincide.')
  })

  it('lista las cuentas del sitio', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('admin@sonora.local')).toBeInTheDocument())
    expect(screen.getByText('Cuentas (1)')).toBeInTheDocument()
  })
})
