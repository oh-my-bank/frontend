import { useEffect, useId, useRef, type ReactNode } from 'react'
import '../styles/banking-admin.css'

/** Modal confirmation for an administrator change; it cannot be dismissed while the change is sent. */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel = '취소',
  pending = false,
  danger = false,
  confirmDisabled = false,
  extraAction,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  pendingLabel: string
  cancelLabel?: string
  pending?: boolean
  danger?: boolean
  confirmDisabled?: boolean
  extraAction?: ReactNode
  onConfirm: () => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<Element | null>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      opener.current = document.activeElement
      element.showModal()
      const oldOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = oldOverflow
      }
    }
    if (!open && element.open) element.close()
  }, [open])
  return (
    <dialog
      ref={dialog}
      className="bank-confirm-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onClose()
      }}
      onClose={(event) => {
        const previous = opener.current
        const focused = document.activeElement
        // Return focus to the opener unless the page already moved it, e.g. to an invalid input.
        const stranded =
          !focused || focused === document.body || event.currentTarget.contains(focused)
        if (stranded && previous instanceof HTMLElement && previous.isConnected) previous.focus()
        // The browser may close the dialog itself (a repeated Escape); keep the state in step.
        if (open) onClose()
      }}
    >
      <div className="bank-confirm-heading">
        <h2 id={titleId}>{title}</h2>
      </div>
      <div className="bank-confirm-body" aria-busy={pending}>
        {children}
      </div>
      <div className="bank-confirm-actions">
        {extraAction}
        <button
          type="button"
          className="button button-outline"
          onClick={onClose}
          disabled={pending}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`button ${danger ? 'button-danger' : 'button-primary'}`}
          onClick={onConfirm}
          disabled={pending || confirmDisabled}
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
