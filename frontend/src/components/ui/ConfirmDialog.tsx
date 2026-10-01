import { useEffect, useRef, type ReactNode } from 'react'
import HexButton, { type HexVariant } from './HexButton'

interface Props {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel?: string
  confirmVariant?: HexVariant // 'danger' para ações destrutivas
  cancelLabel?: string
  busy?: boolean
  onConfirm?: () => void
  onCancel: () => void
  // Rodapé próprio no lugar de Cancelar/Confirmar (ex.: escolher entre várias opções).
  actions?: ReactNode
}

// Modal de confirmação. Fecha com Esc ou clicando fora.
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirmar',
  confirmVariant = 'primary',
  cancelLabel = 'Cancelar',
  busy,
  onConfirm,
  onCancel,
  actions,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" onClick={onCancel} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-phase-in relative w-full max-w-sm rounded-xl border border-rim bg-abyss p-6 text-center"
      >
        <h2 id="confirm-dialog-title" className="font-display text-xl text-gold-50">
          {title}
        </h2>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6">
          {actions ?? (
            <div className="grid grid-cols-2 gap-3">
              <HexButton variant="secondary" onClick={onCancel} disabled={busy}>
                {cancelLabel}
              </HexButton>
              <HexButton ref={confirmRef} variant={confirmVariant} onClick={onConfirm} disabled={busy}>
                {confirmLabel}
              </HexButton>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
