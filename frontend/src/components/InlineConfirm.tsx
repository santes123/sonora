import { useState, type ReactNode } from 'react'

/**
 * Confirmación en línea para acciones destructivas.
 *
 * Sustituye a `window.confirm`: el diálogo nativo bloquea el hilo principal
 * de la página, no se puede estilar con el lenguaje visual de la app y en
 * una PWA instalada se comporta como un popup del sistema, no como parte de
 * la interfaz. Con este patrón el botón se sustituye en el sitio por la
 * pregunta y sus dos acciones, sin sacar al usuario de la pantalla.
 *
 * El estado se reinicia al cancelar o al confirmar, de modo que el mismo
 * disparador puede volver a usarse más tarde.
 */
interface InlineConfirmProps {
  /** Pregunta que se muestra junto a los botones. */
  question: string
  /** Etiqueta del botón que confirma la acción. */
  confirmLabel: string
  /** Etiqueta del botón que cancela la acción. */
  cancelLabel?: string
  /** Se ejecuta al confirmar. */
  onConfirm: () => void
  /** Deshabilita el disparador y el botón de confirmación. */
  disabled?: boolean
  /** Icono del disparador. */
  icon?: ReactNode
  /** Etiqueta del disparador. */
  triggerLabel: string
  /** Clases del disparador. */
  triggerClassName?: string
  /** Clases del botón de confirmación. */
  confirmClassName?: string
  /** Clases de la pregunta. */
  questionClassName?: string
}

export function InlineConfirm({
  question,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  disabled = false,
  icon,
  triggerLabel,
  triggerClassName = '',
  confirmClassName = 'text-red-300 hover:text-red-200 font-semibold transition-colors disabled:opacity-50',
  questionClassName = 'text-ink-300 text-xs',
}: InlineConfirmProps) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={triggerClassName}
      >
        {icon}
        {triggerLabel}
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className={questionClassName}>{question}</span>

      <button
        type="button"
        onClick={() => {
          setOpen(false)
          onConfirm()
        }}
        disabled={disabled}
        className={confirmClassName}
      >
        {confirmLabel}
      </button>

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-ink-400 hover:text-ink-100 text-xs transition-colors"
      >
        {cancelLabel}
      </button>
    </span>
  )
}
