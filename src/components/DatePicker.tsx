import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'

// A small, themed calendar. Replaces the native <input type="date"> so the
// picker matches MoonScribe rather than the OS. Value is an ISO date string
// (yyyy-mm-dd) or '' — kept in local time so the day never drifts.
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseISO(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export default function DatePicker({ value, onChange, placeholder = 'Pick a date', ariaLabel = 'Date' }) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => parseISO(value), [value])
  const [view, setView] = useState(() => selected || new Date())

  useEffect(() => {
    if (open) setView(selected || new Date())
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const label = selected
    ? selected.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder

  const todayISO = toISO(new Date())

  const weeks = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay()) // back up to the Sunday on/ before the 1st
    const cells = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      cells.push(d)
    }
    const rows = []
    for (let i = 0; i < 6; i++) rows.push(cells.slice(i * 7, i * 7 + 7))
    return rows
  }, [view])

  const pick = (d) => {
    onChange?.(toISO(d))
    setOpen(false)
  }
  const shift = (n) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1))

  return (
    <div className="datepicker">
      <button
        type="button"
        className={`date-field ${selected ? '' : 'empty'}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon icon="fa-regular fa-calendar" />
        <span className="date-field-label">{label}</span>
        {selected && (
          <span
            className="date-field-clear"
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            onClick={(e) => { e.stopPropagation(); onChange?.('') }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onChange?.('') } }}
          >
            <Icon icon="fa-solid fa-xmark" />
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="dp-scrim" onClick={() => setOpen(false)} />
          <div className="datepicker-pop" role="dialog" aria-label="Choose a date">
            <div className="dp-head">
              <button type="button" className="dp-nav" onClick={() => shift(-1)} aria-label="Previous month">
                <Icon icon="fa-solid fa-chevron-left" />
              </button>
              <span className="dp-title">{MONTHS[view.getMonth()]} {view.getFullYear()}</span>
              <button type="button" className="dp-nav" onClick={() => shift(1)} aria-label="Next month">
                <Icon icon="fa-solid fa-chevron-right" />
              </button>
            </div>
            <div className="dp-grid dp-weekdays">
              {WEEKDAYS.map((w) => <span key={w} className="dp-weekday">{w}</span>)}
            </div>
            <div className="dp-grid">
              {weeks.flat().map((d) => {
                const iso = toISO(d)
                const outside = d.getMonth() !== view.getMonth()
                return (
                  <button
                    type="button"
                    key={iso}
                    className={`dp-day ${outside ? 'outside' : ''} ${iso === value ? 'selected' : ''} ${iso === todayISO ? 'today' : ''}`}
                    onClick={() => pick(d)}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
            <div className="dp-foot">
              <button type="button" className="dp-quick" onClick={() => pick(new Date())}>Today</button>
              {value && <button type="button" className="dp-quick" onClick={() => { onChange?.(''); setOpen(false) }}>Clear</button>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
