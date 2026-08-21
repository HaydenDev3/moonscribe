import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Small shared modal with Esc-to-close and overlay click.
export default function Modal({ open, onClose, title, children, width, className = '' }) {
  const [rendered, setRendered] = useState(open)
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef(null)

  useEffect(() => {
    if (open) {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
      setRendered(true)
      setClosing(false)
      return
    }
    if (!rendered) return
    setClosing(true)
    closeTimer.current = setTimeout(() => {
      setRendered(false)
      setClosing(false)
      closeTimer.current = null
    }, 180)
  }, [open, rendered])

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!rendered) return null

  return createPortal(
    <div className={`modal-overlay${closing ? ' is-closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${closing ? 'is-closing' : ''} ${className}`.trim()} style={width ? { maxWidth: width } : undefined} role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
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
