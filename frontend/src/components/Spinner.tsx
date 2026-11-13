import { Loader2 } from 'lucide-react'
import { cn } from '../lib/format'

export function Spinner({ className, label = 'Cargando' }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex">
      <Loader2 className={cn('text-accent size-5 animate-spin', className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function PageLoader({ label = 'Cargando contenido' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Spinner className="size-8" label={label} />
      <p className="text-ink-300 text-sm">{label}…</p>
    </div>
  )
}
