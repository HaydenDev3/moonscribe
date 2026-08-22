import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

export type SelectOption = {
  value: string
  label: string
  group?: string
  hint?: string
  style?: CSSProperties
}

type SelectProps = {
  value: string
  onChange: (value: string) => void
  options?: SelectOption[]
  ariaLabel?: string
  width?: number | string
  onMouseDown?: (event: React.MouseEvent<HTMLButtonElement>) => void
  renderLabel?: (option?: SelectOption) => ReactNode
  className?: string
  popClassName?: string
  disabled?: boolean
}

// A themed dropdown that replaces the native <select> so menus match the app.
// options: [{ value, label, hint? }]. Values are compared as strings.
// The popup is portalled to <body> so it is never clipped by overflow:hidden panels.
export default function Select({ value, onChange, options = [], ariaLabel = 'Select', width = 180, onMouseDown: onMD, renderLabel, className = '', popClassName = '', disabled = false }: SelectProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [rect, setRect] = useState(null)
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const current = options.find((o) => String(o.value) === String(value)) || options[0]

  useEffect(() => {
    if (!open) return
    const i = options.findIndex((o) => String(o.value) === String(value))
    setActive(i < 0 ? 0 : i)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (open && btnRef.current) {
      setRect(btnRef.current.getBoundingClientRect())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onScroll = () => {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    }
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [open])

  useEffect(() => {
    if (!open || !popRef.current) return
    const node = popRef.current
    const stopWheelLeak = (event) => event.stopPropagation()
    node.addEventListener('wheel', stopWheelLeak, { passive: true })
    return () => node.removeEventListener('wheel', stopWheelLeak)
  }, [open])

  const choose = (o) => { onChange?.(o.value); setOpen(false); btnRef.current?.focus() }

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (options[active]) choose(options[active])
    }
  }

  const popupStyle: React.CSSProperties = rect
    ? {
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        minWidth: rect.width,
        zIndex: 9999,
      }
    : { position: 'fixed', top: -9999, left: -9999 }

  return (
    <div className={`cselect ${className}`.trim()} style={{ width }}>
      <button
        ref={btnRef}
        type="button"
        className={`cselect-field ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onMouseDown={(e) => onMD?.(e)}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        onWheel={(e) => e.stopPropagation()}
      >
        <span className="cselect-value">{renderLabel ? renderLabel(current) : (current?.label ?? '—')}</span>
        <Icon icon="fa-solid fa-chevron-down" className="cselect-caret" />
      </button>
      {open && createPortal(
        <>
          <div className="cselect-scrim" onClick={() => setOpen(false)} />
          <ul ref={popRef} className={`cselect-pop cselect-pop-portal ${popClassName}`.trim()} role="listbox" aria-label={ariaLabel} style={popupStyle} onWheel={(e) => e.stopPropagation()}>
            {options.map((o, i) => {
              const showGroup = o.group && (i === 0 || options[i - 1].group !== o.group)
              return (
                <li key={String(o.value)}>
                  {showGroup && <div className="cselect-group-label">{o.group}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={String(o.value) === String(value)}
                    className={`cselect-option ${i === active ? 'active' : ''} ${String(o.value) === String(value) ? 'selected' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                  >
                    <span className="cselect-option-label" style={o.style}>{o.label}</span>
                    {o.hint && <span className="cselect-option-hint">{o.hint}</span>}
                    {String(o.value) === String(value) && <Icon icon="fa-solid fa-check" className="cselect-check" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </>,
        document.body
      )}
    </div>
  )
}
