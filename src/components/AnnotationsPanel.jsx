import { useEffect, useMemo, useRef, useState } from 'react'
import { ANNOTATION_TYPES } from '../db/annotations'
import { timeAgo } from '../utils/dates'
import Icon from './Icon'

const TYPE_LABEL = Object.fromEntries(ANNOTATION_TYPES)

// A collapsible thread of private comments for the current chapter. Filterable
// by concern; comments never leave the app (they're excluded from every export).
export default function AnnotationsPanel({
  annotations,
  draft,
  activeId,
  onDraftChange,
  onSaveDraft,
  onCancelDraft,
  onResolve,
  onDelete,
  onClose
}) {
  const [filter, setFilter] = useState('all')
  const [showResolved, setShowResolved] = useState(false)
  const activeRef = useRef(null)

  const shown = useMemo(
    () =>
      annotations
        .filter((a) => (filter === 'all' ? true : a.type === filter))
        .filter((a) => (showResolved ? true : !a.resolved))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [annotations, filter, showResolved]
  )

  const openCount = annotations.filter((a) => !a.resolved).length

  useEffect(() => {
    if (!activeId || !activeRef.current) return
    activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeId])

  return (
    <aside className="annot-panel">
      <div className="annot-head">
        <div className="annot-title">
          <strong>Comments</strong>
          <span>{openCount} open</span>
        </div>
        <button className="button button-quiet" onClick={onClose} aria-label="Close comments">
          <Icon icon="fa-solid fa-xmark" />
        </button>
      </div>

      {draft && (
        <div className="annot-composer">
          {draft.quote ? (
            <blockquote className="annot-quote">“{draft.quote}”</blockquote>
          ) : (
            <p className="muted small" style={{ margin: '0 0 8px' }}>A general note on this chapter.</p>
          )}
          <div className="annot-type-row">
            {ANNOTATION_TYPES.map(([k, label]) => (
              <button
                key={k}
                className={`annot-type-chip ${draft.type === k ? 'active' : ''}`}
                onClick={() => onDraftChange({ ...draft, type: k })}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            className="annot-textarea"
            autoFocus
            value={draft.comment}
            onChange={(e) => onDraftChange({ ...draft, comment: e.target.value })}
            placeholder="What do you want to remember about this passage?"
          />
          <div className="actions-row" style={{ justifyContent: 'flex-end' }}>
            <button className="button button-ghost" onClick={onCancelDraft}>Cancel</button>
            <button className="button button-primary" onClick={onSaveDraft}>Add comment</button>
          </div>
        </div>
      )}

      <div className="annot-filters">
        <button className={`ref-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        {ANNOTATION_TYPES.map(([k, label]) => (
          <button key={k} className={`ref-tab ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      <div className="annot-body">
        {shown.length === 0 ? (
          <p className="muted small" style={{ padding: 'var(--space-4)' }}>
            {annotations.length === 0
              ? 'Select a passage and press 💬 in the toolbar to leave a private note.'
              : 'No comments match this filter.'}
          </p>
        ) : (
          shown.map((a) => (
            <div
              key={a.id}
              ref={a.id === activeId ? activeRef : null}
              className={`annot-item ${a.resolved ? 'resolved' : ''} type-${a.type} ${a.id === activeId ? 'active' : ''}`}
            >
              <div className="annot-item-top">
                <span className={`annot-type-tag type-${a.type}`}>{TYPE_LABEL[a.type] || 'Note'}</span>
                <span className="annot-time">{timeAgo(a.createdAt)}</span>
              </div>
              {a.quote && <blockquote className="annot-quote">“{a.quote}”</blockquote>}
              {a.comment && <p className="annot-comment">{a.comment}</p>}
              <div className="annot-item-actions">
                <button className="button-quiet" onClick={() => onResolve(a)}>
                  <Icon icon={a.resolved ? 'fa-solid fa-rotate-left' : 'fa-solid fa-check'} />{' '}
                  {a.resolved ? 'Reopen' : 'Resolve'}
                </button>
                <button className="button-quiet danger" onClick={() => onDelete(a)}>
                  <Icon icon="fa-solid fa-trash" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {annotations.length > 0 && (
        <label className="annot-foot">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show resolved
        </label>
      )}
    </aside>
  )
}
