import type { ReactNode } from 'react'
import { AudioLines, Headphones, ListMusic, WifiOff } from 'lucide-react'

interface AuthShellProps {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="from-accent/25 via-ink-950 to-ink-950 relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br p-12 lg:flex">
        <div
          className="from-accent/30 to-hot/20 absolute -top-24 -left-24 size-96 rounded-full bg-gradient-to-br blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <span className="from-accent to-hot flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br shadow-xl">
            <AudioLines className="size-6 text-white" aria-hidden="true" />
          </span>
          <span className="text-xl font-bold tracking-tight text-white">Sonora</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl leading-tight font-bold text-white">
            Tu música, tu biblioteca, en cualquier dispositivo.
          </h1>
          <p className="text-ink-200 mt-4 text-base">
            Un catálogo comunitario con playlists privadas, streaming con búsqueda por acentos y
            una PWA instalable.
          </p>

          <ul className="text-ink-200 mt-8 space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <Headphones className="text-accent-soft size-5" aria-hidden="true" />
              Reproductor global con controles del sistema
            </li>
            <li className="flex items-center gap-3">
              <ListMusic className="text-accent-soft size-5" aria-hidden="true" />
              Playlists propias con reordenación
            </li>
            <li className="flex items-center gap-3">
              <WifiOff className="text-accent-soft size-5" aria-hidden="true" />
              Instalable como app, con soporte offline en camino
            </li>
          </ul>
        </div>

        <p className="text-ink-500 relative text-xs">
          Sube MP3, FLAC, M4A, AAC, OGG o WAV. Sin transcodificar.
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="from-accent to-hot flex size-10 items-center justify-center rounded-xl bg-gradient-to-br">
              <AudioLines className="size-5 text-white" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold text-white">Sonora</span>
          </div>

          <h2 className="text-2xl font-bold text-white sm:text-3xl">{title}</h2>
          <p className="text-ink-300 mt-2 text-sm">{subtitle}</p>

          <div className="mt-8">{children}</div>

          <div className="text-ink-300 mt-8 text-sm">{footer}</div>
        </div>
      </div>
    </div>
  )
}
