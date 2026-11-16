import type { Song } from '../types'
import type { DownloadSummary } from './types'

/**
 * Reconstruye una canción a partir de su descarga.
 *
 * Las URLs firmadas caducan, así que no se guardan: lo que se guarda es la
 * ruta (`/api/v1/media/<token>`), que el service worker reconoce y sirve
 * desde la caché sin comprobar la firma. Por eso la canción reconstruida
 * suena igual sin conexión.
 */
export function songFromDownload(download: DownloadSummary): Song {
  return {
    id: download.songId,
    title: download.title,
    artist_name: download.artistName,
    album_title: download.albumTitle,
    track_number: null,
    disc_number: null,
    year: null,
    genre: null,
    duration_ms: download.durationMs,
    cover_url: download.coverCacheKey ?? download.coverUrl,
    stream_url: download.cacheKey,
    is_liked: false,
    // Lo que está descargado sigue disponible aunque la canción se elimine
    // del catálogo: el audio ya está en el dispositivo.
    is_deleted: false,
    created_at: null,
  }
}
