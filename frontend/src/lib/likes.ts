/**
 * Lógica pura del estado de "me gusta".
 *
 * Se separa del contexto de React para poder cubrirla con tests sin DOM y
 * para que las reglas de la máquina de estados (optimista, reversión y
 * descarte de intentions obsoletas) estén en un único sitio.
 */

/** Decisiones del usuario que tienen prioridad sobre el `is_liked` del payload. */
export type LikeOverrides = Record<number, boolean>

export interface Likeable {
  id: number
  is_liked: boolean
}

/**
 * Estado efectivo de una canción: la decisión del usuario si existe, y el
 * valor del servidor si no.
 */
export function resolveLiked(song: Likeable, overrides: LikeOverrides): boolean {
  return overrides[song.id] ?? song.is_liked
}

/** Registra la intención y devuelve el mapa actualizado. */
export function applyIntent(
  overrides: LikeOverrides,
  songId: number,
  liked: boolean,
): LikeOverrides {
  return { ...overrides, [songId]: liked }
}

/** Revierte a un estado anterior tras un fallo de red o del servidor. */
export function revertIntent(
  overrides: LikeOverrides,
  songId: number,
  previous: boolean,
): LikeOverrides {
  return { ...overrides, [songId]: previous }
}

/**
 * Registro de intenciones vigentes por canción.
 *
 * Permite descartar el resultado de una mutación antigua: si el usuario
 * pulsa "me gusta" y acto seguido "no me gusta", la respuesta del primer
 * clic ya no debe imponerse sobre la del segundo.
 */
export function createIntentTracker() {
  const intents = new Map<number, boolean>()

  return {
    set(songId: number, liked: boolean): void {
      intents.set(songId, liked)
    },
    /** `true` si la intención indicada sigue siendo la vigente. */
    isCurrent(songId: number, liked: boolean): boolean {
      return intents.get(songId) === liked
    },
    clear(): void {
      intents.clear()
    },
  }
}
