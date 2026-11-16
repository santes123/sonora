import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

/**
 * El sitio es privado: si el registro está cerrado, no hay ningún enlace
 * público que invite a crear una cuenta.
 */

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn() }),
}))

let registrationEnabled = false

vi.mock('../context/SettingsContext', () => ({
  useSiteSettings: () => ({
    settings: { registration_enabled: registrationEnabled, allow_indexing: false },
    registrationEnabled,
    indexingAllowed: false,
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    registrationEnabled = false
  })

  it('oculta el enlace de registro cuando el registro está cerrado', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('link', { name: 'Crear una cuenta' })).toBeNull()
    expect(screen.getByText(/El registro está cerrado/)).toBeInTheDocument()
  })

  it('muestra el enlace de registro cuando el registro está abierto', () => {
    registrationEnabled = true

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Crear una cuenta' })).toBeInTheDocument()
  })
})
