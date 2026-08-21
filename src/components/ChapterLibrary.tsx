// A roomier view of the chapter list: a wide pop-out with Recently edited and
// the full outline. Keeps the same actions as the sidebar (open, move, edit,
// delete, tidy, merge, drag to reorder, context menu).
import { useMemo, useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import { formatWords } from '../utils/words'
import { timeAgo } from '../utils/dates'
import { useContextMenu } from './ContextMenu'
import { buildTree, computeNumbers, titleFor, isContainer } from '../utils/numbering'

export default function ChapterLibrary({ open, onClose, chapters, currentId, onSelect, onAdd, onMove, onEdit, onDelete, onTidy, onMerge, onReorder }) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(() => new Set())
  const { openContextMenu } = useContextMenu()

  const visibleChapters = chapters.filter((c) => {
    if (!query.trim()) return true
    const text = `${c.title || ''} ${c.part || ''} ${c.kind || ''}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  })
  const { numbers, tree } = useMemo(
    () => ({ numbers: computeNumbers(chapters), tree: buildTree(visibleChapters) }),
    [chapters, visibleChapters]
  )
  const recent = [...chapters]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 6)

  const chapterMenu = (e, c) => {
    const flat = chapters.filter((x) => !isContainer(x) || true)
    const i = flat.findIndex((x) => x.id === c.id)
    openContextMenu(e, [
      { label: 'Edit chapter', icon: 'fa-solid fa-pen', onClick: () => onEdit(c) },
      { label: 'Move up', icon: 'fa-solid fa-arrow-up', disabled: i <= 0, onClick: () => onMove(c.id, -1) },
      { label: 'Move down', icon: 'fa-solid fa-arrow-down', disabled: i === -1 || i >= flat.length - 1, onClick: () => onMove(c.id, 1) },
      'divider',
      { label: 'Add chapter', icon: 'fa-solid fa-plus', onClick: () => onAdd('chapter', isContainer(c) ? c.id : c.parentId || null) },
      ...(c.kind === 'chapter'
        ? [{ label: 'Add subchapter', icon: 'fa-solid fa-plus', onClick: () => onAdd('subchapter', c.id) }]
        : []),
      'divider',
      { label: 'Tidy formatting', icon: 'fa-solid fa-wand-magic-sparkles', onClick: () => onTidy(c) },
      { label: 'Merge with…', icon: 'fa-solid fa-object-ungroup', onClick: () => onMerge(c) },
      'divider',
      { label: 'Delete', icon: 'fa-solid fa-trash', danger: true, onClick: () => onDelete(c) }
    ])
  }

  const handleDropOn = (e, target) => {
    e.preventDefault()
    e.stopPropagation()
    const dragId = e.dataTransfer.getData('text/plain')
    if (!dragId) return
    if (isContainer(target)) {
      onReorder(dragId, target.id, null)
    } else {
      const sibs = chapters.filter((c) => (c.parentId || null) === (target.parentId || null)).sort((a, b) => a.order - b.order)
      const idx = sibs.findIndex((c) => c.id === target.id)
      onReorder(dragId, target.parentId || null, idx + 1)
    }
  }

  const select = (id) => {
    onSelect(id)
    onClose()
  }

  const renderNode = (node, depth) => {
    const c = node.ch
    const container = isContainer(c)
    const isCollapsed = collapsed.has(c.id)
    const numLabel = !container ? (c.kind === 'subchapter' ? (numbers.get(c.id)?.label || '').replace(/^Section /, '') : (numbers.get(c.id)?.label || '').replace(/^Chapter /, '')) : ''
    const showNum = numLabel !== ''

    return (
      <div key={c.id}>
        <div
          className={`library-row ${c.id === currentId ? 'active' : ''} ${container ? 'container' : ''}`}
          style={{ paddingLeft: 10 + depth * 20 }}
          onClick={() => select(c.id)}
          onKeyDown={(e) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select(c.id))}
          role="button"
          tabIndex={0}
          onContextMenu={(e) => chapterMenu(e, c)}
          draggable
          onDragStart={(e) => {
            e.stopPropagation()
            e.dataTransfer.setData('text/plain', c.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move' }}
          onDrop={(e) => handleDropOn(e, c)}
        >
          {container && node.children.length > 0 && (
            <button
              className="button button-quiet caret"
              onClick={(e) => {
                e.stopPropagation()
                setCollapsed((s) => {
                  const next = new Set(s)
                  if (next.has(c.id)) next.delete(c.id)
                  else next.add(c.id)
                  return next
                })
              }}
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            >
              <Icon icon={isCollapsed ? 'fa-solid fa-caret-right' : 'fa-solid fa-caret-down'} />
            </button>
          )}
          {container && node.children.length === 0 && <span className="caret caret-empty" />}
          {!container && <span className={`dot status-${c.status || 'draft'}`} title={c.status} />}
          {showNum && <span className="chapter-num">{numLabel.replace('Chapter ', '')}</span>}
          <span className={`chapter-title ${container ? 'container-title' : ''}`}>{titleFor(c, numbers)}</span>
          <span className="chapter-words">{c.wordCount}</span>
          <span className="library-tools" onClick={(e) => e.stopPropagation()}>
            <button title="Move up" aria-label="Move up" onClick={() => onMove(c.id, -1)}><Icon icon="fa-solid fa-arrow-up" /></button>
            <button title="Move down" aria-label="Move down" onClick={() => onMove(c.id, 1)}><Icon icon="fa-solid fa-arrow-down" /></button>
            <button title="Edit chapter" aria-label="Edit chapter" onClick={() => onEdit(c)}><Icon icon="fa-solid fa-pen" /></button>
            <button title="Delete chapter" aria-label="Delete chapter" onClick={() => onDelete(c)}><Icon icon="fa-solid fa-trash" /></button>
          </span>
        </div>
        {node.children.length > 0 && !isCollapsed && <div>{node.children.map((n) => renderNode(n, depth + 1))}</div>}
      </div>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Chapters" width={680}>
      <div className="library-search">
        <Icon icon="fa-solid fa-magnifying-glass" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chapters…" aria-label="Search chapters" autoFocus />
        {query && (
          <button type="button" className="button button-quiet" onClick={() => setQuery('')} aria-label="Clear search">
            <Icon icon="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {query.trim() === '' && recent.length > 0 && (
        <div className="library-section">
          <div className="library-section-label">Recently edited chapters</div>
          {recent.map((c) => (
            <button key={c.id} type="button" className={`library-row recent ${c.id === currentId ? 'active' : ''}`} onClick={() => select(c.id)}>
              <span className={`dot status-${c.status || 'draft'}`} title={c.status} />
              <span className="chapter-title">{titleFor(c, numbers) || 'Untitled'}</span>
              <span className="chapter-words muted">{formatWords(c.wordCount || 0)}</span>
              <span className="recent-meta">{timeAgo(c.updatedAt || c.createdAt)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="library-section">
        <div className="library-section-label">
          Chapters
          <span className="actions-row" style={{ marginLeft: 'auto' }}>
            <button className="button button-quiet" onClick={() => setCollapsed(new Set())}>Expand all</button>
            <button className="button button-quiet" onClick={() => setCollapsed(new Set(chapters.filter(isContainer).map((c) => c.id)))}>Collapse all</button>
          </span>
        </div>
        {visibleChapters.length === 0 ? (
          <p className="muted small" style={{ padding: '12px 4px' }}>No chapters {query ? 'match that search' : 'yet — the first one is waiting'}.</p>
        ) : (
          tree.map((n) => renderNode(n, 0))
        )}
      </div>
    </Modal>
  )
}
