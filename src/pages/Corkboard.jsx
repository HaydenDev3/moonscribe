import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listChapters, reorderChapter, updateChapter } from '../db/chapters'
import { listCharacters } from '../db/characters'
import { listWorld } from '../db/world'
import { computeNumbers, titleFor, isContainer } from '../utils/numbering'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icon'
import { formatWords } from '../utils/words'
import { useContextMenu } from '../components/ContextMenu'

const STATUSES = ['draft', 'active', 'done', 'archived']
const STATUS_LABEL = { draft: 'Draft', active: 'In progress', done: 'Done', archived: 'Archived' }
const STATUS_ICON  = { draft: 'fa-regular fa-circle', active: 'fa-solid fa-circle-half-stroke', done: 'fa-solid fa-circle-check', archived: 'fa-solid fa-box-archive' }

// Theme-safe status colors via CSS variables defined in the component
const STATUS_CSS = {
  draft:    { bg: 'color-mix(in srgb, var(--grey-soft) 18%, var(--surface))',  border: 'color-mix(in srgb, var(--grey-soft) 30%, transparent)', dot: 'var(--grey-soft)' },
  active:   { bg: 'color-mix(in srgb, var(--accent) 14%, var(--surface))',     border: 'color-mix(in srgb, var(--accent) 35%, transparent)',     dot: 'var(--accent)' },
  done:     { bg: 'color-mix(in srgb, var(--sage) 16%, var(--surface))',       border: 'color-mix(in srgb, var(--sage) 35%, transparent)',        dot: 'var(--sage)' },
  archived: { bg: 'color-mix(in srgb, var(--mist) 30%, var(--surface))',       border: 'color-mix(in srgb, var(--mist) 50%, transparent)',        dot: 'var(--grey-soft)' },
}

const ACCENT_PALETTE = [
  '#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#d53f8c','#718096',
]

export default function Corkboard({ novelId, embedded }) {
  const { id } = useParams()
  const nid = novelId || id
  const navigate = useNavigate()
  const { openContextMenu } = useContextMenu()
  const [chapters, setChapters] = useState([])
  const [characters, setCharacters] = useState([])
  const [filter, setFilter] = useState('') // status filter
  const [sortBy, setSortBy] = useState('order') // 'order' | 'words' | 'updated'
  const [editingSynopsis, setEditingSynopsis] = useState(null) // chapter id
  const [synopsisValue, setSynopsisValue] = useState('')
  const synopsisRef = useRef(null)

  const load = useCallback(async () => {
    setChapters(await listChapters(nid))
    setCharacters(await listCharacters(nid))
  }, [nid])

  useEffect(() => { load() }, [load])

  // Click outside synopsis textarea → cancel editing
  useEffect(() => {
    if (!editingSynopsis) return
    const handler = (e) => {
      if (synopsisRef.current && !synopsisRef.current.contains(e.target)) {
        setEditingSynopsis(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [editingSynopsis])

  const numbers = computeNumbers(chapters)

  // Assign POV colors
  const povColors = {}
  const pov_list = [...new Set(chapters.filter((c) => c.meta?.pov).map((c) => c.meta.pov))]
  pov_list.forEach((p, i) => { povColors[p] = ACCENT_PALETTE[i % ACCENT_PALETTE.length] })

  const setStatus = useCallback(async (c, status) => {
    await updateChapter(c.id, { status })
    setChapters((prev) => prev.map((x) => x.id === c.id ? { ...x, status } : x))
  }, [])

  const saveSynopsis = useCallback(async (c) => {
    await updateChapter(c.id, { synopsis: synopsisValue })
    setChapters((prev) => prev.map((x) => x.id === c.id ? { ...x, synopsis: synopsisValue } : x))
    setEditingSynopsis(null)
  }, [synopsisValue])

  const onDrop = async (e, targetId) => {
    e.preventDefault()
    const dragId = e.dataTransfer.getData('text/plain')
    if (!dragId || dragId === targetId) return
    const target = chapters.find((c) => c.id === targetId)
    if (!target) return
    if (isContainer(target)) {
      await reorderChapter(nid, dragId, { parentId: target.id, index: null })
    } else {
      const sibs = chapters.filter((c) => (c.parentId || null) === (target.parentId || null)).sort((a, b) => a.order - b.order)
      const idx = sibs.findIndex((c) => c.id === targetId)
      await reorderChapter(nid, dragId, { parentId: target.parentId || null, index: idx + 1 })
    }
    setChapters(await listChapters(nid))
  }

  const open = (c) => navigate(`/novel/${nid}`, { state: { chapterId: c.id } })

  const cardMenu = (e, c) => {
    const status = c.status || 'draft'
    const statusItems = STATUSES.filter((s) => s !== status).map((s) => ({
      label: `Mark as ${STATUS_LABEL[s]}`,
      icon: STATUS_ICON[s],
      onClick: () => setStatus(c, s),
    }))
    openContextMenu(e, [
      { label: 'Open chapter', icon: 'fa-solid fa-pen-nib', onClick: () => open(c) },
      { label: 'Edit synopsis', icon: 'fa-solid fa-align-left', onClick: () => { setSynopsisValue(c.synopsis || ''); setEditingSynopsis(c.id) } },
      'divider',
      ...statusItems,
      'divider',
      { label: 'Copy title', icon: 'fa-solid fa-copy', onClick: () => navigator.clipboard?.writeText(titleFor(c, numbers) || '') },
    ])
  }

  let flat = chapters.filter((c) => !isContainer(c))
  if (filter) flat = flat.filter((c) => (c.status || 'draft') === filter)
  if (sortBy === 'words') flat = [...flat].sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0))
  if (sortBy === 'updated') flat = [...flat].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))

  const counts = {}
  for (const s of STATUSES) counts[s] = chapters.filter((c) => !isContainer(c) && (c.status || 'draft') === s).length

  return (
    <div className={embedded ? undefined : 'app'}>
      <div className="page page-wide" style={{ paddingBottom: 'var(--space-8)' }}>
        {/* Header */}
        <div className="cork-header">
          <div>
            <h2 style={{ margin: 0 }}>Corkboard</h2>
            <p className="muted small" style={{ margin: '3px 0 0' }}>Every scene as a card. Drag to reorder · right-click for options.</p>
          </div>
          <div className="cork-toolbar">
            <select className="tl-filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort by">
              <option value="order">Story order</option>
              <option value="words">Most words</option>
              <option value="updated">Recently edited</option>
            </select>
          </div>
        </div>

        {/* Status filter chips */}
        <div className="cork-status-bar">
          <button className={`cork-status-chip ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>
            All <span className="cork-status-count">{chapters.filter((c) => !isContainer(c)).length}</span>
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`cork-status-chip ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(filter === s ? '' : s)}
              style={{ '--status-color': STATUS_CSS[s].dot }}
            >
              <span className="cork-status-dot" />
              {STATUS_LABEL[s]} <span className="cork-status-count">{counts[s]}</span>
            </button>
          ))}
        </div>

        {flat.length === 0 ? (
          <EmptyState icon="fa-solid fa-border-all" title="No chapters to pin yet">
            The corkboard fills as you write. Drop a chapter onto another to nest it.
          </EmptyState>
        ) : (
          <div className="cork-grid">
            {flat.map((c) => {
              const container = chapters.find((x) => x.id === c.parentId)
              const status = c.status || 'draft'
              const sc = STATUS_CSS[status]
              const pov = c.meta?.pov
              const povColor = pov ? (povColors[pov] || 'var(--grey)') : null
              const isEditingSyn = editingSynopsis === c.id

              return (
                <div
                  key={c.id}
                  className="cork-card"
                  style={{ background: sc.bg, borderColor: sc.border }}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', c.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(e, c.id)}
                  onClick={() => !isEditingSyn && open(c)}
                  onContextMenu={(e) => { e.preventDefault(); cardMenu(e, c) }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && !isEditingSyn && open(c)}
                >
                  {/* Colour tab for POV */}
                  {povColor && <div className="cork-card-pov-bar" style={{ background: povColor }} title={pov} />}

                  <div className="cork-card-header">
                    <div className="cork-card-pin" />
                    <span className="cork-card-status" title={STATUS_LABEL[status]}>
                      <Icon icon={STATUS_ICON[status]} style={{ color: sc.dot }} />
                    </span>
                  </div>

                  <div className="cork-card-title">{titleFor(c, numbers)}</div>
                  {container && <div className="cork-card-sub muted small">in {container.title || 'a folder'}</div>}
                  {pov && <div className="cork-card-pov" style={{ color: povColor }}><Icon icon="fa-solid fa-user" style={{ fontSize: '0.65rem' }} /> {pov}</div>}

                  {/* Synopsis */}
                  {isEditingSyn ? (
                    <div ref={synopsisRef} onClick={(e) => e.stopPropagation()} style={{ marginTop: 6 }}>
                      <textarea
                        autoFocus
                        className="cork-synopsis-input"
                        value={synopsisValue}
                        onChange={(e) => setSynopsisValue(e.target.value)}
                        placeholder="One-line synopsis…"
                        rows={3}
                      />
                      <div className="cork-synopsis-actions">
                        <button className="button button-primary" style={{ padding: '3px 10px', fontSize: '0.78rem' }} onClick={(e) => { e.stopPropagation(); saveSynopsis(c) }}>Save</button>
                        <button className="button button-quiet" style={{ padding: '3px 8px', fontSize: '0.78rem' }} onClick={(e) => { e.stopPropagation(); setEditingSynopsis(null) }}>Cancel</button>
                      </div>
                    </div>
                  ) : c.synopsis ? (
                    <p
                      className="cork-synopsis muted small"
                      title="Double-click to edit synopsis"
                      onDoubleClick={(e) => { e.stopPropagation(); setSynopsisValue(c.synopsis || ''); setEditingSynopsis(c.id) }}
                    >{c.synopsis}</p>
                  ) : null}

                  <div className="cork-card-footer">
                    <span className="cork-card-words">{formatWords(c.wordCount || 0)}</span>
                    <button
                      className="cork-card-menu"
                      title="Card options"
                      onClick={(e) => { e.stopPropagation(); cardMenu(e, c) }}
                      aria-label="Card options"
                    >
                      <Icon icon="fa-solid fa-ellipsis" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
