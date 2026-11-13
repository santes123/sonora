/**
 * Resumen de una descarga, tal y como la muestra la interfaz.
 *
 * Es una proyección de `DownloadRecord` (IndexedDB) sin los datos internos
 * de caché: lo que las pantallas necesitan para listar y explicar el
 * estado offline.
 */
export interface DownloadSummary {
  songId: number
  title: string
  artistName: string | null
  albumTitle: string | null
  durationMs: number
  coverUrl: string | null
  /** Ruta del audio en la caché del service worker. */
  cacheKey: string
  /** Ruta de la carátula en la caché del service worker. */
  coverCacheKey: string | null
  bytes: number
  /** Epoch ms de la descarga. */
  cachedAt: number
  /** Epoch ms del último uso (ordena el LRU). */
  lastAccessedAt: number
  playlistIds: number[]
}
