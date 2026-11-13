import { describe, expect, it } from 'vitest'
import { ApiError, firstError } from './api'

describe('firstError', () => {
  it('extracts the first validation error message from ApiError', () => {
    const error = new ApiError(422, 'The given data was invalid.', {
      title: ['El título es obligatorio.'],
      email: ['El correo no es válido.'],
    })

    expect(firstError(error)).toBe('El título es obligatorio.')
  })

  it('falls back to message when errors record is empty', () => {
    const error = new ApiError(500, 'Error del servidor')
    expect(firstError(error)).toBe('Error del servidor')
  })

  it('extracts message from standard Error', () => {
    const error = new Error('Fallo de red')
    expect(firstError(error)).toBe('Fallo de red')
  })

  it('returns default message for unknown errors', () => {
    expect(firstError(null)).toBe('Ha ocurrido un error inesperado.')
    expect(firstError('un string')).toBe('Ha ocurrido un error inesperado.')
  })
})
