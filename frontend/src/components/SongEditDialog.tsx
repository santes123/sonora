import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Image as ImageIcon, Loader2, X } from 'lucide-react'
import { api, firstError } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { Cover } from './Cover'
import type { Song, SongUpdate } from '../types'

interface SongEditDialogProps {
  song: Song
  onClose: () => void
}

/**
 * Diálogo para corregir los metadatos de una canción y su carátula.
 *
 * Los campos vacíos se envían como cadenas vacías: el backend las
 * interpreta como "vaciar este dato" (por ejemplo, quitar el álbum). Un
 * campo que no se toca no se envía, y el backend lo deja como estaba.
 */
export function SongEditDialog({ song, onClose }: SongEditDialogProps) {
  const [title, setTitle] = useState(song.title)
  const [artistName, setArtistName] = useState(song.artist_name ?? '')
  const [albumTitle, setAlbumTitle] = useState(song.album_title ?? '')
  const [trackNumber, setTrackNumber] = useState(song.track_number?.toString() ?? '')
  const [discNumber, setDiscNumber] = useState(song.disc_number?.toString() ?? '')
  const [year, setYear] = useState(song.year?.toString() ?? '')
  const [genre, setGenre] = useState(song.genre ?? '')
  const [coverPreview, setCoverPreview] = useState<string | null>(song.cover_url)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const toast = useToast()
  const queryClient = useQueryClient()

  // Cierra con Escape y avisa del clic fuera del cuadro.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!dialogRef.current?.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [onClose])

  const update = useMutation({
    mutationFn: (changes: SongUpdate) => api.updateSong(song.id, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
      toast.success('Canción actualizada.')
      onClose()
    },
    onError: (error) => toast.error(firstError(error)),
  })

  const uploadCover = useMutation({
    mutationFn: (file: File) => api.updateSongCover(song.id, file),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
      setCoverPreview(updated.cover_url)
      toast.success('Carátula actualizada.')
    },
    onError: (error) => {
      // Vuelve a la carátula anterior: el fichero no se ha guardado.
      setCoverPreview(song.cover_url)
      toast.error(firstError(error))
    },
  })

  const handleCoverChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    // Permite volver a elegir el mismo fichero.
    event.target.value = ''

    if (!file) {
      return
    }

    // La carátula se sube al momento: no depende de guardar los metadatos.
    setCoverPreview(URL.createObjectURL(file))
    uploadCover.mutate(file)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const changes: SongUpdate = {
      title: title.trim(),
      artist_name: artistName.trim(),
      album_title: albumTitle.trim(),
      track_number: trackNumber.trim() === '' ? null : Number(trackNumber),
      disc_number: discNumber.trim() === '' ? null : Number(discNumber),
      year: year.trim() === '' ? null : Number(year),
      genre: genre.trim(),
    }

    update.mutate(changes)
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="song-edit-title"
    >
      <div
        ref={dialogRef}
        className="bg-ink-900 border-ink-700 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="song-edit-title" className="text-lg font-bold text-white">
              Editar canción
            </h2>
            <p className="text-ink-300 mt-1 text-sm">
              Corrige el título, el artista, el álbum… y cambia la carátula si hace falta.
            </p>
          </div>

          <button type="button" onClick={onClose} className="icon-btn" aria-label="Cerrar">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="flex items-center gap-4">
            <Cover
              src={coverPreview}
              alt=""
              className="size-20"
              rounded="rounded-xl"
              iconClassName="size-6"
            />

            <div>
              <input
                ref={fileInputRef}
                id="song-cover-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                onChange={handleCoverChange}
                className="sr-only"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-ghost"
                disabled={uploadCover.isPending}
              >
                {uploadCover.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ImageIcon className="size-4" aria-hidden="true" />
                )}
                Subir carátula
              </button>

              <p className="text-ink-400 mt-1 text-xs">
                JPEG, PNG o WebP. Se convierte a WebP automáticamente.
              </p>
            </div>
          </div>

          <label className="block">
            <span className="text-ink-200 text-sm font-medium">Título</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={255}
              className="field mt-1"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-ink-200 text-sm font-medium">Artista</span>
              <input
                type="text"
                value={artistName}
                onChange={(event) => setArtistName(event.target.value)}
                required
                maxLength={255}
                className="field mt-1"
              />
            </label>

            <label className="block">
              <span className="text-ink-200 text-sm font-medium">Álbum</span>
              <input
                type="text"
                value={albumTitle}
                onChange={(event) => setAlbumTitle(event.target.value)}
                maxLength={255}
                className="field mt-1"
                placeholder="Sin álbum"
              />
            </label>

            <label className="block">
              <span className="text-ink-200 text-sm font-medium">Pista</span>
              <input
                type="number"
                min={1}
                max={9999}
                value={trackNumber}
                onChange={(event) => setTrackNumber(event.target.value)}
                className="field mt-1"
              />
            </label>

            <label className="block">
              <span className="text-ink-200 text-sm font-medium">Disco</span>
              <input
                type="number"
                min={1}
                max={9999}
                value={discNumber}
                onChange={(event) => setDiscNumber(event.target.value)}
                className="field mt-1"
              />
            </label>

            <label className="block">
              <span className="text-ink-200 text-sm font-medium">Año</span>
              <input
                type="number"
                min={1900}
                max={2100}
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="field mt-1"
              />
            </label>

            <label className="block">
              <span className="text-ink-200 text-sm font-medium">Género</span>
              <input
                type="text"
                value={genre}
                onChange={(event) => setGenre(event.target.value)}
                maxLength={100}
                className="field mt-1"
                placeholder="Sin género"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={update.isPending}>
              {update.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
