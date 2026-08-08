import { DESIGNS, DESIGN_MIME } from '../designs/registry'
import Icon from './Icon'

// A palette of premade design packs. Cards are draggable (HTML5 drag & drop)
// and clickable — drop them on the cover or the chapter editor to apply.
export default function DesignPalette({ activeId, compact = false, onPick }) {
  const dragStart = (e, d) => {
    e.dataTransfer.setData(DESIGN_MIME, d.id)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', d.name)
  }

  return (
    <div className={`design-palette ${compact ? 'compact' : ''}`}>
      {DESIGNS.map((d) => (
        <button
          key={d.id}
          className={`design-card ${activeId === d.id ? 'active' : ''}`}
          draggable
          onDragStart={(e) => dragStart(e, d)}
          onClick={() => onPick?.(d.id)}
          title={`${d.name} — ${d.blurb}. Drag onto the cover or the page.`}
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
  )
}
