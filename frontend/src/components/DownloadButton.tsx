import { Check, Download, Loader2, Trash2 } from 'lucide-react'
import { useOffline } from '../context/OfflineContext'
import { useToast } from '../context/ToastContext'
import { firstError } from '../lib/api'
import { cn } from '../lib/format'
import type { Song } from '../types'

interface DownloadButtonProps {
  song: Song
  className?: string
}

/**
 * Botón de descarga offline.
 *
 * Un solo control con tres estados: descargar, descargando y descargado
 * (que pasa a permitir borrar). La descarga se hace en segundo plano: la
 * interfaz no se bloquea y el error se comunica con un aviso.
 */
export function DownloadButton({ song, className }: DownloadButtonProps) {
  const { isDownloaded, downloadSong, removeSong, downloading } = useOffline()
  const toast = useToast()

  const downloaded = isDownloaded(song.id)
  const busy = downloading.includes(song.id)

  const label = downloaded
    ? `Quitar «${song.title}» de tus descargas`
    : `Descargar «${song.title}» para usarla sin conexión`

  const handleClick = async () => {
    try {
      if (downloaded) {
        await removeSong(song.id)
        toast.info('Descarga eliminada.')

        return
      }

      await downloadSong(song)
      toast.success(`«${song.title}» descargada.`)
    } catch (error) {
      toast.error(firstError(error))
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        void handleClick()
      }}
      disabled={busy}
      className={cn('icon-btn', downloaded && 'text-emerald-400', className)}
      aria-label={label}
      aria-pressed={downloaded}
      title={downloaded ? 'Quitar de tus descargas' : 'Descargar para usar sin conexión'}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : downloaded ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
    </button>
  )
}

/**
 * Botón para quitar una descarga concreta (listado de descargas).
 *
 * Es un control distinto del anterior porque aquí la acción principal de la
 * fila no es descargar, sino quitar.
 */
export function RemoveDownloadButton({ songId, title }: { songId: number; title: string }) {
  const { removeSong } = useOffline()
  const toast = useToast()

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        void removeSong(songId)
          .then(() => toast.info('Descarga eliminada.'))
          .catch((error: unknown) => toast.error(firstError(error)))
      }}
      className="icon-btn hover:text-red-300"
      aria-label={`Quitar «${title}» de tus descargas`}
      title="Quitar de tus descargas"
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </button>
  )
}
