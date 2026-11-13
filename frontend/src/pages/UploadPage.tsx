import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileAudio, Loader2, Play, Upload, X } from 'lucide-react'
import { Cover } from '../components/Cover'
import { usePlayer } from '../context/PlayerContext'
import { useToast } from '../context/ToastContext'
import { firstError, uploadSong } from '../lib/api'
import { formatDuration } from '../lib/format'
import type { Song } from '../types'

const MAX_BYTES = 256 * 1024 * 1024
const ACCEPT = '.mp3,.flac,.m4a,.mp4,.aac,.ogg,.opus,.wav,audio/*'

function humanSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadPage() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ song: Song; deduplicated: boolean } | null>(null)
  const toast = useToast()
  const queryClient = useQueryClient()
  const { playQueue } = usePlayer()

  const selectFile = (candidate: File | null) => {
    if (!candidate) {
      return
    }

    if (candidate.size > MAX_BYTES) {
      toast.error('El archivo supera el límite de 256 MB.')
      return
    }

    setFile(candidate)
    setResult(null)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    selectFile(event.dataTransfer.files[0] ?? null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!file) {
      toast.error('Selecciona un archivo de audio.')
      return
    }

    setPending(true)
    setProgress(0)
    setResult(null)

    try {
      const uploaded = await uploadSong(file, title.trim() || null, setProgress)
      setResult(uploaded)
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })

      if (uploaded.deduplicated) {
        toast.info('Ese archivo ya existía: se ha reutilizado sin duplicarlo.')
      } else {
        toast.success('Canción subida correctamente.')
      }

      setFile(null)
      setTitle('')

      if (inputRef.current) {
        inputRef.current.value = ''
      }
    } catch (error) {
      toast.error(firstError(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Subir música</h1>
        <p className="text-ink-300 mt-1 text-sm">
          Aceptamos MP3, FLAC, M4A, AAC, OGG, Opus y WAV sin transcodificar. Detectamos los
          metadatos y deduplicamos por SHA-256.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5 p-5 sm:p-6">
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={
            dragging
              ? 'border-accent bg-accent/10 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center'
              : 'border-ink-600 hover:border-ink-500 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors'
          }
        >
          <div className="bg-ink-800 text-accent-soft flex size-14 items-center justify-center rounded-2xl">
            <FileAudio className="size-7" aria-hidden="true" />
          </div>

          {file ? (
            <div className="space-y-1">
              <p className="font-medium break-all text-white">{file.name}</p>
              <p className="text-ink-400 text-sm">{humanSize(file.size)}</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-medium text-white">Arrastra un archivo aquí</p>
              <p className="text-ink-400 text-sm">o selecciónalo desde tu dispositivo</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn-outline"
              disabled={pending}
            >
              <Upload className="size-4" aria-hidden="true" />
              {file ? 'Cambiar archivo' : 'Elegir archivo'}
            </button>

            {file ? (
              <button
                type="button"
                onClick={() => {
                  setFile(null)

                  if (inputRef.current) {
                    inputRef.current.value = ''
                  }
                }}
                className="btn-ghost"
                disabled={pending}
              >
                <X className="size-4" aria-hidden="true" />
                Quitar
              </button>
            ) : null}
          </div>

          <input
            ref={inputRef}
            id="song-file"
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            disabled={pending}
          />
          <label htmlFor="song-file" className="sr-only">
            Archivo de audio
          </label>
        </div>

        <div>
          <label htmlFor="song-title" className="label">
            Título <span className="text-ink-400 font-normal">(opcional)</span>
          </label>
          <input
            id="song-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="field"
            maxLength={255}
            placeholder="Se detecta automáticamente desde los metadatos"
            disabled={pending}
          />
        </div>

        {pending ? (
          <div>
            <div className="text-ink-300 mb-1 flex items-center justify-between text-xs">
              <span>Subiendo…</span>
              <span>{progress}%</span>
            </div>
            <div
              className="bg-ink-700 h-2 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Progreso de la subida"
            >
              <div
                className="bg-accent h-full transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={!file || pending} className="btn-primary">
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="size-4" aria-hidden="true" />
            )}
            {pending ? 'Subiendo…' : 'Subir canción'}
          </button>
          <Link to="/" className="btn-ghost">
            Volver al inicio
          </Link>
        </div>

        <p className="text-ink-400 text-xs">
          Límite: 256 MB por archivo. La carátula se extrae en segundo plano y puede tardar unos
          segundos en aparecer.
        </p>
      </form>

      {result ? (
        <section className="card border-emerald-500/30 bg-emerald-500/5 p-5" aria-labelledby="upload-result">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 id="upload-result" className="font-semibold text-white">
                {result.deduplicated ? 'Archivo ya existente' : 'Canción añadida al catálogo'}
              </h2>
              <p className="text-ink-300 mt-1 text-sm">
                {result.deduplicated
                  ? 'El audio era idéntico a una canción existente; no se ha duplicado.'
                  : 'Ya está disponible para toda la comunidad.'}
              </p>

              <div className="mt-4 flex items-center gap-3">
                <Cover
                  src={result.song.cover_url}
                  alt={`Portada de ${result.song.title}`}
                  className="size-14"
                  rounded="rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{result.song.title}</p>
                  <p className="text-ink-300 truncate text-sm">
                    {result.song.artist_name ?? 'Artista desconocido'} ·{' '}
                    {formatDuration(result.song.duration_ms)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => playQueue([result.song], 0)}
                  className="btn-primary shrink-0"
                >
                  <Play className="size-4 fill-current" aria-hidden="true" />
                  Reproducir
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/search" className="btn-outline">
                  Ver catálogo
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null)
                    inputRef.current?.click()
                  }}
                  className="btn-ghost"
                >
                  Subir otra
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
