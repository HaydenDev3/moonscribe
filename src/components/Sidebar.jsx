import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { formatWords } from '../utils/words'
import { NOVEL_NAV, itemPath } from '../nav'
import { buildTree, computeNumbers, titleFor, isContainer } from '../utils/numbering'
import SyncStatus from './SyncStatus'
import { useContextMenu } from './ContextMenu'
import Icon from './Icon'

export default function Sidebar({
  novel,
  totalWords,
  chapters,
  currentId,
  onSelect,
  onAdd,
  onMove,
  onEdit,
  onDelete,
  onTidy,
  onMerge,
  onReorder,
  open,
  onClose,
  onSyncClick
}) {
  const { openContextMenu } = useContextMenu()
  const [collapsed, setCollapsed] = useState(() => new Set())

  const numbers = computeNumbers(chapters)
  const tree = buildTree(chapters)
  const flat = chapters
  const chapterMenu = (e, c) => {
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

  const renderNode = (node, depth) => {
    const c = node.ch
    const info = numbers.get(c.id)
    const container = isContainer(c)
    const isCollapsed = collapsed.has(c.id)
    const label = titleFor(c, numbers)
    const numLabel = !container
      ? c.kind === 'subchapter'
        ? (info?.label || '').replace(/^Section /, '')
        : (info?.label || '').replace(/^Chapter /, '')
      : ''
    const showNum = numLabel !== ''
    const childCount = node.children.length

    return (
      <div key={c.id} className="chapter-wrap">
        <div
          className={`chapter-item ${c.id === currentId ? 'active' : ''} ${container ? 'container' : ''}`}
          style={{ paddingLeft: 10 + depth * 16 }}
          onClick={() => onSelect(c.id)}
          onContextMenu={(e) => chapterMenu(e, c)}
          draggable
          onDragStart={(e) => {
            e.stopPropagation()
            e.dataTransfer.setData('text/plain', c.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            e.dataTransfer.dropEffect = 'move'
          }}
          onDrop={(e) => handleDropOn(e, c)}
        >
          {container && childCount > 0 && (
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
          {container && childCount === 0 && <span className="caret caret-empty" />}
          {!container && <span className={`dot status-${c.status}`} title={c.status} />}
          {showNum && <span className="chapter-num">{numLabel.replace('Chapter ', '')}</span>}
          <span className={`chapter-title ${container ? 'container-title' : ''}`}>{label}</span>
          <span className="chapter-words">{c.wordCount}</span>
          <span className="chapter-tools" onClick={(e) => e.stopPropagation()}>
            <button title="Move up" onClick={() => onMove(c.id, -1)}><Icon icon="fa-solid fa-arrow-up" /></button>
            <button title="Move down" onClick={() => onMove(c.id, 1)}><Icon icon="fa-solid fa-arrow-down" /></button>
            <button title="Edit chapter" onClick={() => onEdit(c)}><Icon icon="fa-solid fa-pen" /></button>
            <button title="Delete chapter" onClick={() => onDelete(c)}><Icon icon="fa-solid fa-trash" /></button>
          </span>
        </div>
        {node.children.length > 0 && !isCollapsed && (
          <div className="chapter-children">{node.children.map((n) => renderNode(n, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-head">
        <Link className="sidebar-back" to="/" onClick={onClose}>
          ← All novels
        </Link>
        <div className="sidebar-novel-title">{novel.title}</div>
        <div className="sidebar-novel-words">
          {formatWords(totalWords)} words · {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
        </div>
      </div>

      <nav className="nav-groups">
        {NOVEL_NAV.map((g) => (
          <div className="nav-group" key={g.group}>
            <div className="nav-group-title">{g.group}</div>
            <div className="nav-tabs">
              {g.items.map((n) => (
                <NavLink
                  key={n.label}
                  to={itemPath(novel.id, n)}
                  end={n.end}
                  className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <span className="nav-icon"><Icon icon={n.icon} /></span>
                  {n.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div
        className="sidebar-scroll"
        onDragOver={(e) => {
          if (e.target === e.currentTarget) e.preventDefault()
        }}
        onDrop={(e) => {
          e.preventDefault()
          const dragId = e.dataTransfer.getData('text/plain')
          if (dragId) onReorder(dragId, null, null)
        }}
      >
        {chapters.length === 0 && (
          <p className="muted small" style={{ padding: '0 12px', textAlign: 'center' }}>
            No chapters yet — the first one is waiting.
          </p>
        )}
        {tree.map((n) => renderNode(n, 0))}
        <div className="part-block">
          <div className="part-header">
            <button className="button button-quiet" onClick={() => onAdd('chapter', null)} style={{ opacity: 1, fontSize: '0.82rem', color: 'var(--moon-deep)' }}>
              <Icon icon="fa-solid fa-plus" style={{ marginRight: 6 }} /> New chapter
            </button>
            <span className="actions-row">
              {[
                ['part', 'Part'],
                ['act', 'Act'],
                ['book', 'Book']
              ].map(([kind, label]) => (
                <button key={kind} className="button button-quiet" onClick={() => onAdd(kind, null)} style={{ opacity: 1, fontSize: '0.8rem' }} title={`New ${label.toLowerCase()}`}>
                  <Icon icon="fa-solid fa-plus" style={{ marginRight: 4 }} /> {label}
                </button>
              ))}
            </span>
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        <SyncStatus onClick={onSyncClick} />
      </div>
    </aside>
  )
}
