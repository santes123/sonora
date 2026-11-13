import clsx from 'clsx'
import type { ClassValue } from 'clsx'

export function cn(...classes: ClassValue[]): string {
  return clsx(classes)
}

/** 3:45 o 1:02:03 según dureza. */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms < 0) {
    return '—'
  }

  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (value: number) => String(value).padStart(2, '0')

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/** Duración agregada legible: "1 h 12 min", "8 min". */
export function formatTotalDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000)

  if (totalMinutes < 1) {
    return 'menos de 1 min'
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`
}

export function formatDate(iso: string | null): string {
  if (!iso) {
    return ''
  }

  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function greeting(date = new Date()): string {
  const hour = date.getHours()

  if (hour < 6) {
    return 'Buenas noches'
  }

  if (hour < 13) {
    return 'Buenos días'
  }

  if (hour < 20) {
    return 'Buenas tardes'
  }

  return 'Buenas noches'
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}
