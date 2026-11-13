import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InlineConfirm } from './InlineConfirm'

describe('InlineConfirm', () => {
  it('muestra solo el disparador hasta que se pide confirmar', () => {
    render(
      <InlineConfirm
        question="¿Vaciar el historial?"
        confirmLabel="Sí, vaciar"
        onConfirm={() => {}}
        triggerLabel="Vaciar"
      />,
    )

    expect(screen.getByRole('button', { name: 'Vaciar' })).toBeInTheDocument()
    expect(screen.queryByText('¿Vaciar el historial?')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sí, vaciar' })).not.toBeInTheDocument()
  })

  it('revela la pregunta y las dos acciones al pulsar el disparador', async () => {
    const user = userEvent.setup()

    render(
      <InlineConfirm
        question="¿Vaciar el historial?"
        confirmLabel="Sí, vaciar"
        onConfirm={() => {}}
        triggerLabel="Vaciar"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Vaciar' }))

    expect(screen.getByText('¿Vaciar el historial?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sí, vaciar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vaciar' })).not.toBeInTheDocument()
  })

  it('ejecuta la acción y vuelve al estado inicial al confirmar', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(
      <InlineConfirm
        question="¿Eliminar esta playlist?"
        confirmLabel="Sí, eliminar"
        onConfirm={onConfirm}
        triggerLabel="Eliminar"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
    expect(screen.queryByText('¿Eliminar esta playlist?')).not.toBeInTheDocument()
  })

  it('no ejecuta la acción al cancelar', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(
      <InlineConfirm
        question="¿Eliminar esta playlist?"
        confirmLabel="Sí, eliminar"
        onConfirm={onConfirm}
        triggerLabel="Eliminar"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })

  it('permite volver a abrir la confirmación tras cancelar', async () => {
    const user = userEvent.setup()

    render(
      <InlineConfirm
        question="¿Eliminar esta playlist?"
        confirmLabel="Sí, eliminar"
        onConfirm={() => {}}
        triggerLabel="Eliminar"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(screen.getByText('¿Eliminar esta playlist?')).toBeInTheDocument()
  })

  it('respeta el estado deshabilitado del disparador y de la confirmación', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    const { rerender } = render(
      <InlineConfirm
        question="¿Eliminar esta playlist?"
        confirmLabel="Sí, eliminar"
        onConfirm={onConfirm}
        triggerLabel="Eliminar"
        disabled
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(screen.queryByText('¿Eliminar esta playlist?')).not.toBeInTheDocument()

    rerender(
      <InlineConfirm
        question="¿Eliminar esta playlist?"
        confirmLabel="Sí, eliminar"
        onConfirm={onConfirm}
        triggerLabel="Eliminar"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
