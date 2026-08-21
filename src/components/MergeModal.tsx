import { useState } from 'react'
import Modal from './Modal'
import { formatWords } from '../utils/words'

// Merge two chapters at a clean seam. The source chapter is absorbed and
// removed; the surviving chapter keeps its own title.
export default function MergeModal({ source, chapters, onClose, onMerge }) {
  const [direction, setDirection] = useState('into-current')
  const [targetId, setTargetId] = useState('')
  const [separator, setSeparator] = useState('scene-break')

  if (!source) return null
  const others = chapters.filter((c) => c.id !== source.id)
  const target = others.find((c) => c.id === targetId) || others[0]

  const keep = direction === 'into-current' ? source : target
  const absorb = direction === 'into-current' ? target : source

  const handleSave = () => {
    if (!target) return
    onMerge(direction, target.id, separator)
  }

  return (
    <Modal open={!!source} onClose={onClose} title="Merge chapters" width={480}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Two chapters become one. The absorbed chapter's words join at a clean seam — a scene break or a
        blank line — and nothing is deleted without a second look.
      </p>

      <div className="field">
        <label>Direction</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="check-row">
            <input type="radio" checked={direction === 'into-current'} onChange={() => setDirection('into-current')} />
            Append <b>{others.find((c) => c.id === targetId)?.title || (others[0]?.title ?? 'another chapter')}</b> into “{source.title || 'Untitled'}”
          </label>
          <label className="check-row">
            <input type="radio" checked={direction === 'into-other'} onChange={() => setDirection('into-other')} />
            Append “{source.title || 'Untitled'}” into <b>{others.find((c) => c.id === targetId)?.title || (others[0]?.title ?? 'another chapter')}</b>
          </label>
        </div>
      </div>

      <div className="field">
        <label>Chapter to keep the title of</label>
        <select
          value={targetId || (others[0]?.id ?? '')}
          onChange={(e) => setTargetId(e.target.value)}
        >
          {others.map((c) => (
            <option key={c.id} value={c.id}>{c.title || 'Untitled'} · {formatWords(c.wordCount || 0)} words</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Seam between them</label>
        <select value={separator} onChange={(e) => setSeparator(e.target.value)}>
          <option value="scene-break">Scene break (❦)</option>
          <option value="space">One blank line</option>
        </select>
      </div>

      {keep && absorb && (
        <div
          style={{
            margin: 'var(--space-3) 0',
            padding: '10px 12px',
            background: 'var(--surface-warm)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            color: 'var(--charcoal)'
          }}
        >
          “{keep.title || 'Untitled'}” keeps <b>{formatWords(keep.wordCount || 0)}</b> words and gains{' '}
          <b>{formatWords(absorb.wordCount || 0)}</b> from “{absorb.title || 'Untitled'}” →{' '}
          <b>{formatWords((keep.wordCount || 0) + (absorb.wordCount || 0))}</b> total.
        </div>
      )}

      <div className="modal-foot">
        <button className="button button-ghost" onClick={onClose}>Cancel</button>
        <button className="button button-primary" onClick={handleSave} disabled={!target}>
          Merge chapters
        </button>
      </div>
    </Modal>
  )
}
