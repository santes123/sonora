import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest corre con `globals: false`, así que la limpieza automática de
// Testing Library no se registra sola: hay que hacerla explícita para que
// cada test parta de un DOM limpio.
afterEach(() => {
  cleanup()
})
