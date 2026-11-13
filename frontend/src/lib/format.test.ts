import { describe, expect, it } from 'vitest'
import {
  cn,
  formatDate,
  formatDuration,
  formatTotalDuration,
  greeting,
  pluralize,
} from './format'

describe('formatDuration', () => {
  it('formats milliseconds to mm:ss', () => {
    expect(formatDuration(65000)).toBe('1:05')
    expect(formatDuration(180000)).toBe('3:00')
    expect(formatDuration(9000)).toBe('0:09')
  })

  it('formats hours for long tracks', () => {
    expect(formatDuration(3665000)).toBe('1:01:05')
  })

  it('handles null, undefined, or zero gracefully', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(undefined)).toBe('—')
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(-100)).toBe('—')
  })
})

describe('formatTotalDuration', () => {
  it('formats less than a minute', () => {
    expect(formatTotalDuration(20000)).toBe('menos de 1 min')
  })

  it('formats minutes', () => {
    expect(formatTotalDuration(300000)).toBe('5 min')
  })

  it('formats hours and minutes', () => {
    expect(formatTotalDuration(3900000)).toBe('1 h 5 min')
    expect(formatTotalDuration(3600000)).toBe('1 h')
  })
})

describe('formatDate', () => {
  it('formats ISO dates or returns empty string for null', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate('2026-11-13T10:00:00Z')).toContain('2026')
  })
})

describe('pluralize', () => {
  it('handles singular and plural counts', () => {
    expect(pluralize(1, 'canción', 'canciones')).toBe('1 canción')
    expect(pluralize(0, 'canción', 'canciones')).toBe('0 canciones')
    expect(pluralize(5, 'canción', 'canciones')).toBe('5 canciones')
  })
})

describe('greeting', () => {
  it('returns appropriate greeting based on hour', () => {
    const morning = new Date('2026-11-13T09:00:00')
    const afternoon = new Date('2026-11-13T16:00:00')
    const evening = new Date('2026-11-13T22:00:00')
    const night = new Date('2026-11-13T03:00:00')

    expect(greeting(morning)).toBe('Buenos días')
    expect(greeting(afternoon)).toBe('Buenas tardes')
    expect(greeting(evening)).toBe('Buenas noches')
    expect(greeting(night)).toBe('Buenas noches')
  })
})

describe('cn', () => {
  it('merges class names correctly', () => {
    expect(cn('btn', true && 'btn-primary', false && 'btn-disabled')).toBe('btn btn-primary')
  })
})
