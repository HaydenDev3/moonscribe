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
import Modal from './Modal'
import { getWorkspacePreferences, updateWorkspacePreferences, resetWorkspacePreferences } from '../db/workspacePreferences'
import { WORKSPACE_REGISTRY } from '../workspaces/registry'
import { updateNovel } from '../db/novels'

function readDragPayload(event) {
  const typed = event.dataTransfer.getData('application/x-moonscribe-item')
  if (typed) return typed
  const plain = event.dataTransfer.getData('text/plain')
  return plain ? (plain.startsWith('folder:') ? plain : `chapter:${plain}`) : ''
}

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
    { kind: 'folder',     label: 'Folder',     icon: 'fa-solid fa-folder-plus' },
    { kind: 'part',       label: 'Part',       icon: 'fa-solid fa-folder' },
    { kind: 'act',        label: 'Act',        icon: 'fa-solid fa-layer-group' },
    { kind: 'book',       label: 'Book',       icon: 'fa-solid fa-book' },
  ]

  return (
    <div className="binder-add-menu" ref={ref} role="menu">
      {items.map(({ kind, label, icon }) => (
        <button
          key={`${kind}-${label}`}
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
  folders = [],
  onFolderDelete,
  onFolderAppearance,
  onFolderSettings,
  onMoveToFolder,
  onMoveFolder,
  mediaFiles = [],
  onMediaSelect,
  onMediaDelete,
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
  onToggleFavorite,
}) {
  const { openContextMenu } = useContextMenu()
  const { settings, updateSettings, toast, syncUsername, syncStatus, syncDiscordAvatar, syncProvider, openSettings, disconnectSync } = useApp()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [navCollapsed, setNavCollapsed] = useState(() => new Set(['World', 'Craft', 'Journal', 'Archive']))
  const [manuscriptCollapsed, setManuscriptCollapsed] = useState(false)
  const [mediaCollapsed, setMediaCollapsed] = useState(false)
  const [showAllMedia, setShowAllMedia] = useState(false)
  const [folderSettings, setFolderSettings] = useState(null)
  const [folderSettingsTab, setFolderSettingsTab] = useState('overview')
  const [query, setQuery] = useState('')
  const [chapterSort, setChapterSort] = useState<'order' | 'number' | 'alpha'>(() => novel?.layout?.chapterSort || 'order')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [workspacePrefs, setWorkspacePrefs] = useState(null)
  const [workspaceManagerOpen, setWorkspaceManagerOpen] = useState(false)
  const addBtnRef = useRef(null)

  useEffect(() => {
    const saved = novel?.layout?.chapterSort
    if (saved === 'order' || saved === 'number' || saved === 'alpha') setChapterSort(saved)
  }, [novel?.id, novel?.layout?.chapterSort])

  useEffect(() => { if (novel?.id) getWorkspacePreferences(novel.id).then(setWorkspacePrefs) }, [novel?.id])
  const toggleWorkspace = async (key) => {
    const current = workspacePrefs || await getWorkspacePreferences(novel.id)
    const enabled = new Set(current.enabled || [])
    if (enabled.has(key)) enabled.delete(key)
    else enabled.add(key)
    enabled.add('write')
    const next = await updateWorkspacePreferences(novel.id, { enabled: [...enabled] })
    setWorkspacePrefs(next)
  }

  const toggleNavGroup = (group) => setNavCollapsed((s) => {
    const next = new Set(s)
    if (next.has(group)) next.delete(group)
    else next.add(group)
    return next
  })

  const visibleChapters = chapters.filter((c) => {
    // Folder-owned chapters are rendered by their folder row, not again in
    // the legacy outline. This keeps the tree single-source and compact.
    if (c.folderId) return false
    if (!query.trim()) return true
    const text = `${c.title || ''} ${c.kind || ''}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  })

  const numbers = useMemo(() => computeNumbers(chapters), [chapters])
  const sortedVisibleChapters = useMemo(() => {
    const next = [...visibleChapters]
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
    next.sort((a, b) => {
      if (chapterSort === 'alpha') return collator.compare(a.title || titleFor(a, numbers), b.title || titleFor(b, numbers))
      if (chapterSort === 'number') {
        const an = numbers.get(a.id)?.number
        const bn = numbers.get(b.id)?.number
        return collator.compare(String(an ?? ''), String(bn ?? ''))
      }
      return (a.order || 0) - (b.order || 0)
    })
    return next.map((chapter, index) => ({ ...chapter, order: index + 1 }))
  }, [visibleChapters, chapterSort, numbers])
  const tree = useMemo(() => buildTree(sortedVisibleChapters), [sortedVisibleChapters])

  const flat = sortedVisibleChapters
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
      { label: c.favorite ? 'Remove from favorites' : 'Add to favorites', icon: c.favorite ? 'fa-solid fa-star' : 'fa-regular fa-star', onClick: () => onToggleFavorite?.(c) },
      { label: 'Move up', icon: 'fa-solid fa-arrow-up', disabled: i <= 0, onClick: () => onMove(c.id, -1) },
      { label: 'Move down', icon: 'fa-solid fa-arrow-down', disabled: i === -1 || i >= flat.length - 1, onClick: () => onMove(c.id, 1) },
      'divider',
      { label: 'Add chapter here', icon: 'fa-solid fa-file-plus', onClick: () => onAdd('chapter', isContainer(c) ? c.id : c.folderId || c.parentId || null) },
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
      { label: 'New prologue', icon: 'fa-solid fa-feather-pointed', onClick: () => onAdd('prologue', null) },
      { label: 'New epilogue', icon: 'fa-solid fa-feather-pointed', onClick: () => onAdd('epilogue', null) },
      { label: 'New folder', icon: 'fa-solid fa-folder-plus', onClick: () => onAdd('folder', null) },
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
    } else if (!isContainer(target) && isContainer(chapters.find((chapter) => chapter.id === dragId))) {
      // Organizational folders may only be placed beside other outline
      // containers, never inside a writing chapter.
      setDropTarget(null)
      return
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
    const container = isContainer(c) && !c.folderId
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
    const folderIcon = c.icon || (c.kind === 'book' ? 'fa-solid fa-book' : c.kind === 'act' ? 'fa-solid fa-layer-group' : 'fa-solid fa-folder')
    const folderColor = container ? (c.color || 'var(--accent)') : undefined

    return (
      <div key={c.id} className="binder-node">
        <div
          className={`binder-item ${c.id === currentId ? 'active' : ''} ${container ? `is-container folder-theme-${c.folderTheme || 'plain'}` : ''} ${dropTarget === c.id ? 'drop-target' : ''}`}
          style={{ paddingLeft: 12 + depth * 14, ...(folderColor ? { ['--folder-color' as any]: folderColor } : {}) } as CSSProperties}
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
            e.dataTransfer.setData('application/x-moonscribe-item', `chapter:${c.id}`)
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
          <Icon icon={container ? folderIcon : 'fa-regular fa-file-lines'} className="binder-node-icon" style={folderColor ? { color: folderColor } : undefined} />
          <span className="binder-label">{label}</span>
          {c.favorite && <Icon icon="fa-solid fa-star binder-favorite" aria-label="Favorite chapter" />}
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
                  data-tooltip={`${person.username} · ${person.activity === 'writing' ? 'Writing now' : 'Viewing'} · ${person.tabName || 'This chapter'}`}
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

  const renderFolder = (folder, depth = 0) => {
    const childFolders = folders.filter((candidate) => (candidate.parentId || null) === folder.id)
    const childChapters = chapters.filter((chapter) => chapter.folderId === folder.id && (!query.trim() || `${chapter.title || ''} ${chapter.kind || ''}`.toLowerCase().includes(query.trim().toLowerCase())))
    const children = [
      ...childFolders.map((child) => ({ type: 'folder', order: child.order || 0, value: child })),
      ...childChapters.map((chapter) => ({ type: 'chapter', order: chapter.order || 0, value: chapter })),
    ].sort((a, b) => a.order - b.order)
    const isCollapsed = collapsed.has(`folder:${folder.id}`)
    const hasChildren = children.length > 0
    return (
      <div className="binder-node" key={folder.id}>
        <div
          className={`binder-item is-container folder-theme-${folder.theme || 'plain'}${dropTarget === `folder:${folder.id}` ? ' drop-target' : ''}`}
          role="treeitem"
          aria-expanded={hasChildren ? !isCollapsed : undefined}
          tabIndex={0}
          // Folders use a quieter hierarchy than manuscript chapters; the
          // previous 16px step made a second folder look accidentally buried.
          style={{ paddingLeft: `${depth * 10}px` }}
          onClick={() => hasChildren && setCollapsed((current) => { const next = new Set(current); const key = `folder:${folder.id}`; if (next.has(key)) next.delete(key); else next.add(key); return next })}
          onContextMenu={(event) => { event.preventDefault(); openContextMenu(event, [
            { label: 'New chapter inside folder', icon: 'fa-solid fa-file-circle-plus', onClick: () => onAdd('chapter', folder.id) },
            { label: 'Folder settings', icon: 'fa-solid fa-sliders', onClick: () => { setFolderSettingsTab('overview'); setFolderSettings({ ...folder }) } },
            { label: 'Delete folder', icon: 'fa-solid fa-trash', danger: true, onClick: () => onFolderDelete?.(folder) },
          ]) }}
          onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; setDropTarget(`folder:${folder.id}`) }}
          onDragLeave={() => setDropTarget((current) => current === `folder:${folder.id}` ? null : current)}
          onDragEnter={(event) => { event.preventDefault(); event.stopPropagation(); setDropTarget(`folder:${folder.id}`) }}
          onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const payload = readDragPayload(event); if (payload?.startsWith('folder:')) { const sourceId = payload.slice(7); const rect = event.currentTarget.getBoundingClientRect(); const ratio = rect.height ? (event.clientY - rect.top) / rect.height : 0.5; onMoveFolder?.(sourceId, folder.id, ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside') } else if (payload?.startsWith('chapter:')) onMoveToFolder?.(payload.slice(8), folder.id); setDraggingId(null); setDropTarget(null) }}
          draggable
          onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.setData('text/plain', `folder:${folder.id}`); event.dataTransfer.setData('application/x-moonscribe-item', `folder:${folder.id}`); event.dataTransfer.effectAllowed = 'move'; setDraggingId(`folder:${folder.id}`) }}
          onDragEnd={() => { setDraggingId(null); setDropTarget(null) }}
        >
          <span className={`binder-caret${hasChildren ? '' : ' empty'}`}><Icon icon={hasChildren ? (isCollapsed ? 'fa-solid fa-caret-right' : 'fa-solid fa-caret-down') : 'fa-solid fa-caret-right'} /></span>
          <Icon icon={folder.icon || 'fa-solid fa-folder'} className="binder-node-icon" style={folder.color ? { color: folder.color } : undefined} />
          <span className="binder-label">{folder.name}</span>
          <button className="binder-more" type="button" aria-label={`Folder actions for ${folder.name}`} onClick={(event) => { event.stopPropagation(); openContextMenu(event, [{ label: 'New chapter inside folder', icon: 'fa-solid fa-file-circle-plus', onClick: () => onAdd('chapter', folder.id) }, { label: 'Folder settings', icon: 'fa-solid fa-sliders', onClick: () => { setFolderSettingsTab('overview'); setFolderSettings({ ...folder }) } }, { label: 'Delete folder', icon: 'fa-solid fa-trash', danger: true, onClick: () => onFolderDelete?.(folder) }]) }}><Icon icon="fa-solid fa-ellipsis-vertical" /></button>
        </div>
        {hasChildren && !isCollapsed && <div className="binder-children">{children.map((child) => child.type === 'folder' ? renderFolder(child.value, depth + 1) : renderNode({ ch: child.value, children: [] }, depth + 1))}</div>}
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
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
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
              <button
                type="button"
                className="sidebar-icon-btn sidebar-sort-button"
                title={`Sort: ${chapterSort === 'order' ? 'Manuscript order' : chapterSort === 'number' ? 'Chapter number' : 'A–Z by title'}. Click for next sort.`}
                aria-label={`Sort chapters by ${chapterSort === 'order' ? 'manuscript order' : chapterSort === 'number' ? 'chapter number' : 'title'}`}
                onClick={() => {
                  const value = chapterSort === 'order' ? 'number' : chapterSort === 'number' ? 'alpha' : 'order'
                  setChapterSort(value)
                  void updateNovel(novel.id, { layout: { ...(novel.layout || {}), chapterSort: value } })
                }}
              >
                <Icon icon={chapterSort === 'alpha' ? 'fa-solid fa-arrow-down-a-z' : chapterSort === 'number' ? 'fa-solid fa-arrow-down-1-9' : 'fa-solid fa-arrow-down-wide-short'} />
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
              {/* Chapters and folders are separate trees. A folder is a filing
                  container, never an outline chapter or Act. */}
              {!!folders.length && <div className="binder-folders-section binder-folders-primary">
                <div className="binder-section-header binder-folders-header"><span className="binder-section-label"><Icon icon="fa-solid fa-folder-tree" /> Folders</span><span className="binder-folder-count">{folders.length}</span></div>
                <div className="binder-tree binder-folder-tree">{folders.filter((folder) => !folder.parentId).map((folder) => renderFolder(folder, 0))}</div>
              </div>}
              {chapters.length === 0 ? (
                <p className="binder-empty">{folders.length ? 'No loose chapters —' : 'No chapters yet —'}<br />the first one is waiting.</p>
              ) : (
                <div className="binder-tree">
                  {tree.map((node) => renderNode(node, 0))}
                </div>
              )}
              {draggingId && (
                <button
                  type="button"
                  className="binder-root-drop visible"
                  onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move' }}
                  onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const dragId = readDragPayload(event); if (dragId?.startsWith('folder:')) onMoveFolder?.(dragId.slice(7), null, 'root'); else if (dragId?.startsWith('chapter:')) onMoveToFolder?.(dragId.slice(8), null); else if (dragId) onReorder(dragId, null, null); setDraggingId(null); setDropTarget(null) }}
                >
                  <Icon icon="fa-solid fa-arrow-turn-up" /> Move outside folder
                </button>
              )}
              <div className="binder-node binder-media-folder">
                <button className="binder-item binder-media-link" type="button" onClick={() => setMediaCollapsed((value) => !value)} aria-expanded={!mediaCollapsed}>
                  <Icon icon={mediaCollapsed ? 'fa-solid fa-caret-right' : 'fa-solid fa-caret-down'} /><Icon icon="fa-regular fa-images" /><span>Media</span><small>{mediaFiles.length} files</small>
                </button>
                {!mediaCollapsed && <div className="binder-children binder-media-files">
                  {(showAllMedia ? mediaFiles : mediaFiles.slice(0, 5)).map((file) => <button className="binder-item binder-media-file" key={file.id} type="button" onClick={onMediaSelect} onContextMenu={(event) => { event.preventDefault(); openContextMenu(event, [{ label: 'Open Media Library', icon: 'fa-solid fa-images', onClick: onMediaSelect }, { label: 'Delete file', icon: 'fa-solid fa-trash', danger: true, onClick: () => onMediaDelete?.(file) }]) }}><img src={file.image} alt="" className="binder-media-thumb" /><span className="binder-label">{file.text || 'Untitled image'}</span></button>)}
                  {mediaFiles.length > 5 && <button type="button" className="binder-item binder-media-more" onClick={() => setShowAllMedia((value) => !value)}><Icon icon={showAllMedia ? 'fa-solid fa-chevron-up' : 'fa-solid fa-ellipsis'} /><span>{showAllMedia ? 'Show fewer files' : `View all ${mediaFiles.length} files`}</span></button>}
                  {!mediaFiles.length && <button className="binder-media-file binder-media-empty" type="button" onClick={onMediaSelect}><Icon icon="fa-solid fa-plus" /><span>Add your first file</span></button>}
                </div>}
              </div>
            </>
          )}
        </div>

        {/* ── Nav sections (World, Craft, Journal, Archive) ── */}
        <nav className="nav-groups" aria-label="Novel sections">
          <div className="workspace-manager-link"><button type="button" className="nav-item" onClick={() => setWorkspaceManagerOpen(true)}><Icon icon="fa-solid fa-sliders" /><span className="nav-item-label">Customize workspaces</span></button></div>
          {NOVEL_NAV.map((g) => ({ ...g, items: g.items.filter((item) => !(settings.hiddenSidebarTabs || []).includes(item.to) && (!workspacePrefs || (workspacePrefs.enabled || []).includes(item.to))) })).filter((g) => g.items.length > 0).map((g) => {
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
                        <span className="nav-item-live-indicator" aria-hidden="true" title={designerLive ? 'Collaborator active in Designer' : 'Collaborator active in this chapter'} />
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

      {workspaceManagerOpen && <Modal open onClose={() => setWorkspaceManagerOpen(false)} title="Customize workspaces" width={680} className="workspace-manager-modal">
        <p className="workspace-manager-intro">Shape this novel’s studio around the way you work. Choose the spaces you want in the sidebar; Manuscript is always available.</p>
        <div className="workspace-manager-summary"><span><Icon icon="fa-solid fa-layer-group" /> {(workspacePrefs?.enabled || []).length} of {WORKSPACE_REGISTRY.length} workspaces visible</span><span><Icon icon="fa-solid fa-circle-info" /> Changes save instantly</span></div>
        <div className="workspace-manager-list">
          {WORKSPACE_REGISTRY.map((item) => {
            const enabled = item.key === 'write' || (workspacePrefs?.enabled || []).includes(item.key)
            return <label key={item.key} className={`workspace-manager-row${enabled ? ' is-enabled' : ''}${item.required ? ' is-required' : ''}`}>
              <span className="workspace-manager-icon"><Icon icon={item.icon} /></span>
              <span className="workspace-manager-copy"><strong>{item.label}</strong><small>{item.required ? 'Always available' : `${item.group} workspace`}</small></span>
              <span className={`workspace-manager-state${enabled ? ' is-on' : ''}`}>{enabled ? 'Visible' : 'Hidden'}</span>
              <input type="checkbox" checked={enabled} disabled={item.required} onChange={() => void toggleWorkspace(item.key)} aria-label={`${enabled ? 'Hide' : 'Show'} ${item.label}`} />
            </label>
          })}
        </div>
        <div className="modal-foot workspace-manager-foot"><button className="button button-ghost" onClick={async () => { const next = await resetWorkspacePreferences(novel.id); setWorkspacePrefs(next) }}><Icon icon="fa-solid fa-rotate-left" /> Restore defaults</button><button className="button button-primary" onClick={() => setWorkspaceManagerOpen(false)}>Done</button></div>
      </Modal>}

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        <div className="sidebar-user-info">
          <div className={`dashboard-account-card status-${syncStatus || 'offline'}`} onContextMenu={(event) => {
            event.preventDefault()
            openContextMenu(event, [
              { label: syncUsername || 'Local writer', icon: 'fa-solid fa-user', disabled: true },
              'divider',
              { label: 'Settings', icon: 'fa-solid fa-gear', onClick: openSettings },
              { label: 'Sync now', icon: 'fa-solid fa-rotate', onClick: onSyncClick },
              { label: 'Copy username', icon: 'fa-regular fa-copy', disabled: !syncUsername, onClick: () => syncUsername && navigator.clipboard?.writeText(syncUsername) },
              'divider',
              { label: syncUsername ? 'Sign out' : 'Exit offline mode', icon: 'fa-solid fa-right-from-bracket', onClick: async () => { await disconnectSync(); toast(syncUsername ? 'Signed out.' : 'Offline mode closed.') } },
            ])
          }}>
            <button className="dashboard-account-identity" type="button" onClick={(event) => {
              event.preventDefault()
              openContextMenu(event, [
                { label: syncUsername || 'Local writer', icon: 'fa-solid fa-user', disabled: true },
                'divider',
                { label: 'Settings', icon: 'fa-solid fa-gear', onClick: openSettings },
                { label: 'Sync now', icon: 'fa-solid fa-rotate', onClick: onSyncClick },
                'divider',
                { label: syncUsername ? 'Sign out' : 'Exit offline mode', icon: 'fa-solid fa-right-from-bracket', onClick: async () => { await disconnectSync(); toast(syncUsername ? 'Signed out.' : 'Offline mode closed.') } },
              ])
            }} aria-label="Open account menu">
              <span className="dashboard-account-avatar">
                <ProfileAvatar src={syncDiscordAvatar} name={syncUsername || 'MoonScribe writer'} />
                <i className={`dashboard-account-presence ${syncStatus === 'synced' ? 'online' : syncStatus === 'error' ? 'error' : ''}`} />
              </span>
              <span className="dashboard-sidebar-label dashboard-account-copy">
                <strong>{syncUsername || 'Local writer'}</strong>
                <small>{syncStatus === 'synced' ? 'Synced' : syncStatus === 'local' ? 'Saved locally · cloud sync queued' : syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'error' ? 'Sync needs attention' : 'Offline · changes saved locally'}</small>
              </span>
            </button>
            <div className="dashboard-account-actions dashboard-sidebar-label">
              <button type="button" onClick={onSyncClick} aria-label="Sync now" title="Sync now"><Icon icon="fa-solid fa-rotate" /></button>
              {syncProvider === 'discord' && <span title="Connected with Discord" aria-label="Connected with Discord"><Icon icon="fa-brands fa-discord" /></span>}
              <button type="button" onClick={openSettings} aria-label="Open settings" title="Settings"><Icon icon="fa-solid fa-gear" /></button>
            </div>
          </div>
        </div>
        <SyncStatus onClick={onSyncClick} />
        <div className="moonscribe-legal-footer">
          <span>Developed with Love by Hayden Ford</span>
          <a href="https://abr.business.gov.au/ABN/View?abn=47600241842" target="_blank" rel="noreferrer">ABN 47 600 241 842</a>
        </div>
      </div>
      <Modal open={!!folderSettings} onClose={() => setFolderSettings(null)} title="Folder settings" width={680} className="folder-settings-modal">
        {folderSettings && <div className="folder-settings-panel">
          <nav className="folder-settings-tabs" aria-label="Folder settings sections"><button type="button" className={folderSettingsTab === 'overview' ? 'active' : ''} onClick={() => setFolderSettingsTab('overview')}><Icon icon="fa-solid fa-feather-pointed" />Overview</button><button type="button" className={folderSettingsTab === 'appearance' ? 'active' : ''} onClick={() => setFolderSettingsTab('appearance')}><Icon icon="fa-solid fa-palette" />Appearance</button><button type="button" className={folderSettingsTab === 'details' ? 'active' : ''} onClick={() => setFolderSettingsTab('details')}><Icon icon="fa-solid fa-sliders" />Details</button></nav>
          {folderSettingsTab === 'overview' && <><div className="folder-settings-intro"><span>MANUSCRIPT FOLDER</span><strong>Shape how this folder appears in your manuscript.</strong></div><label className="field"><span>Name</span><input value={folderSettings.name} onChange={(event) => setFolderSettings({ ...folderSettings, name: event.target.value })} /></label><div className="field"><span>Folder preview</span><div className="folder-settings-preview"><Icon icon={folderSettings.icon || 'fa-solid fa-folder'} style={{ color: folderSettings.color || 'var(--accent)' }} /><strong>{folderSettings.name || 'New folder'}</strong><small>Organizational folder</small></div></div></>}
          {folderSettingsTab === 'appearance' && <><div className="folder-settings-intro"><span>APPEARANCE</span><strong>Give this folder its own visual character.</strong></div><label className="field"><span>Icon</span><select value={folderSettings.icon || 'fa-solid fa-folder'} onChange={(event) => setFolderSettings({ ...folderSettings, icon: event.target.value })}><option value="fa-solid fa-folder">Folder</option><option value="fa-solid fa-folder-open">Open folder</option><option value="fa-solid fa-star">Starred</option><option value="fa-solid fa-moon">Moon</option><option value="fa-solid fa-feather-pointed">Writing</option></select></label><div className="field folder-colour-picker"><span>Colour</span><div className="folder-colour-picker-control"><input aria-label="Choose folder colour" type="color" value={folderSettings.color || '#c9953d'} onChange={(event) => setFolderSettings({ ...folderSettings, color: event.target.value })} /><output>{folderSettings.color || '#c9953d'}</output></div></div><label className="field"><span>Theme</span><select value={folderSettings.theme || 'plain'} onChange={(event) => setFolderSettings({ ...folderSettings, theme: event.target.value })}><option value="plain">Plain</option><option value="soft">Soft tint</option><option value="outline">Outline</option><option value="glow">Glow</option></select></label></>}
          {folderSettingsTab === 'details' && <><div className="folder-settings-intro"><span>DETAILS</span><strong>Folder structure and behavior.</strong></div><div className="folder-settings-detail-grid"><div><span>Contents</span><strong>{chapters.filter((chapter) => chapter.folderId === folderSettings.id).length} documents</strong><small>Chapters and manuscript pages</small></div><div><span>Location</span><strong>{folderSettings.parentId ? 'Nested folder' : 'Manuscript root'}</strong><small>{folderSettings.parentId ? 'Inside another folder' : 'Top-level manuscript folder'}</small></div><div><span>Created</span><strong>{folderSettings.createdAt ? new Date(folderSettings.createdAt).toLocaleDateString() : 'Earlier version'}</strong><small>Folder record</small></div><div><span>Status</span><strong>{folderSettings.isExpanded === false ? 'Collapsed' : 'Expanded'}</strong><small>Sidebar display state</small></div></div></>}
          <div className="modal-foot"><button type="button" className="btn secondary" onClick={() => setFolderSettings(null)}>Cancel</button><button type="button" className="btn primary" onClick={async () => { await onFolderSettings?.(folderSettings); setFolderSettings(null) }}>Save changes</button></div>
        </div>}
      </Modal>
    </aside>
  )
}
