import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listTrash, restoreTrashed, purgeTrashed, emptyTrash, TRASH_TTL_MS } from '../db/trash'
import { useApp } from '../context/AppContext'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'
import { timeAgo } from '../utils/dates'
import Select from '../components/Select'

const STORE_LABELS = {
  novels: 'Novel',
  chapters: 'Chapter',
  characters: 'Character',
  notes: 'Note',
  world: 'Worldbuilding',
  glossary: 'Term',
  projectFiles: 'Project file',
}
const STORE_ICONS = {
  novels: 'fa-solid fa-book',
  chapters: 'fa-regular fa-file-lines',
  characters: 'fa-regular fa-user',
  notes: 'fa-regular fa-note-sticky',
  world: 'fa-solid fa-globe',
  glossary: 'fa-solid fa-book-open',
  projectFiles: 'fa-regular fa-folder',
}
const PAGE_SIZE = 8

function titleOf(store, rec) {
  if (store === 'novels') return rec.title || 'Untitled novel'
  if (store === 'chapters') return rec.title || 'Untitled chapter'
  if (store === 'characters') return rec.name || 'A character'
  if (store === 'notes') return rec.title || 'Untitled note'
  if (store === 'glossary') return rec.term || 'Untitled term'
  return rec.name || rec.title || 'Untitled entry'
}
function mediaSource(rec) {
  return rec.thumbnail || rec.image || rec.imageUrl || rec.url || rec.dataUrl || rec.sourceUrl || ''
}
function deletedAt(rec) {
  return Number(rec.trashedAt || rec.deletedAt || Date.now())
}
function daysLeft(rec) {
  return Math.max(0, Math.ceil((deletedAt(rec) + TRASH_TTL_MS - Date.now()) / 86400000))
}
function categoryLabel(store) {
  return STORE_LABELS[store] || store
}

function TrashItemIcon({ store, rec }) {
  const src = store === 'projectFiles' ? mediaSource(rec) : ''
  return src ? (
    <img
      className="trash-item-thumb"
      src={src}
      alt=""
      onError={(event) => {
        event.currentTarget.style.display = 'none'
      }}
    />
  ) : (
    <span className="trash-item-icon">
      <Icon icon={STORE_ICONS[store] || 'fa-regular fa-file'} />
    </span>
  )
}
function Retention({ rec }) {
  const days = daysLeft(rec)
  return (
    <span className={`trash-retention ${days <= 2 ? 'critical' : days <= 7 ? 'warning' : ''}`}>
      <Icon icon="fa-regular fa-clock" /> {days} {days === 1 ? 'day' : 'days'} left
    </span>
  )
}
function TrashItem({ item, onRestore, onPurge, view, busy }) {
  const { store, rec } = item
  const title = titleOf(store, rec)
  const novel =
    rec.novelTitle ||
    rec.projectTitle ||
    rec.novelName ||
    (store === 'novels' ? 'MoonScribe library' : 'Current novel')
  return (
    <article className={`trash-item ${view === 'grid' ? 'trash-item-card' : ''}`}>
      <TrashItemIcon store={store} rec={rec} />
      <div className="trash-item-copy">
        <div className="trash-item-heading">
          <strong>
            {categoryLabel(store)}: {title}
          </strong>
          <span className="trash-item-menu" aria-hidden="true">
            •••
          </span>
        </div>
        <span className="trash-item-parent">
          {categoryLabel(store)} <span aria-hidden="true">›</span> {novel}
        </span>
        <span className="trash-item-time">
          Deleted {timeAgo(deletedAt(rec))} <Retention rec={rec} />
        </span>
      </div>
      <div className="trash-item-actions">
        <button className="button button-ghost" disabled={busy} onClick={() => onRestore(item)}>
          <Icon icon="fa-solid fa-arrow-rotate-left" /> Restore
        </button>
        <button
          className="button button-quiet trash-delete-button"
          disabled={busy}
          onClick={() => onPurge(item)}
        >
          <Icon icon="fa-solid fa-trash-can" /> Delete forever
        </button>
        <button className="trash-more" aria-label={`More actions for ${title}`} disabled={busy}>
          •••
        </button>
      </div>
    </article>
  )
}

export default function Trash({ novelId = null, embedded = false } = {}) {
  const { id } = useParams()
  const nid = novelId || id
  const { toast } = useApp()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [purgeTarget, setPurgeTarget] = useState(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem('moonscribe-trash-view') || 'list'
    } catch {
      return 'list'
    }
  })
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listTrash(nid))
    } catch {
      setError('Couldn’t load the archive. Try again.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [nid])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    setPage(1)
  }, [query, type, sort])
  const changeView = (next) => {
    setView(next)
    try {
      localStorage.setItem('moonscribe-trash-view', next)
    } catch {
      /* storage may be unavailable in private mode */
    }
  }
  const categories = useMemo(() => {
    const counts = items.reduce((map, item) => {
      map[item.store] = (map[item.store] || 0) + 1
      return map
    }, {})
    return [
      { key: 'all', label: 'All items', count: items.length },
      ...Object.keys(counts).map((key) => ({ key, label: categoryLabel(key), count: counts[key] })),
    ]
  }, [items])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter(({ store, rec }) => {
        if (type !== 'all' && store !== type) return false
        if (!q) return true
        return [
          titleOf(store, rec),
          categoryLabel(store),
          rec.novelTitle,
          rec.projectTitle,
          rec.name,
          rec.title,
          rec.term,
          rec.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => {
        if (sort === 'oldest') return deletedAt(a.rec) - deletedAt(b.rec)
        if (sort === 'nameAsc')
          return titleOf(a.store, a.rec).localeCompare(titleOf(b.store, b.rec))
        if (sort === 'nameDesc')
          return titleOf(b.store, b.rec).localeCompare(titleOf(a.store, a.rec))
        if (sort === 'remaining') return daysLeft(a.rec) - daysLeft(b.rec)
        return deletedAt(b.rec) - deletedAt(a.rec)
      })
  }, [items, query, type, sort])
  const pages = Math.ceil(visible.length / PAGE_SIZE)
  const paged = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const restore = async (item) => {
    setBusy(`restore:${item.store}:${item.rec.id}`)
    try {
      await restoreTrashed(item.store, item.rec.id)
      await load()
      toast('Item restored.')
    } catch {
      toast('Couldn’t restore item.')
    } finally {
      setBusy('')
    }
  }
  const purge = async () => {
    if (!purgeTarget) return
    setBusy(`purge:${purgeTarget.store}:${purgeTarget.rec.id}`)
    try {
      await purgeTrashed(purgeTarget.store, purgeTarget.rec.id)
      setPurgeTarget(null)
      await load()
      toast('Item permanently deleted.')
    } catch {
      toast('Couldn’t delete item.')
    } finally {
      setBusy('')
    }
  }
  const restoreAll = async () => {
    setBusy('restore-all')
    try {
      for (const item of items) await restoreTrashed(item.store, item.rec.id)
      await load()
      toast('Trash restored.')
    } catch {
      toast('Couldn’t restore all items.')
    } finally {
      setBusy('')
    }
  }
  const clearAll = async () => {
    setBusy('empty')
    try {
      const n = await emptyTrash(nid)
      setConfirmEmpty(false)
      await load()
      toast(
        n
          ? `Trash emptied — ${n} ${n === 1 ? 'item' : 'items'} removed.`
          : 'The trash is already empty.'
      )
    } catch {
      toast('Couldn’t empty trash.')
    } finally {
      setBusy('')
    }
  }
  return (
    <div className={embedded ? undefined : 'app'}>
      <div className="page page-wide trash-studio">
        <section className="trash-hero">
          <div className="trash-hero-copy">
            <span className="eyebrow">Archive recovery</span>
            <h2>Trash</h2>
            <p>
              Deleted novels, chapters, characters, notes and worldbuilding — recoverable for 30
              days.
            </p>
          </div>
          <div className="trash-hero-actions">
            <div className="trash-protected">
              <Icon icon="fa-regular fa-clock" />
              <span>30 days protected</span>
            </div>
            <div className="trash-action-buttons">
              <button
                className="button button-ghost"
                disabled={!items.length || !!busy}
                onClick={() => setBusy('restore-confirm')}
              >
                <Icon icon="fa-solid fa-arrow-rotate-left" /> Restore all
              </button>
              <button
                className="button button-quiet trash-empty-button"
                disabled={!items.length || !!busy}
                onClick={() => setConfirmEmpty(true)}
              >
                <Icon icon="fa-solid fa-trash-can" /> Empty trash
              </button>
            </div>
          </div>
        </section>
        {items.length > 0 && (
          <>
            <nav className="trash-filters" aria-label="Trash categories">
              {categories.map((category) => (
                <button
                  key={category.key}
                  className={type === category.key ? 'active' : ''}
                  onClick={() => setType(category.key)}
                >
                  {category.label} <span>{category.count}</span>
                </button>
              ))}
            </nav>
            <div className="trash-toolbar">
              <label className="trash-search">
                <Icon icon="fa-solid fa-magnifying-glass" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search deleted items…"
                  aria-label="Search deleted items"
                />
              </label>
              <Select
                value={sort}
                onChange={setSort}
                aria-label="Sort deleted items"
                options={[
                  { value: 'newest', label: 'Date deleted (newest)' },
                  { value: 'oldest', label: 'Date deleted (oldest)' },
                  { value: 'nameAsc', label: 'Name (A–Z)' },
                  { value: 'nameDesc', label: 'Name (Z–A)' },
                  { value: 'remaining', label: 'Time remaining' },
                ]}
              />
              <div className="trash-view-toggle" aria-label="View mode">
                <button
                  className={view === 'grid' ? 'active' : ''}
                  onClick={() => changeView('grid')}
                  aria-label="Grid view"
                >
                  <Icon icon="fa-solid fa-table-cells" /> Grid
                </button>
                <button
                  className={view === 'list' ? 'active' : ''}
                  onClick={() => changeView('list')}
                  aria-label="List view"
                >
                  <Icon icon="fa-solid fa-list" /> List
                </button>
              </div>
            </div>
          </>
        )}
        {loading ? (
          <div className="trash-state">
            <Icon icon="fa-solid fa-spinner" />
            <strong>Opening the archive…</strong>
          </div>
        ) : error ? (
          <div className="trash-state trash-state-error">
            <Icon icon="fa-solid fa-circle-exclamation" />
            <strong>{error}</strong>
            <button className="button button-ghost" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : !items.length ? (
          <div className="trash-state">
            <Icon icon="fa-solid fa-box-archive" />
            <strong>Trash is empty</strong>
            <span>
              Nothing is waiting to be recovered. Deleted items will appear here for up to 30 days.
            </span>
          </div>
        ) : !visible.length ? (
          <div className="trash-state">
            <Icon icon="fa-solid fa-magnifying-glass" />
            <strong>No matching items</strong>
            <span>Try another search or category.</span>
          </div>
        ) : (
          <>
            <div className={`trash-list ${view === 'grid' ? 'is-grid' : ''}`}>
              {paged.map((item) => (
                <TrashItem
                  key={`${item.store}:${item.rec.id}`}
                  item={item}
                  view={view}
                  busy={!!busy}
                  onRestore={restore}
                  onPurge={setPurgeTarget}
                />
              ))}
            </div>
            <div className="trash-results">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visible.length)} of{' '}
                {visible.length} items
              </span>
              {pages > 1 && (
                <nav aria-label="Trash pages">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    aria-label="Previous page"
                  >
                    ‹
                  </button>
                  {Array.from({ length: pages }, (_, index) => (
                    <button
                      key={index + 1}
                      className={page === index + 1 ? 'active' : ''}
                      onClick={() => setPage(index + 1)}
                    >
                      {index + 1}
                    </button>
                  ))}
                  <button
                    disabled={page === pages}
                    onClick={() => setPage(page + 1)}
                    aria-label="Next page"
                  >
                    ›
                  </button>
                </nav>
              )}
            </div>
          </>
        )}
        <aside className="trash-retention-notice">
          <Icon icon="fa-solid fa-circle-info" />
          <div>
            <strong>Items are automatically deleted after 30 days.</strong>
            <span>
              You can restore items at any time during this period. After 30 days, they will be
              permanently removed and cannot be recovered.
            </span>
          </div>
        </aside>
      </div>
      <ConfirmDialog
        open={!!purgeTarget}
        onClose={() => setPurgeTarget(null)}
        onConfirm={purge}
        title={`Delete “${purgeTarget ? titleOf(purgeTarget.store, purgeTarget.rec) : ''}” forever?`}
        confirmLabel="Delete forever"
      >
        This item will be permanently removed and cannot be recovered.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        onConfirm={clearAll}
        title="Empty the trash?"
        confirmLabel="Empty trash"
      >
        Everything in the trash will be permanently deleted. This cannot be undone.
      </ConfirmDialog>
      <ConfirmDialog
        open={busy === 'restore-confirm'}
        onClose={() => setBusy('')}
        onConfirm={restoreAll}
        title="Restore all items?"
        confirmLabel="Restore all"
      >
        All deleted items will return to their original locations.
      </ConfirmDialog>
    </div>
  )
}
