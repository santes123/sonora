import { Download, HardDriveDownload, Play, ShieldCheck, Trash2 } from 'lucide-react'
import { Cover } from '../components/Cover'
import { EmptyState } from '../components/EmptyState'
import { InlineConfirm } from '../components/InlineConfirm'
import { RemoveDownloadButton } from '../components/DownloadButton'
import { useOffline } from '../context/OfflineContext'
import { usePlayer } from '../context/PlayerContext'
import { useToast } from '../context/ToastContext'
import { formatBytes } from '../offline/quota'
import { songFromDownload } from '../offline/song'
import { formatDate, formatDuration, pluralize } from '../lib/format'

/**
 * Página de descargas offline.
 *
 * Lista lo que se ha guardado en el dispositivo, cuánto ocupa y cuánto
 * queda. Al reproducir desde aquí, las canciones suenan igual con o sin
 * conexión: el service worker las sirve desde la caché.
 */
export function DownloadsPage() {
  const { downloads, budget, persisted, removeAll, supported } = useOffline()
  const { playQueue } = usePlayer()
  const toast = useToast()

  const songs = downloads.map(songFromDownload)

  const handlePlayAll = () => {
    if (songs.length > 0) {
      playQueue(songs, 0)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Descargas</h1>
          <p className="text-ink-300 mt-1 text-sm">
            {downloads.length > 0
              ? `${pluralize(downloads.length, 'canción guardada', 'canciones guardadas')} · ${formatBytes(budget.used)}.`
              : 'Guarda música en el dispositivo para escucharla sin conexión.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {songs.length > 0 ? (
            <button type="button" onClick={handlePlayAll} className="btn-outline">
              <Play className="size-4 fill-current" aria-hidden="true" />
              Reproducir todo
            </button>
          ) : null}

          {downloads.length > 0 ? (
            <InlineConfirm
              question="¿Borrar todas las descargas?"
              confirmLabel="Sí, borrar"
              onConfirm={() => {
                void removeAll().then(() => toast.info('Descargas borradas.'))
              }}
              icon={<Trash2 className="size-4" aria-hidden="true" />}
              triggerLabel="Liberar espacio"
              triggerClassName="btn-ghost text-red-300 hover:bg-red-500/10 hover:text-red-200"
              confirmClassName="btn-ghost text-red-300 hover:bg-red-500/10 hover:text-red-200"
              questionClassName="text-ink-200 text-sm"
            />
          ) : null}
        </div>
      </div>

      {!supported ? (
        <div className="border-amber-500/40 bg-amber-500/10 text-amber-100 rounded-xl border px-4 py-3 text-sm">
          Este navegador no permite guardar música sin conexión. Instala la aplicación (PWA) para
          poder hacerlo.
        </div>
      ) : null}

      {downloads.length > 0 ? (
        <div className="card flex flex-wrap items-center gap-4 p-4 text-sm">
          <span className="text-ink-200 inline-flex items-center gap-2">
            <HardDriveDownload className="size-4 text-accent-soft" aria-hidden="true" />
            {formatBytes(budget.used)} usados de {formatBytes(budget.limit)} disponibles
          </span>

          <span
            className={
              persisted
                ? 'text-emerald-300 inline-flex items-center gap-1.5'
                : 'text-ink-300 inline-flex items-center gap-1.5'
            }
          >
            {persisted ? (
              <>
                <ShieldCheck className="size-4" aria-hidden="true" />
                Almacenamiento persistente: el navegador no borrará tus descargas.
              </>
            ) : (
              'El navegador puede borrar las descargas si necesita espacio.'
            )}
          </span>
        </div>
      ) : null}

      {downloads.length === 0 ? (
        <EmptyState
          icon={Download}
          title="Todavía no has descargado nada"
          description="Pulsa el botón de descarga en cualquier canción o descarga una playlist entera desde su página."
        />
      ) : (
        <ul className="space-y-1">
          {downloads.map((download, index) => (
            <li
              key={download.songId}
              className="hover:bg-ink-800/70 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors"
            >
              <button
                type="button"
                onClick={() => playQueue([songFromDownload(download)], 0)}
                className="text-ink-300 hover:text-white shrink-0 text-sm tabular-nums"
                aria-label={`Reproducir ${download.title}`}
              >
                {index + 1}
              </button>

              <Cover
                src={download.coverCacheKey ?? download.coverUrl}
                alt=""
                className="size-10"
                rounded="rounded-lg"
                iconClassName="size-4"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{download.title}</p>
                <p className="text-ink-300 truncate text-sm">
                  {download.artistName ?? 'Artista desconocido'}
                  {download.albumTitle ? ` · ${download.albumTitle}` : ''}
                </p>
              </div>

              <p className="text-ink-400 hidden text-xs tabular-nums sm:block">
                {formatDuration(download.durationMs)}
              </p>
              <p className="text-ink-400 hidden text-xs tabular-nums md:block">
                {formatBytes(download.bytes)}
              </p>
              <p className="text-ink-400 hidden text-xs lg:block">
                {formatDate(new Date(download.cachedAt).toISOString())}
              </p>

              <RemoveDownloadButton songId={download.songId} title={download.title} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
