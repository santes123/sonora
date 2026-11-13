export type UserRole = 'user' | 'admin'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  avatar_url: string | null
  created_at: string | null
}

export interface Artist {
  id: number
  name: string
  bio?: string | null
  image_url: string | null
  songs_count?: number
  albums_count?: number
  albums?: Album[]
  songs?: Song[]
  created_at: string | null
}

export interface Album {
  id: number
  title: string
  year: number | null
  cover_url: string | null
  songs_count?: number
  artist?: Artist
  songs?: Song[]
  created_at: string | null
}

export interface Song {
  id: number
  title: string
  artist_name: string | null
  album_title: string | null
  track_number: number | null
  disc_number: number | null
  year: number | null
  genre: string | null
  duration_ms: number
  cover_url: string | null
  stream_url: string | null
  is_liked: boolean
  artist?: Artist
  album?: Album
  uploader?: User
  created_at: string | null
}

/**
 * Una entrada del historial de reproducción: la forma de la canción más
 * cuándo se escuchó por última vez y cuántas veces se ha escuchado.
 */
export interface HistoryEntry extends Song {
  played_at: string | null
  play_count: number
}

export interface PlaylistItem {
  id: number
  position: number
  song?: Song
}

export interface Playlist {
  id: number
  name: string
  description: string | null
  is_public: boolean
  songs_count: number
  duration_ms: number
  cover_url: string | null
  user?: User
  items?: PlaylistItem[]
  updated_at: string | null
  created_at: string | null
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

export interface SongQuery {
  q?: string
  artist_id?: number
  album_id?: number
  liked?: 1
  sort?: 'newest' | 'title' | 'artist' | 'duration'
  per_page?: number
  page?: number
}

/**
 * URL firmada de descarga de una canción.
 *
 * La capacidad es la propia URL: caduca a las pocas horas, así que solo
 * sirve para el momento de la descarga. Después el audio vive en la caché
 * del navegador.
 */
export interface DownloadUrl {
  song_id: number
  url: string
  bytes: number
}

export interface UploadResult {
  song: Song
  deduplicated: boolean
}
