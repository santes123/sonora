import Dexie, { type EntityTable } from 'dexie'

/**
 * Registro de una canción descargada para uso offline.
 *
 * Los bytes del audio viven en la caché del service worker (Cache Storage);
 * aquí solo queda el metadato necesario para listar las descargas, calcular
 * la cuota y saber qué se puede reproducir sin conexión.
 */
export interface DownloadRecord {
  /** Id de la canción en el servidor. */
  songId: number
  title: string
  artistName: string | null
  albumTitle: string | null
  durationMs: number
  coverUrl: string | null
  /** Clave en la caché del service worker (ruta sin query firmada). */
  cacheKey: string
  /** Clave de la portada en la caché, si la canción tiene carátula. */
  coverCacheKey: string | null
  /** Tamaño del audio en bytes. */
  bytes: number
  /** Momento de la descarga (epoch ms). */
  cachedAt: number
  /** Último uso (epoch ms): ordena la expulsión por LRU. */
  lastAccessedAt: number
  /** Playlists en las que está esta canción. */
  playlistIds: number[]
}

class OfflineDatabase extends Dexie {
  downloads!: EntityTable<DownloadRecord, 'songId'>

  constructor() {
    super('sonora-offline')

    // `lastAccessedAt` está indexado porque la expulsión por LRU siempre
    // ordena por ese campo; `cachedAt` para listar por orden de descarga.
    this.version(1).stores({
      downloads: 'songId, cachedAt, lastAccessedAt, *playlistIds',
    })
  }
}

export const offlineDb = new OfflineDatabase()

export async function listDownloads(): Promise<DownloadRecord[]> {
  return offlineDb.downloads.toArray()
}

export async function findDownload(songId: number): Promise<DownloadRecord | undefined> {
  return offlineDb.downloads.get(songId)
}

export async function totalDownloadedBytes(): Promise<number> {
  const records = await offlineDb.downloads.toArray()

  return records.reduce((total, record) => total + record.bytes, 0)
}

export async function upsertDownload(record: DownloadRecord): Promise<void> {
  await offlineDb.downloads.put(record)
}

/**
 * Marca una descarga como usada.
 *
 * Es lo que alimenta el LRU: la canción que el usuario acaba de ouvir es la
 * última que debe expulsarse cuando haya que liberar espacio.
 */
export async function touchDownload(songId: number, at = Date.now()): Promise<void> {
  await offlineDb.downloads.update(songId, { lastAccessedAt: at })
}

export async function removeDownload(songId: number): Promise<void> {
  await offlineDb.downloads.delete(songId)
}

export async function clearDownloads(): Promise<void> {
  await offlineDb.downloads.clear()
}
