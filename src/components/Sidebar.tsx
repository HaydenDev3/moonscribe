import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { formatWords } from '../utils/words'
import { timeAgo } from '../utils/dates'
import { NOVEL_NAV, itemPath } from '../nav'
import { buildTree, computeNumbers, titleFor, isContainer } from '../utils/numbering'
import SyncStatus from './SyncStatus'
import { useContextMenu } from './ContextMenu'
import Icon from './Icon'
import { useApp } from '../context/AppContext'
import ProfileAvatar from './ProfileAvatar'

// ── Add-item dropdown ────────────────────────────────────────────────────────
function AddMenu({
  onAdd,
  currentChapter: _currentChapter,
  onClose,
  anchorRef,
}: {
  onAdd: (kind: string, parentId: string | null) => void
  currentChapter?: unknown
  onClose: () => void
  anchorRef: RefObject<HTMLButtonElement | null>
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !anchorRef.current?.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  const items = [
    { kind: 'chapter',    label: 'Chapter',    icon: 'fa-solid fa-file-lines' },
    { kind: 'part',       label: 'Part',       icon: 'fa-solid fa-folder' },
    { kind: 'act',        label: 'Act',        icon: 'fa-solid fa-layer-group' },
    { kind: 'book',       label: 'Book',       icon: 'fa-solid fa-book' },
  ]

  return (
    <div className="binder-add-menu" ref={ref} role="menu">
      {items.map(({ kind, label, icon }) => (
        <button
          key={kind}
          role="menuitem"
          className="binder-add-item"
          onClick={() => { onAdd(kind, null); onClose() }}
        >
          <Icon icon={icon} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}

export default function Sidebar({
  novel,
  totalWords,
  chapters,
  collaborators = [],
  currentId,
  onSelect,
  onAdd,
  onMove,
  onEdit,
  onDelete,
  onTidy,
  onMerge,
  onReorder,
  onOpenLibrary,
  open,
  onClose,
  onSyncClick,
  onTitleChange,
  onTitleSave,
}) {
  const { openContextMenu } = useContextMenu()
  const { settings, updateSettings, toast } = useApp()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [navCollapsed, setNavCollapsed] = useState(() => new Set(['World', 'Craft', 'Journal', 'Archive']))
  const [manuscriptCollapsed, setManuscriptCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const addBtnRef = useRef(null)

  const toggleNavGroup = (group) => setNavCollapsed((s) => {
    const next = new Set(s)
    if (next.has(group)) next.delete(group)
    else next.add(group)
    return next
  })

  const visibleChapters = chapters.filter((c) => {
    if (!query.trim()) return true
    const text = `${c.title || ''} ${c.kind || ''}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  })

  const { numbers, tree } = useMemo(
    () => ({ numbers: computeNumbers(chapters), tree: buildTree(visibleChapters) }),
    [chapters, visibleChapters]
  )

  const flat = visibleChapters
  const canEdit = !novel?.sharedRole || novel.sharedRole === 'editor'
  const collaboratorMap = useMemo(() => {
    const byChapter = new Map()
    let designerCount = 0
    for (const person of collaborators || []) {
      if (!person?.id) continue
      if (person.workspace === 'designer') designerCount += 1
      if (!person.chapterId) continue
      const current = byChapter.get(person.chapterId) || []
      current.push(person)
      byChapter.set(person.chapterId, current)
    }
    return { byChapter, designerCount }
  }, [collaborators])

  const chapterMenu = (e, c) => {
    const i = flat.findIndex((x) => x.id === c.id)
    openContextMenu(e, canEdit ? [
      { label: 'Edit', icon: 'fa-solid fa-pen', onClick: () => onEdit(c) },
      { label: 'Move up', icon: 'fa-solid fa-arrow-up', disabled: i <= 0, onClick: () => onMove(c.id, -1) },
      { label: 'Move down', icon: 'fa-solid fa-arrow-down', disabled: i === -1 || i >= flat.length - 1, onClick: () => onMove(c.id, 1) },
      'divider',
      { label: 'Add chapter here', icon: 'fa-solid fa-file-plus', onClick: () => onAdd('chapter', isContainer(c) ? c.id : c.parentId || null) },
      ...(c.kind === 'chapter'
        ? [{ label: 'Add scene', icon: 'fa-solid fa-plus', onClick: () => onAdd('subchapter', c.id) }]
        : []),
      'divider',
      { label: 'Merge with…', icon: 'fa-solid fa-object-ungroup', onClick: () => onMerge(c) },
      'divider',
      { label: 'Delete', icon: 'fa-solid fa-trash', danger: true, onClick: () => onDelete(c) }
    ] : [
      { label: 'Open chapter', icon: 'fa-solid fa-book-open', onClick: () => onSelect(c) },
      { label: 'Copy chapter link', icon: 'fa-regular fa-copy', onClick: () => navigator.clipboard?.writeText(window.location.href) }
    ])
  }

  const manuscriptMenu = (e) => {
    openContextMenu(e, canEdit ? [
      { label: 'New chapter', icon: 'fa-solid fa-file-lines', onClick: () => onAdd('chapter', null) },
      { label: 'New folder', icon: 'fa-solid fa-folder-plus', onClick: () => onAdd('part', null) },
      { label: 'New act', icon: 'fa-solid fa-layer-group', onClick: () => onAdd('act', null) },
      'divider',
      { label: 'Open chapter library', icon: 'fa-solid fa-table-list', onClick: onOpenLibrary },
      { label: manuscriptCollapsed ? 'Expand manuscript' : 'Collapse manuscript', icon: 'fa-solid fa-angles-up', onClick: () => setManuscriptCollapsed(v => !v) },
    ] : [
      { label: 'Open chapter library', icon: 'fa-solid fa-table-list', onClick: onOpenLibrary },
      { label: manuscriptCollapsed ? 'Expand manuscript' : 'Collapse manuscript', icon: 'fa-solid fa-angles-up', onClick: () => setManuscriptCollapsed(v => !v) },
    ])
  }

  const navMenu = (e, item) => {
    const path = itemPath(novel.id, item)
    openContextMenu(e, [
      { label: `Open ${item.label}`, icon: item.icon, onClick: () => navigate(path) },
      { label: 'Open in new tab', icon: 'fa-solid fa-arrow-up-right-from-square', onClick: () => window.open(path, '_blank', 'noopener,noreferrer') },
      'divider',
      { label: 'Copy section link', icon: 'fa-regular fa-copy', onClick: () => navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}#${path}`) },
    ])
  }

  const navGroupMenu = (e, group) => {
    openContextMenu(e, [
      { label: navCollapsed.has(group.group) ? `Expand ${group.group}` : `Collapse ${group.group}`, icon: 'fa-solid fa-chevron-down', onClick: () => toggleNavGroup(group.group) },
      ...group.items.map((item) => ({ label: `Open ${item.label}`, icon: item.icon, onClick: () => navigate(itemPath(novel.id, item)) })),
    ])
  }

  const handleDropOn = (e, target) => {
    e.preventDefault()
    e.stopPropagation()
    const dragId = e.dataTransfer.getData('text/plain')
    if (!dragId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = rect.height ? (e.clientY - rect.top) / rect.height : 0.5
    if (isContainer(target) && ratio >= 0.25 && ratio <= 0.75) {
      onReorder(dragId, target.id, null)
    } else {
      const sibs = chapters
        .filter((c) => (c.parentId || null) === (target.parentId || null))
        .sort((a, b) => a.order - b.order)
      const idx = sibs.findIndex((c) => c.id === target.id)
      onReorder(dragId, target.parentId || null, idx + (ratio > 0.5 ? 1 : 0))
    }
    setDraggingId(null)
    setDropTarget(null)
  }

  const renderNode = (node, depth) => {
    const c = node.ch
    const info = numbers.get(c.id)
    const container = isContainer(c)
    const isCollapsed = collapsed.has(c.id)
    const label = titleFor(c, numbers)
    const tabPeople = collaboratorMap.byChapter.get(c.id) || []
    const numLabel = !container
      ? c.kind === 'subchapter'
        ? (info?.label || '').replace(/^Section /, '')
        : (info?.label || '').replace(/^Chapter /, '')
      : ''
    const showNum = numLabel !== ''
    const childCount = node.children.length

    return (
      <div key={c.id} className="binder-node">
        <div
          className={`binder-item ${c.id === currentId ? 'active' : ''} ${container ? 'is-container' : ''} ${dropTarget === c.id ? 'drop-target' : ''}`}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => onSelect(c.id)}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c.id) }
          }}
          role="button"
          tabIndex={0}
          aria-current={c.id === currentId ? 'true' : undefined}
          onContextMenu={(e) => chapterMenu(e, c)}
          draggable
          onDragStart={(e) => {
            e.stopPropagation()
            e.dataTransfer.setData('text/plain', c.id)
            e.dataTransfer.effectAllowed = 'move'
            setDraggingId(c.id)
          }}
          onDragEnd={() => { setDraggingId(null); setDropTarget(null) }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropTarget(c.id) }}
          onDragLeave={() => setDropTarget((id) => id === c.id ? null : id)}
          onDrop={(e) => handleDropOn(e, c)}
        >
          {/* Caret for containers */}
          {container ? (
            <button
              className={`binder-caret${childCount === 0 ? ' empty' : ''}`}
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
              {childCount > 0 && <Icon icon={isCollapsed ? 'fa-solid fa-caret-right' : 'fa-solid fa-caret-down'} />}
            </button>
          ) : (
            <span className="binder-dot" data-status={c.status} />
          )}

          {/* Number badge */}
          {showNum && <span className="binder-num">{numLabel}</span>}

          {/* Title */}
          <span className="binder-label">{label}</span>
          {tabPeople.length > 0 && (
            <span
              className="binder-live-badge"
              aria-label={`${tabPeople.length} collaborator${tabPeople.length === 1 ? '' : 's'} in this chapter`}
              title={tabPeople.map((person) => `${person.username} · ${person.activity === 'writing' ? 'writing' : 'viewing'} · ${person.tabName || 'This chapter'}`).join('\n')}
            >
              {tabPeople.slice(0, 3).map((person) => (
                <span
                  key={person.id}
                  className={`binder-live-avatar ${person.activity === 'writing' ? 'is-writing' : 'is-viewing'}`}
                  style={{ ['--presence-color' as any]: person.activity === 'writing' ? 'var(--accent)' : 'var(--panel-ink)' } as CSSProperties}
                  title={`${person.username} · ${person.activity === 'writing' ? 'writing' : 'viewing'}`}
                >
                  <ProfileAvatar src={person.avatar} name={person.username} />
                </span>
              ))}
              {tabPeople.length > 3 && <b>+{tabPeople.length - 3}</b>}
            </span>
          )}

          {/* Word count */}
          {!container && c.wordCount > 0 && (
            <span className="binder-words">{c.wordCount}</span>
          )}

          {/* Actions on hover */}
          <button
            className="binder-more"
            title="More actions"
            onClick={(e) => { e.stopPropagation(); chapterMenu(e, c) }}
            aria-label="Chapter actions"
          >
            <Icon icon="fa-solid fa-ellipsis-vertical" />
          </button>
        </div>

        {node.children.length > 0 && !isCollapsed && (
          <div className="binder-children">
            {node.children.map((n) => renderNode(n, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      {/* ── Head ── */}
      <div className="sidebar-head">
        <Link className="sidebar-back" to="/dashboard" onClick={onClose}>
          <Icon icon="fa-solid fa-chevron-left" />
          All novels
        </Link>
        <div className="sidebar-head-top group relative isolate overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-all duration-300 ease-out hover:border-white/15 hover:bg-white/[0.055] focus-within:-translate-y-px focus-within:border-[color:var(--accent)]/50 focus-within:bg-white/[0.07] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_12%,transparent),0_12px_30px_rgba(0,0,0,0.2)]">
          <span aria-hidden="true" className="sidebar-title-sheen pointer-events-none absolute inset-y-0 -left-1/2 z-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />
          <input
            className="sidebar-novel-title relative z-10 w-full min-w-0 !border-0 !bg-transparent px-3 py-2 !outline-none placeholder:text-white/25"
            value={novel.title || ''}
            onChange={(e) => onTitleChange?.(e.target.value)}
            onBlur={() => onTitleSave?.()}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            placeholder="Novel title…"
            spellCheck={false}
            aria-label="Novel title"
          />
        </div>
        <div className="sidebar-novel-meta">
          <span>{formatWords(totalWords)}</span>
          <span className="sidebar-meta-sep">·</span>
          <span>{chapters.filter(c => !isContainer(c)).length} {chapters.filter(c => !isContainer(c)).length === 1 ? 'chapter' : 'chapters'}</span>
        </div>
      </div>

      {/* ── Scroll body ── */}
      <div
        className="sidebar-scroll"
        onDragOver={(e) => { if (e.target === e.currentTarget) e.preventDefault() }}
        onDrop={(e) => {
          e.preventDefault()
          const dragId = e.dataTransfer.getData('text/plain')
          if (dragId) onReorder(dragId, null, null)
        }}
      >
        {/* ── MANUSCRIPT section ── */}
        <div className="binder-section">
          <div className="binder-section-header" onContextMenu={manuscriptMenu}>
            <button
              className="binder-section-toggle"
              onClick={() => setManuscriptCollapsed(v => !v)}
              aria-expanded={!manuscriptCollapsed}
            >
              <Icon icon={manuscriptCollapsed ? 'fa-solid fa-caret-right' : 'fa-solid fa-caret-down'} className="binder-section-caret" />
              <Icon icon="fa-solid fa-pen-nib" className="binder-section-icon" />
              <span className="binder-section-label">Manuscript</span>
            </button>
            <div className="binder-section-actions">
              <button
                className="sidebar-icon-btn"
                onClick={onOpenLibrary}
                title="Chapter library"
                aria-label="Open chapter library"
              >
                <Icon icon="fa-solid fa-table-list" />
              </button>
              <div className="binder-add-wrap">
                <button
                  ref={addBtnRef}
                  className="sidebar-icon-btn"
                  title="Add item"
                  aria-label="Add item"
                  onClick={() => setShowAddMenu(v => !v)}
                >
                  <Icon icon="fa-solid fa-plus" />
                </button>
                {showAddMenu && (
                  <AddMenu
                    onAdd={onAdd}
                    onClose={() => setShowAddMenu(false)}
                    anchorRef={addBtnRef}
                  />
                )}
              </div>
            </div>
          </div>

          {!manuscriptCollapsed && (
            <>
              {/* Write link */}
              <NavLink
                to={itemPath(novel.id, { to: '' })}
                end
                className={({ isActive }) => `binder-write-link${isActive ? ' active' : ''}`}
                onClick={onClose}
              >
                <Icon icon="fa-solid fa-arrow-right-to-bracket" />
                <span>Open editor</span>
              </NavLink>

              {/* Search */}
              <div className="sidebar-search">
                <Icon icon="fa-solid fa-magnifying-glass" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search chapters…"
                  aria-label="Search chapters"
                />
                {query && (
                  <button type="button" className="sidebar-icon-btn" onClick={() => setQuery('')} aria-label="Clear search">
                    <Icon icon="fa-solid fa-xmark" />
                  </button>
                )}
              </div>

              {/* Chapter tree */}
              {chapters.length === 0 ? (
                <p className="binder-empty">No chapters yet —<br />the first one is waiting.</p>
              ) : (
                <div className="binder-tree">
                  {tree.map((n) => renderNode(n, 0))}
                  <div
                    className={`binder-root-drop${draggingId ? ' visible' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move' }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const dragId = e.dataTransfer.getData('text/plain')
                      if (dragId) onReorder(dragId, null, null)
                      setDraggingId(null)
                      setDropTarget(null)
                    }}
                  >
                    <Icon icon="fa-solid fa-arrow-turn-up" /> Move outside folder
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Nav sections (World, Craft, Journal, Archive) ── */}
        <nav className="nav-groups" aria-label="Novel sections">
          {NOVEL_NAV.map((g) => ({ ...g, items: g.items.filter((item) => !(settings.hiddenSidebarTabs || []).includes(item.to)) })).filter((g) => g.items.length > 0).map((g) => {
            const isGroupCollapsed = navCollapsed.has(g.group)
            const sectionIcon = {
              World:   'fa-solid fa-globe',
              Craft:   'fa-solid fa-wand-magic-sparkles',
              Journal: 'fa-solid fa-clock-rotate-left',
              Archive: 'fa-solid fa-box-archive',
            }[g.group] || 'fa-solid fa-folder'

            return (
              <div
                key={g.group}
                className={`nav-group${isGroupCollapsed ? ' collapsed' : ''}`}
              >
                <button
                  className="nav-group-toggle"
                  onClick={() => toggleNavGroup(g.group)}
                  onContextMenu={(e) => navGroupMenu(e, g)}
                  aria-expanded={!isGroupCollapsed}
                >
                  <Icon icon={sectionIcon} className="nav-group-section-icon" />
                  <span className="nav-group-label">{g.group}</span>
                  <Icon icon="fa-solid fa-chevron-down" className="nav-group-caret" />
                </button>
                <div className="nav-group-items">
              {g.items.map((n) => (
                (() => {
                  const isDesigner = n.to === 'design'
                  const designerLive = isDesigner && collaboratorMap.designerCount > 0
                  return (
                    <NavLink
                      key={n.label}
                      to={itemPath(novel.id, n)}
                      end={n.end}
                      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}${designerLive ? ' has-live-presence' : ''}`}
                      onClick={onClose}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        openContextMenu(e, [
                          { label: `Open ${n.label}`, icon: n.icon, onClick: () => navigate(itemPath(novel.id, n)) },
                          'divider',
                          { label: 'Hide from sidebar', icon: 'fa-regular fa-eye-slash', onClick: () => {
                            updateSettings({ hiddenSidebarTabs: [...new Set([...(settings.hiddenSidebarTabs || []), n.to])] })
                            toast(`${n.label} hidden. Restore it in Settings → Appearance.`)
                          } },
                        ])
                      }}
                    >
                      <Icon icon={n.icon} />
                      <span className="nav-item-label">{n.label}</span>
                      {designerLive && (
                        <span className="nav-item-live-indicator" aria-hidden="true" title="Collaborator active in Designer" />
                      )}
                    </NavLink>
                  )
                })()
              ))}
                </div>
              </div>
            )
          })}
        </nav>
      </div>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        <SyncStatus onClick={onSyncClick} />
      </div>
    </aside>
  )
}
