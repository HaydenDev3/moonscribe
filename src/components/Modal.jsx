import { useEffect } from 'react'
import { createPortal } from 'react-dom'

// Small shared modal with Esc-to-close and overlay click.
export default function Modal({ open, onClose, title, children, width }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { maxWidth: width } : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <button className="close-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  )
}
