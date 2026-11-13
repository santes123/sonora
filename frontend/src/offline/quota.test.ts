import { describe, expect, it } from 'vitest'
import { calculateBudget, formatBytes, type StorageEstimate } from './quota'
import { MAX_OFFLINE_BYTES } from './constants'

describe('calculateBudget', () => {
  it('usa la mitad de la cuota libre como presupuesto', () => {
    // 2 GB de cuota: la mitad son 1 GB, justo por debajo del tope.
    const estimate: StorageEstimate = { usage: 0, quota: 2_000_000_000 }

    const budget = calculateBudget(estimate, 0)

    expect(budget.limit).toBe(1_000_000_000)
    expect(budget.available).toBe(1_000_000_000)
  })

  it('nunca supera el tope de 1 GB', () => {
    const estimate: StorageEstimate = { usage: 0, quota: 100_000_000_000 }

    expect(calculateBudget(estimate, 0).limit).toBe(MAX_OFFLINE_BYTES)
  })

  it('las descargas ya guardadas no reducen el presupuesto', () => {
    // 1 GB de cuota, 300 MB usados por nuestras descargas: el espacio libre
    // real del navegador es de 700 MB, pero nuestro presupuesto sigue siendo
    // la mitad de la cuota (500 MB), no la mitad de 700 MB.
    const estimate: StorageEstimate = { usage: 300_000_000, quota: 1_000_000_000 }

    const budget = calculateBudget(estimate, 300_000_000)

    expect(budget.limit).toBe(500_000_000)
    expect(budget.used).toBe(300_000_000)
    expect(budget.available).toBe(200_000_000)
  })

  it('descuelga el espacio que usan otras aplicaciones', () => {
    // 2 GB de cuota, 1 GB usado por otras apps: solo queda 1 GB libre y
    // nuestro presupuesto es la mitad de eso.
    const estimate: StorageEstimate = { usage: 1_000_000_000, quota: 2_000_000_000 }

    expect(calculateBudget(estimate, 0).limit).toBe(500_000_000)
  })

  it('no presupuesta nada si el navegador no informa de la cuota', () => {
    expect(calculateBudget(null, 0)).toEqual({ limit: 0, used: 0, available: 0 })
    expect(calculateBudget({ usage: 10, quota: 0 }, 0).limit).toBe(0)
  })

  it('nunca da un disponible negativo', () => {
    const estimate: StorageEstimate = { usage: 900, quota: 1000 }

    const budget = calculateBudget(estimate, 900)

    expect(budget.available).toBe(0)
  })
})

describe('formatBytes', () => {
  it('formatea las unidades habituales', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1_572_864)).toBe('1.5 MB')
    expect(formatBytes(1_073_741_824)).toBe('1.0 GB')
  })

  it('no rompe con valores inválidos', () => {
    expect(formatBytes(-10)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
  })
})
