import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Vitest corre con `globals: false`, así que la limpieza automática de
// Testing Library no se registra sola: hay que hacerla explícita para que
// cada test parta de un DOM limpio.
afterEach(() => {
  cleanup()
})

// jsdom no implementa la reproducción de medios: `play()` devuelve
// undefined y el reproductor hace `.catch()` sobre ella. Se sustituye por
// una promesa resuelta.
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
})

Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: vi.fn(),
})

// `load()` tampoco está implementado en jsdom y solo ensucia la salida.
Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
  configurable: true,
  value: vi.fn(),
})
