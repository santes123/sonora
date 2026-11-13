import { describe, expect, it } from 'vitest'
import { songFromDownload } from './song'
import type { DownloadSummary } from './types'

const download: DownloadSummary = {
  songId: 7,
  title: 'Luz de Verano',
  artistName: 'Las Olas',
  albumTitle: 'Pruebas de Sonora',
  durationMs: 7000,
  coverUrl: '/api/v1/media/cubierta?expires=1&signature=abc',
  cacheKey: '/api/v1/media/YXVkaW8',
  coverCacheKey: '/api/v1/media/Y3ViaWVydGE',
  bytes: 1024,
  cachedAt: 1_700_000_000_000,
  lastAccessedAt: 1_700_000_100_000,
  playlistIds: [1],
}

describe('songFromDownload', () => {
  it('reconstruye la canción con la ruta cacheada del audio', () => {
    const song = songFromDownload(download)

    expect(song.id).toBe(7)
    expect(song.title).toBe('Luz de Verano')
    expect(song.artist_name).toBe('Las Olas')
    expect(song.duration_ms).toBe(7000)
    expect(song.stream_url).toBe('/api/v1/media/YXVkaW8')
  })

  it('usa la portada cacheada para que se vea sin conexión', () => {
    expect(songFromDownload(download).cover_url).toBe('/api/v1/media/Y3ViaWVydGE')
  })

  it('cae en la URL original si no hay portada cacheada', () => {
    const song = songFromDownload({ ...download, coverCacheKey: null })

    expect(song.cover_url).toBe('/api/v1/media/cubierta?expires=1&signature=abc')
  })

  it('no marca la canción como favorita', () => {
    expect(songFromDownload(download).is_liked).toBe(false)
  })
})
