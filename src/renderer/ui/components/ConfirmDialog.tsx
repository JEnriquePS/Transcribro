import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmDialogProps {
  readonly isOpen: boolean
  readonly title: string
  readonly message: string
  readonly confirmLabel: string
  readonly cancelLabel?: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly variant?: 'danger' | 'default'
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = 'confirm-dialog-title'

  useEffect(() => {
    if (isOpen) {
      cancelRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const confirmButtonClasses =
    variant === 'danger'
      ? 'bg-red-500 hover:bg-red-600 text-white'
      : 'bg-accent hover:bg-accent-hover text-text-inverse'

  return createPortal(
    <div className="fixed inset-0 z-30 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-surface-overlay"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-40 bg-surface-elevated rounded-xl shadow-2xl max-w-md w-full mx-4 p-6"
      >
        <h2 id={titleId} className="text-lg font-semibold text-text-primary">
          {title}
        </h2>
        <p className="mt-2 text-sm text-text-secondary">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-surface-elevated text-text-primary hover:bg-border-default transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated ${confirmButtonClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
