import { api, firstError } from '../lib/api'
import type { Song } from '../types'
import {
  listDownloads,
  offlineDb,
  removeDownload,
  totalDownloadedBytes,
  upsertDownload,
} from './db'
import { selectEvictions } from './lru'
import { runPool } from './pool'
import { calculateBudget, estimateStorage, formatBytes } from './quota'
import { cacheAudio, cacheKeyFromUrl, deleteAudio, isOfflineSupported } from './sw-bridge'

/**
 * Descargador offline.
 *
 * Orquesta el proceso completo: pedir permisos de descarga al servidor,
 * comprobar que hay sitio (expulsando lo más antiguo si hace falta),
 * descargar el audio a la caché del service worker y registrar el metadato
 * en IndexedDB.
 *
 * El audio **no** se guarda en IndexedDB: vive en Cache Storage, que es
 * donde el service worker puede servirlo con soporte de Range (necesario
 * para saltar dentro de la canción) sin tener que leerlo entero en memoria.
 */

/** Descargas simultáneas: suficientes para no perder tiempo, pocas para no saturar. */
const DOWNLOAD_CONCURRENCY = 2

export class OfflineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OfflineError'
  }
}

export interface DownloadProgress {
  /** Canciones ya descargadas en esta tanda. */
  completed: number
  /** Canciones en esta tanda. */
  total: number
  /** Bytes descargados hasta ahora. */
  bytes: number
}

export interface DownloadOutcome {
  downloaded: number
  failed: number
  /** Canciones que ya estaban descargadas. */
  skipped: number
  /** Descargas expulsadas para hacer sitio. */
  evicted: number
}

/**
 * Descarga canciones para usarlas sin conexión.
 *
 * @param songs  Canciones a descargar.
 * @param options.playlistId  Playlist a la que pertenecen, para agruparlas en la lista de descargas.
 * @param options.onProgress  Aviso de progreso.
 */
export async function downloadSongs(
  songs: Song[],
  options: { playlistId?: number; onProgress?: (progress: DownloadProgress) => void } = {},
): Promise<DownloadOutcome> {
  if (songs.length === 0) {
    return { downloaded: 0, failed: 0, skipped: 0, evicted: 0 }
  }

  if (!(await isOfflineSupported())) {
    throw new OfflineError(
      'Este navegador no permite guardar música sin conexión. Necesitas la PWA instalada.',
    )
  }

  const existing = await listDownloads()
  const existingIds = new Set(existing.map((record) => record.songId))

  const pending = songs.filter((song) => !existingIds.has(song.id))
  const skipped = songs.length - pending.length

  if (pending.length === 0) {
    return { downloaded: 0, failed: 0, skipped, evicted: 0 }
  }

  // Una sola petición al servidor para todas las canciones pendientes.
  let urls: { song_id: number; url: string; bytes: number }[]

  try {
    const response = await api.downloadUrls(pending.map((song) => song.id))

    urls = response.data
  } catch (error) {
    throw new OfflineError(firstError(error))
  }

  const urlsBySong = new Map(urls.map((entry) => [entry.song_id, entry]))

  const targets = pending
    .map((song) => ({ song, url: urlsBySong.get(song.id) }))
    .filter((target): target is { song: Song; url: { song_id: number; url: string; bytes: number } } =>
      Boolean(target.url),
    )

  if (targets.length === 0) {
    throw new OfflineError('No se han podido preparar las descargas.')
  }

  const requiredBytes = targets.reduce((total, target) => total + target.url.bytes, 0)

  const evicted = await makeRoom(requiredBytes, targets.map((target) => target.song.id))

  let completed = 0
  let bytes = 0
  let failed = 0

  await runPool(targets, DOWNLOAD_CONCURRENCY, async (target) => {
    const cacheKey = cacheKeyFromUrl(target.url.url)
    const result = await cacheAudio(cacheKey, target.url.url)

    if (!result?.ok) {
      failed += 1

      return
    }

    const now = Date.now()
    const coverCacheKey = target.song.cover_url ? cacheKeyFromUrl(target.song.cover_url) : null

    await upsertDownload({
      songId: target.song.id,
      title: target.song.title,
      artistName: target.song.artist_name,
      albumTitle: target.song.album_title,
      durationMs: target.song.duration_ms,
      coverUrl: target.song.cover_url,
      cacheKey,
      coverCacheKey,
      bytes: result.bytes || target.url.bytes,
      cachedAt: now,
      lastAccessedAt: now,
      playlistIds: options.playlistId ? [options.playlistId] : [],
    })

    // La carátula se guarda en la misma caché: sin conexión se ven las
    // portadas y no quedan imágenes rotas. Es opcional: si falla, la
    // descarga sigue siendo válida.
    if (coverCacheKey) {
      void cacheAudio(coverCacheKey, target.song.cover_url as string)
    }

    completed += 1
    bytes += result.bytes || target.url.bytes

    options.onProgress?.({ completed, total: targets.length, bytes })
  })

  return { downloaded: completed, failed, skipped, evicted }
}

/**
 * Libera espacio si hace falta.
 *
 * Si las descargas nuevas no caben en el presupuesto, se expulsa lo menos
 * reciente (LRU) hasta que caben. Si aun así no cabe, se lanza un error con
 * las cifras para que la interfaz pueda explicarlo.
 */
async function makeRoom(requiredBytes: number, protectedIds: number[]): Promise<number> {
  let used = await totalDownloadedBytes()
  let budget = calculateBudget(await estimateStorage(), used)

  if (requiredBytes <= budget.available) {
    return 0
  }

  const shortfall = requiredBytes - budget.available

  const candidates = (await listDownloads()).map((record) => ({
    songId: record.songId,
    bytes: record.bytes,
    lastAccessedAt: record.lastAccessedAt,
  }))

  const toEvict = selectEvictions(candidates, shortfall, protectedIds)

  if (toEvict.length === 0) {
    throw new OfflineError(
      `No hay espacio suficiente: la descarga necesita ${formatBytes(requiredBytes)} y solo hay ` +
        `${formatBytes(budget.available)} libres.`,
    )
  }

  for (const candidate of toEvict) {
    const record = await offlineDb.downloads.get(candidate.songId)

    if (record) {
      await deleteAudio(record.cacheKey)

      if (record.coverCacheKey) {
        await deleteAudio(record.coverCacheKey)
      }
    }

    await removeDownload(candidate.songId)
  }

  used = await totalDownloadedBytes()
  budget = calculateBudget(await estimateStorage(), used)

  if (requiredBytes > budget.available) {
    throw new OfflineError(
      `No hay espacio suficiente: la descarga necesita ${formatBytes(requiredBytes)} y solo hay ` +
        `${formatBytes(budget.available)} libres.`,
    )
  }

  return toEvict.length
}

/** Elimina una descarga: borra el audio de la caché y su registro. */
export async function deleteDownload(songId: number): Promise<void> {
  const record = await offlineDb.downloads.get(songId)

  if (record) {
    await deleteAudio(record.cacheKey)

    if (record.coverCacheKey) {
      await deleteAudio(record.coverCacheKey)
    }
  }

  await removeDownload(songId)
}

/** Borra todas las descargas. */
export async function deleteAllDownloads(): Promise<void> {
  const records = await listDownloads()

  await Promise.all(records.map((record) => deleteAudio(record.cacheKey)))
  await offlineDb.downloads.clear()
}
