import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RegisterPage } from './RegisterPage'

/**
 * Con el registro cerrado, la página no ofrece formulario: el administrador
 * da de alta las cuentas desde el panel.
 */

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ register: vi.fn() }),
}))

let registrationEnabled = false

vi.mock('../context/SettingsContext', () => ({
  useSiteSettings: () => ({
    settings: { registration_enabled: registrationEnabled, allow_indexing: false },
    registrationEnabled,
    indexingAllowed: false,
  }),
}))

describe('RegisterPage', () => {
  beforeEach(() => {
    registrationEnabled = false
  })

  it('no muestra el formulario si el registro está cerrado', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Registro cerrado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear cuenta' })).toBeNull()
    expect(screen.queryByLabelText('Nombre')).toBeNull()
  })

  it('muestra el formulario si el registro está abierto', () => {
    registrationEnabled = true

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument()
  })
})
