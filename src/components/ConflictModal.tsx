import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import Icon from './Icon'

// Shown when sync finds a record edited both here and elsewhere. The author
// decides — nothing is discarded silently.
const STORE_LABEL = {
  chapters: 'Chapter', characters: 'Character', notes: 'Note',
  world: 'Worldbuilding', relationships: 'Relationship', novels: 'Novel',
  glossary: 'Term', moodboard: 'Moodboard tile'
}

function titleOf(store, rec) {
  if (!rec) return 'Untitled'
  return rec.title || rec.name || rec.term || (rec.a && rec.b ? `${rec.a} & ${rec.b}` : 'Untitled')
}

function plain(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function summarize(store, rec) {
  if (!rec) return ''
  if (store === 'chapters') {
    const words = rec.wordCount ?? plain(rec.content).split(/\s+/).filter(Boolean).length
    return `${words} words`
  }
  if (store === 'notes') return plain(rec.content).slice(0, 120)
  if (store === 'characters') return rec.role || plain(rec.appearance).slice(0, 120)
  if (store === 'glossary') return plain(rec.definition).slice(0, 120)
  return ''
}

export default function ConflictModal() {
  const { conflicts, resolveConflict } = useApp()
  const [busy, setBusy] = useState(null)

  if (!conflicts || conflicts.length === 0) return null
  const c = conflicts[0]
  const preview = (rec) => (c.store === 'chapters' ? plain(rec?.content).slice(0, 600) : summarize(c.store, rec))

  const resolve = async (choice) => {
    setBusy(choice)
    await resolveConflict(c.cid, choice)
    setBusy(null)
  }

  const whenMine = c.mine?.updatedAt ? new Date(c.mine.updatedAt).toLocaleString() : ''
  const whenTheirs = c.theirs?.updatedAt ? new Date(c.theirs.updatedAt).toLocaleString() : ''

  return createPortal(
    <div className="modal-overlay">
      <div className="modal conflict-modal" role="dialog" aria-modal="true" aria-label="Resolve sync conflict">
        <div className="conflict-head">
          <span className="conflict-badge"><Icon icon="fa-solid fa-code-branch" /></span>
          <div>
            <h2 style={{ margin: 0 }}>Two versions to reconcile</h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              “{titleOf(c.store, c.mine)}” ({STORE_LABEL[c.store] || c.store}) was edited here and on another device.
              {conflicts.length > 1 ? ` ${conflicts.length - 1} more after this.` : ''}
            </p>
          </div>
        </div>

        <div className="conflict-cols">
          <div className="conflict-col">
            <div className="conflict-col-head">
              <strong>This device</strong>
              <span>{summarize(c.store, c.mine)}{whenMine ? ` · ${whenMine}` : ''}</span>
            </div>
            <div className="conflict-col-body">{preview(c.mine) || <span className="muted">— empty —</span>}</div>
          </div>
          <div className="conflict-col">
            <div className="conflict-col-head">
              <strong>Other device</strong>
              <span>{summarize(c.store, c.theirs)}{whenTheirs ? ` · ${whenTheirs}` : ''}</span>
            </div>
            <div className="conflict-col-body">{preview(c.theirs) || <span className="muted">— empty —</span>}</div>
          </div>
        </div>

        <div className="conflict-actions">
          <button className="button button-ghost" disabled={!!busy} onClick={() => resolve('mine')}>
            {busy === 'mine' ? 'Keeping…' : 'Keep this device’s'}
          </button>
          <button className="button button-ghost" disabled={!!busy} onClick={() => resolve('theirs')}>
            {busy === 'theirs' ? 'Keeping…' : 'Keep the other'}
          </button>
          <button className="button button-primary" disabled={!!busy} onClick={() => resolve('both')} title="Keep this version and save the other alongside it">
            {busy === 'both' ? 'Saving both…' : 'Keep both'}
          </button>
        </div>
        <p className="muted small" style={{ textAlign: 'center', margin: 'var(--space-3) 0 0' }}>
          “Keep both” saves the other version as a separate copy so nothing is lost.
        </p>
      </div>
    </div>,
    document.body
  )
}
