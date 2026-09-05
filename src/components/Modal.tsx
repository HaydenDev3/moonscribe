import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Small shared modal with Esc-to-close and overlay click.
export default function Modal({ open, onClose, title, children, width, className = '' }) {
  const [rendered, setRendered] = useState(open)
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef(null)
  const modalRef = useRef(null)
  const previousActiveRef = useRef(null)

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
    previousActiveRef.current = document.activeElement
    const focusTimer = window.setTimeout(() => modalRef.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus(), 0)
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !modalRef.current) return
      const focusable = [...modalRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((item) => !item.disabled)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.clearTimeout(focusTimer); window.removeEventListener('keydown', onKey); if (previousActiveRef.current instanceof HTMLElement) previousActiveRef.current.focus() }
  }, [open, onClose])

  if (!rendered) return null

  return createPortal(
    <div className={`modal-overlay${closing ? ' is-closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} className={`modal ${closing ? 'is-closing' : ''} ${className}`.trim()} style={width ? { maxWidth: width } : undefined} role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
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
