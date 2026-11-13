import { describe, expect, it } from 'vitest'
import { hashString, initialOf, paletteFor } from './cover'

describe('hashString', () => {
  it('is deterministic for the same input', () => {
    expect(hashString('Favoritas')).toBe(hashString('Favoritas'))
  })

  it('separates different inputs', () => {
    expect(hashString('Favoritas')).not.toBe(hashString('Rock & Roll'))
  })

  it('is never negative', () => {
    expect(hashString('')).toBeGreaterThanOrEqual(0)
    expect(hashString('a')).toBeGreaterThanOrEqual(0)
  })
})

describe('paletteFor', () => {
  it('returns the same palette for the same seed', () => {
    expect(paletteFor('Favoritas')).toEqual(paletteFor('Favoritas'))
  })

  it('returns different palettes for different seeds', () => {
    expect(paletteFor('Favoritas')).not.toEqual(paletteFor('Rock & Roll'))
  })

  it('produces usable hsl colors', () => {
    const palette = paletteFor('Favoritas')

    expect(palette.from).toMatch(/^hsl\(\d+ 65% 42%\)$/)
    expect(palette.to).toMatch(/^hsl\(\d+ 70% 24%\)$/)
    expect(palette.foreground).toMatch(/^hsl\(\d+ 90% 88%\)$/)
  })
})

describe('initialOf', () => {
  it('takes the first letter in uppercase', () => {
    expect(initialOf('favoritas')).toBe('F')
    expect(initialOf('Rock & Roll')).toBe('R')
  })

  it('handles names with leading spaces', () => {
    expect(initialOf('  misHits')).toBe('M')
  })

  it('falls back to a question mark for empty names', () => {
    expect(initialOf('')).toBe('?')
    expect(initialOf('   ')).toBe('?')
  })

  it('keeps accented letters', () => {
    expect(initialOf('Álbunes')).toBe('Á')
  })
})
