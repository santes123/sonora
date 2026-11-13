import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '../lib/format'

type ToastTone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  tone: ToastTone
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneStyles: Record<ToastTone, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  error: 'border-red-500/40 bg-red-500/10 text-red-100',
  info: 'border-accent/40 bg-accent/10 text-ink-100',
}

const toneIcons: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-3), { id, tone, message }])
      window.setTimeout(() => dismiss(id), 4500)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        role="status"
      >
        {toasts.map((toast) => {
          const Icon = toneIcons[toast.tone]

          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur',
                toneStyles[toast.tone],
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p className="flex-1">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
                aria-label="Cerrar aviso"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast debe usarse dentro de ToastProvider')
  }

  return context
}
