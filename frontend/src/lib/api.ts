import type {
  Album,
  Artist,
  HistoryEntry,
  Paginated,
  Playlist,
  Song,
  SongQuery,
  User,
} from '../types'

const API = '/api/v1'
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

export function firstError(error: unknown): string {
  if (error instanceof ApiError) {
    const first = error.errors ? Object.values(error.errors)[0]?.[0] : undefined
    return first ?? error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Ha ocurrido un error inesperado.'
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`
  const found = document.cookie.split('; ').find((row) => row.startsWith(prefix))

  return found ? found.slice(prefix.length) : null
}

let csrfRequest: Promise<void> | null = null

/**
 * Sanctum exige la cookie XSRF-TOKEN antes de cualquier petición mutante.
 * Se cachea la promesa para no pedirla en ráfaga.
 */
export async function ensureCsrfCookie(): Promise<void> {
  if (readCookie('XSRF-TOKEN')) {
    return
  }

  csrfRequest ??= fetch('/sanctum/csrf-cookie', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
    .then(() => undefined)
    .finally(() => {
      csrfRequest = null
    })

  return csrfRequest
}

function csrfHeaders(): Record<string, string> {
  const token = readCookie('XSRF-TOKEN')

  return token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {}
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  headers?: Record<string, string>
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }

  let body: BodyInit | undefined

  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  if (MUTATING.has(method)) {
    await ensureCsrfCookie()
    Object.assign(headers, csrfHeaders())
  }

  const response = await fetch(`${API}${path}`, {
    method,
    body,
    headers,
    credentials: 'include',
    signal: options.signal,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  const payload = text ? (JSON.parse(text) as unknown) : null

  if (!response.ok) {
    const data = payload as { message?: string; errors?: Record<string, string[]> } | null

    if (response.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'))
    }

    throw new ApiError(
      response.status,
      data?.message ?? `Error ${response.status}`,
      data?.errors,
    )
  }

  return payload as T
}

export function toQueryString(params: object): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }

  const result = search.toString()

  return result ? `?${result}` : ''
}

/** Laravel envuelve los recursos individuales en `{ data: ... }`. */
interface Resource<T> {
  data: T
}

async function resource<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const payload = await request<Resource<T>>(path, options)

  return payload.data
}

export const api = {
  me: () => resource<User>('/auth/me'),
  login: (email: string, password: string) =>
    resource<User>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
  register: (name: string, email: string, password: string, passwordConfirmation: string) =>
    resource<User>('/auth/register', {
      method: 'POST',
      body: {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      },
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  songs: (query: SongQuery = {}, signal?: AbortSignal) =>
    request<Paginated<Song>>(`/songs${toQueryString(query)}`, { signal }),
  song: (id: number) => resource<Song>(`/songs/${id}`),
  deleteSong: (id: number) => request<void>(`/songs/${id}`, { method: 'DELETE' }),

  likeSong: (id: number) => resource<Song>(`/songs/${id}/like`, { method: 'POST' }),
  unlikeSong: (id: number) => resource<Song>(`/songs/${id}/like`, { method: 'DELETE' }),
  favorites: (perPage = 50) =>
    request<Paginated<Song>>(`/me/favorites${toQueryString({ per_page: perPage })}`),

  artists: (perPage = 24) => request<Paginated<Artist>>(`/artists${toQueryString({ per_page: perPage })}`),
  artist: (id: number) => resource<Artist>(`/artists/${id}`),
  albums: (perPage = 24) => request<Paginated<Album>>(`/albums${toQueryString({ per_page: perPage })}`),
  album: (id: number) => resource<Album>(`/albums/${id}`),

  playlists: (mine = false, perPage = 50) =>
    request<Paginated<Playlist>>(
      `/playlists${toQueryString({ mine: mine ? 1 : undefined, per_page: perPage })}`,
    ),
  playlist: (id: number) => resource<Playlist>(`/playlists/${id}`),
  createPlaylist: (payload: { name: string; description?: string; is_public?: boolean }) =>
    resource<Playlist>('/playlists', { method: 'POST', body: payload }),
  updatePlaylist: (
    id: number,
    payload: { name?: string; description?: string | null; is_public?: boolean },
  ) => resource<Playlist>(`/playlists/${id}`, { method: 'PATCH', body: payload }),
  deletePlaylist: (id: number) => request<void>(`/playlists/${id}`, { method: 'DELETE' }),
  addPlaylistItem: (playlistId: number, songId: number) =>
    resource<Playlist>(`/playlists/${playlistId}/items`, {
      method: 'POST',
      body: { song_id: songId },
    }),
  removePlaylistItem: (playlistId: number, songId: number) =>
    request<void>(`/playlists/${playlistId}/items/${songId}`, { method: 'DELETE' }),
  reorderPlaylist: (playlistId: number, songIds: number[]) =>
    resource<Playlist>(`/playlists/${playlistId}/items`, {
      method: 'PUT',
      body: { song_ids: songIds },
    }),

  /**
   * Sube una imagen como portada de la playlist. El backend la convierte a
   * WebP acotado y devuelve la playlist actualizada.
   */
  uploadPlaylistCover: (playlistId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)

    return resource<Playlist>(`/playlists/${playlistId}/cover`, {
      method: 'POST',
      body: form,
    })
  },

  /**
   * Historial de reproducción del usuario, de más reciente a más antigua.
   */
  history: (perPage = 12) =>
    request<Paginated<HistoryEntry>>(`/history${toQueryString({ per_page: perPage })}`),

  /**
   * Registra una reproducción. El backend responde 202 y encola la
   * escritura: el reproductor no debe esperar a esta llamada.
   */
  recordPlay: (songId: number) =>
    request<{ data: { status: string } }>('/history', {
      method: 'POST',
      body: { song_id: songId },
    }),

  clearHistory: () => request<void>('/history', { method: 'DELETE' }),
}

/**
 * Subida con progreso real: fetch no expone el progreso de subida.
 */
export async function uploadSong(
  file: File,
  title: string | null,
  onProgress: (percent: number) => void,
): Promise<{ song: Song; deduplicated: boolean }> {
  await ensureCsrfCookie()

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()

    form.append('file', file)

    if (title) {
      form.append('title', title)
    }

    xhr.open('POST', `${API}/songs`)
    xhr.withCredentials = true
    xhr.setRequestHeader('Accept', 'application/json')

    for (const [header, value] of Object.entries(csrfHeaders())) {
      xhr.setRequestHeader(header, value)
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onerror = () => reject(new ApiError(0, 'No se pudo conectar con el servidor.'))
    xhr.onabort = () => reject(new ApiError(0, 'Subida cancelada.'))

    xhr.onload = () => {
      const payload = xhr.responseText ? (JSON.parse(xhr.responseText) as unknown) : null

      if (xhr.status >= 200 && xhr.status < 300) {
        const body = payload as Resource<Song>

        resolve({
          song: body.data,
          deduplicated: xhr.status === 200,
        })

        return
      }

      const data = payload as { message?: string; errors?: Record<string, string[]> } | null

      reject(
        new ApiError(
          xhr.status,
          data?.message ?? `Error ${xhr.status}`,
          data?.errors,
        ),
      )
    }

    xhr.send(form)
  })
}
