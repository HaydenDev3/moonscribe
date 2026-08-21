import { useState } from 'react'
import { DESIGNS, DESIGN_MIME } from '../designs/registry'
import Icon from './Icon'

const PAGE_SIZE = 4

export default function DesignPalette({ activeId, compact = false, onPick }) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(DESIGNS.length / PAGE_SIZE)
  const slice = DESIGNS.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const dragStart = (e, d) => {
    e.dataTransfer.setData(DESIGN_MIME, d.id)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', d.name)
  }

  return (
    <div className={`design-palette-wrap ${compact ? 'compact' : ''}`}>
      <div className={`design-palette ${compact ? 'compact' : ''}`}>
        {slice.map((d) => (
          <button
            key={d.id}
            className={`design-card ${activeId === d.id ? 'active' : ''}`}
            draggable
            onDragStart={(e) => dragStart(e, d)}
            onClick={() => onPick?.(d.id)}
            title={`${d.name} — ${d.blurb}. Click to apply, or drag onto the page.`}
          >
            <span className="design-swatches">
              {d.swatches.map((c) => (
                <span key={c} className="swatch" style={{ background: c }} />
              ))}
            </span>
            <span className="design-name">{d.name}</span>
            <span className="design-blurb">{d.blurb}</span>
            <span className="design-drag-hint"><Icon icon="fa-solid fa-up-right-from-square" /></span>
          </button>
        ))}
      </div>

      {/* Carousel nav */}
      <div className="design-palette-nav">
        <button
          className="design-nav-btn"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          aria-label="Previous designs"
        >
          <Icon icon="fa-solid fa-chevron-left" />
        </button>

        <div className="design-nav-dots">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={`design-nav-dot ${i === page ? 'active' : ''}`}
              onClick={() => setPage(i)}
              aria-label={`Page ${i + 1}`}
            />
          ))}
        </div>

        <button
          className="design-nav-btn"
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page === totalPages - 1}
          aria-label="Next designs"
        >
          <Icon icon="fa-solid fa-chevron-right" />
        </button>
      </div>

      <p className="design-palette-hint">Click to apply, or drag onto the page.</p>
    </div>
  )
}
