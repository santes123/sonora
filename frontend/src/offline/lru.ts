/**
 * Expulsión por LRU (Least Recently Used).
 *
 * Cuando no queda sitio para una descarga nueva, se tira lo que hace menos
 * que se ha escuchando: es lo que menos probable es que el usuario eche de
 * menos. Las funciones son puras para poder testear la política sin tocar
 * IndexedDB ni la caché.
 */

export interface EvictionCandidate {
  songId: number
  bytes: number
  /** Epoch ms del último uso. */
  lastAccessedAt: number
}

/**
 * Elige qué descargas expulsar para liberar `requiredBytes`.
 *
 * @param candidates  Descargas occupying espacio, con su tamaño y último uso.
 * @param requiredBytes  Bytes que hay que liberar.
 * @param protectedIds  Canciones que no se pueden tocar (las que se están descargando).
 */
export function selectEvictions(
  candidates: EvictionCandidate[],
  requiredBytes: number,
  protectedIds: number[] = [],
): EvictionCandidate[] {
  if (requiredBytes <= 0) {
    return []
  }

  const protectedSet = new Set(protectedIds)

  const sorted = [...candidates]
    .filter((candidate) => !protectedSet.has(candidate.songId))
    .sort((a, b) => {
      // Menos reciente primero; a igualdad, la más pequeña antes (libera
      // más espacio con la misma cantidad de expulsiones).
      if (a.lastAccessedAt !== b.lastAccessedAt) {
        return a.lastAccessedAt - b.lastAccessedAt
      }

      return a.bytes - b.bytes
    })

  const selected: EvictionCandidate[] = []
  let freed = 0

  for (const candidate of sorted) {
    if (freed >= requiredBytes) {
      break
    }

    selected.push(candidate)
    freed += candidate.bytes
  }

  return selected
}

/**
 * Bytes que liberan las descargas candidatas.
 */
export function freedBytes(candidates: EvictionCandidate[]): number {
  return candidates.reduce((total, candidate) => total + candidate.bytes, 0)
}
