/**
 * Portadas generadas para las playlists que aún no tienen imagen propia.
 *
 * El color se deriva del nombre de la playlist, así que es estable entre
 * sesiones y entre dispositivos: la misma playlist siempre se ve igual.
 */

/** Hash determinista y estable (djb2 xor). */
export function hashString(value: string): number {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

export interface Palette {
  from: string
  to: string
  foreground: string
}

/**
 * Paleta derivada de una semilla. Dos matices contiguos en el mismo tono
 * hsl: mantienen el contraste con el texto sin recurrir a colores planos.
 */
export function paletteFor(seed: string): Palette {
  const hue = hashString(seed) % 360
  const secondary = (hue + 45) % 360

  return {
    from: `hsl(${hue} 65% 42%)`,
    to: `hsl(${secondary} 70% 24%)`,
    foreground: `hsl(${hue} 90% 88%)`,
  }
}

/** Inicial visible de un nombre. */
export function initialOf(name: string): string {
  const trimmed = name.trim()

  if (trimmed === '') {
    return '?'
  }

  return trimmed[0].toLocaleUpperCase('es')
}
