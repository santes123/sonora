import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="bg-ink-800 text-accent-soft flex size-14 items-center justify-center rounded-2xl">
        <Icon className="size-7" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description ? <p className="text-ink-300 max-w-md text-sm">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
