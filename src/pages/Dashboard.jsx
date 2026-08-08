import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createNovel, updateNovel, deleteNovel, listNovels } from '../db/novels'
import { createChapter } from '../db/chapters'
import { wordsAndChapters } from '../db/chapters'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import SettingsModal from '../components/SettingsModal'
import AuthModal from '../components/AuthModal'
import SyncStatus from '../components/SyncStatus'
import { useContextMenu } from '../components/ContextMenu'
import Icon from '../components/Icon'
import { timeAgo } from '../utils/dates'
import { formatWords } from '../utils/words'

const COVER_STYLES = [
  { key: 'moonstone', label: 'Moonstone' },
  { key: 'rose', label: 'Rose' },
  { key: 'sage', label: 'Sage' },
  { key: 'sand', label: 'Sand' },
  { key: 'twilight', label: 'Twilight' }
]

const GENRES = ['Fantasy', 'Sci-Fi', 'Romance', 'Mystery', 'Thriller', 'Horror', 'Literary', 'Historical', 'Young Adult', 'Poetry', 'Memoir', 'Other']

function initials(title) {
  return (title || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// Turns a stored Blob into a revokable object URL for <img>.
function useBlobUrl(blob) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

function NovelCard({ novel, counts, onOpen, onRename, onDelete, onCover }) {
  const coverUrl = useBlobUrl(novel.cover)
  const { openContextMenu } = useContextMenu()
  const cardMenu = (e) =>
    openContextMenu(e, [
      { label: 'Open', icon: 'fa-solid fa-book-open', onClick: () => onOpen(novel) },
      { label: 'Cover', icon: 'fa-regular fa-image', onClick: () => onCover(novel) },
      { label: 'About / rename', icon: 'fa-solid fa-pen', onClick: () => onRename(novel) },
      'divider',
      { label: 'Delete novel', icon: 'fa-solid fa-trash', danger: true, onClick: () => onDelete(novel) }
    ])
  return (
    <div className="novel-card" onClick={() => onOpen(novel)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(novel)} onContextMenu={cardMenu}>
      <div className={`novel-cover cover-${novel.coverStyle || 'moonstone'}`}>
        {coverUrl ? (
          <img src={coverUrl} alt="" />
        ) : (
          <span className="cover-initials">{initials(novel.title)}</span>
        )}
      </div>
      <div className="novel-menu">
        <button className="button button-quiet" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }} onClick={(e) => { e.stopPropagation(); onCover(novel) }} title="Cover">
          <Icon icon="fa-regular fa-image" />
        </button>
        <button className="button button-quiet" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }} onClick={(e) => { e.stopPropagation(); onRename(novel) }} title="About / rename">
          <Icon icon="fa-solid fa-pen" />
        </button>
        <button className="button button-quiet" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }} onClick={(e) => { e.stopPropagation(); onDelete(novel) }} title="Delete novel">
          <Icon icon="fa-solid fa-trash" />
        </button>
      </div>
      <div className="novel-body">
        <div className="novel-title">{novel.title}</div>
        {novel.genres?.length > 0 && (
          <div className="novel-genres">
            {novel.genres.map((g) => (
              <span key={g} className="tag">{g}</span>
            ))}
          </div>
        )}
        {novel.blurb && <p className="novel-blurb">{novel.blurb}</p>}
        <div className="novel-meta">
          <span className="novel-words">{formatWords(counts?.words || 0)} words</span>
          <span>
            {counts?.chapters || 0} ch · {timeAgo(novel.lastOpened || novel.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { novels, refreshNovels, toast, syncNow } = useApp()
  const navigate = useNavigate()
  const [counts, setCounts] = useState({})
  const [newOpen, setNewOpen] = useState(false)
  const [editNovel, setEditNovel] = useState(null)
  const [deleteNovelTarget, setDeleteNovelTarget] = useState(null)
  const [coverNovel, setCoverNovel] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [genreFilter, setGenreFilter] = useState(null)

  useEffect(() => {
    async function load() {
      const all = await listNovels()
      const map = {}
      await Promise.all(
        all.map(async (n) => {
          map[n.id] = await wordsAndChapters(n.id)
        })
      )
      setCounts(map)
    }
    load()
  }, [novels])

  const openNovel = async (novel) => {
    await updateNovel(novel.id, { lastOpened: Date.now() }, { sync: false })
    navigate(`/novel/${novel.id}`)
  }

  const handleCreate = async ({ title, blurb, coverStyle, genres }) => {
    const novel = await createNovel({ title, blurb, coverStyle, genres })
    await createChapter(novel.id, { title: 'Chapter One', content: '' })
    await refreshNovels()
    toast('A new story begins. ✧')
    navigate(`/novel/${novel.id}`)
  }

  const handleRename = async (patch) => {
    await updateNovel(editNovel.id, patch)
    setEditNovel(null)
    await refreshNovels()
  }

  const handleDelete = async () => {
    await deleteNovel(deleteNovelTarget.id)
    setDeleteNovelTarget(null)
    await refreshNovels()
    toast('Gone, but the stories stay with you.')
  }

  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Still awake' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const q = query.trim().toLowerCase()
  const visible = novels.filter((n) => {
    if (genreFilter && !(n.genres || []).includes(genreFilter)) return false
    if (!q) return true
    const hay = `${n.title} ${n.blurb || ''} ${(n.genres || []).join(' ')}`.toLowerCase()
    return hay.includes(q)
  })
  const allGenres = [...new Set(novels.flatMap((n) => n.genres || []))].sort()

  return (
    <div className="app">
      <div className="dashboard">
        <div className="topbar">
          <div>
            <div className="brand-row">
              <span className="brand">
                Moonscribe<span className="brand-mark">✦</span>
              </span>
              <span className="tagline">a quiet place to write, made for two</span>
            </div>
          </div>
          <div className="actions-row">
            <SyncStatus onClick={() => setConnectOpen(true)} />
            <button className="button button-ghost" onClick={() => syncNow()} title="Sync now">
              <Icon icon="fa-solid fa-rotate" style={{ marginRight: 6 }} /> Sync
            </button>
            <button className="button button-ghost" onClick={() => setSettingsOpen(true)}>
              <Icon icon="fa-solid fa-gear" style={{ marginRight: 6 }} /> Settings
            </button>
          </div>
        </div>

        <div className="dashboard-hello">
          <h1>{greeting}{novels.length ? ',' : ''}</h1>
          {novels.length > 0 ? (
            <p>Pick up where a story left off — or begin another.</p>
          ) : (
            <p>This is where the first page starts. There’s no hurry.</p>
          )}
        </div>

        {novels.length > 0 && (
          <div className="dashboard-tools">
            <div className="search-wrap">
              <Icon icon="fa-solid fa-magnifying-glass" />
              <input
                className="search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles, ideas, genres…"
                aria-label="Search novels"
              />
              {query && (
                <button className="button button-quiet" onClick={() => setQuery('')} aria-label="Clear search">
                  <Icon icon="fa-solid fa-xmark" />
                </button>
              )}
            </div>
            <div className="genre-chips">
              <button
                className={`chip ${genreFilter === null ? 'active' : ''}`}
                onClick={() => setGenreFilter(null)}
              >
                All
              </button>
              {(allGenres.length ? allGenres : GENRES).slice(0, 12).map((g) => (
                <button key={g} className={`chip ${genreFilter === g ? 'active' : ''}`} onClick={() => setGenreFilter(genreFilter === g ? null : g)}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="novel-grid">
          {visible.map((n) => (
            <NovelCard
              key={n.id}
              novel={n}
              counts={counts[n.id]}
              onOpen={openNovel}
              onRename={setEditNovel}
              onDelete={setDeleteNovelTarget}
              onCover={setCoverNovel}
            />
          ))}
          {visible.length === 0 && novels.length > 0 && (
            <div className="empty" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-icon"><Icon icon="fa-solid fa-magnifying-glass" /></div>
              <h3>Nothing here</h3>
              <p>{q ? `No novel matches “${query}”.` : `No ${genreFilter} novels yet.`} Try another search.</p>
              <button className="button button-ghost" onClick={() => { setQuery(''); setGenreFilter(null) }}>Clear filters</button>
            </div>
          )}
          <button className="novel-card new-novel-card" onClick={() => setNewOpen(true)}>
            <span className="plus"><Icon icon="fa-solid fa-plus" /></span>
            New novel
          </button>
        </div>
      </div>

      <NewNovelModal open={newOpen} onClose={() => setNewOpen(false)} onCreate={handleCreate} />
      <RenameModal novel={editNovel} onClose={() => setEditNovel(null)} onSave={handleRename} />
      <ConfirmDialog
        open={!!deleteNovelTarget}
        onClose={() => setDeleteNovelTarget(null)}
        onConfirm={handleDelete}
        title="Set this novel free?"
      >
        “{deleteNovelTarget?.title}” and all its chapters, characters and notes will be removed from this device. This can’t be undone.
      </ConfirmDialog>
      <CoverModal novel={coverNovel} onClose={() => setCoverNovel(null)} onDone={refreshNovels} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onConnect={() => { setSettingsOpen(false); setConnectOpen(true) }} />
      <AuthModal open={connectOpen} onClose={() => setConnectOpen(false)} />
    </div>
  )
}

function GenrePicker({ value, onChange }) {
  const toggle = (g) => {
    const next = value.includes(g) ? value.filter((x) => x !== g) : [...value, g]
    onChange(next)
  }
  return (
    <div className="genre-chips">
      {GENRES.map((g) => (
        <button key={g} type="button" className={`chip ${value.includes(g) ? 'active' : ''}`} onClick={() => toggle(g)}>
          {g}
        </button>
      ))}
    </div>
  )
}

function NewNovelModal({ open, onClose, onCreate }) {
  const [title, setTitle] = useState('')
  const [blurb, setBlurb] = useState('')
  const [coverStyle, setCoverStyle] = useState('moonstone')
  const [genres, setGenres] = useState([])

  useEffect(() => {
    if (open) {
      setTitle('')
      setBlurb('')
      setCoverStyle('moonstone')
      setGenres([])
    }
  }, [open])

  const submit = () => {
    onCreate({ title: title.trim(), blurb: blurb.trim(), coverStyle, genres })
  }

  return (
    <Modal open={open} onClose={onClose} title="Begin a novel">
      <div className="field">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A title, or none yet…" autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </div>
      <div className="field">
        <label>One-line idea <span className="hint">(optional)</span></label>
        <input value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="Two strangers, one small town…" />
      </div>
      <div className="field">
        <label>Genre <span className="hint">(optional)</span></label>
        <GenrePicker value={genres} onChange={setGenres} />
      </div>
      <div className="field">
        <label>Cover colour</label>
        <div className="swatch-row">
          {COVER_STYLES.map((c) => (
            <button
              key={c.key}
              className={`swatch cover-${c.key} ${coverStyle === c.key ? 'selected' : ''}`}
              onClick={() => setCoverStyle(c.key)}
              title={c.label}
              aria-label={c.label}
              style={{ width: 40, height: 40, borderRadius: 12 }}
            />
          ))}
        </div>
      </div>
      <div className="modal-foot">
        <button className="button button-ghost" onClick={onClose}>Not yet</button>
        <button className="button button-primary" onClick={submit}>Begin writing</button>
      </div>
    </Modal>
  )
}

function RenameModal({ novel, onClose, onSave }) {
  const [title, setTitle] = useState('')
  const [blurb, setBlurb] = useState('')
  const [genres, setGenres] = useState([])

  useEffect(() => {
    if (novel) {
      setTitle(novel.title || '')
      setBlurb(novel.blurb || '')
      setGenres(novel.genres || [])
    }
  }, [novel])

  return (
    <Modal open={!!novel} onClose={onClose} title="About this novel">
      <div className="field">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label>One-line idea</label>
        <input value={blurb} onChange={(e) => setBlurb(e.target.value)} />
      </div>
      <div className="field">
        <label>Genre</label>
        <GenrePicker value={genres} onChange={setGenres} />
      </div>
      <div className="modal-foot">
        <button className="button button-ghost" onClick={onClose}>Cancel</button>
        <button className="button button-primary" onClick={() => onSave({ title: title.trim() || 'Untitled', blurb: blurb.trim(), genres })}>
          Save
        </button>
      </div>
    </Modal>
  )
}

function CoverModal({ novel, onClose, onDone }) {
  const [coverStyle, setCoverStyle] = useState('moonstone')

  useEffect(() => {
    if (novel) setCoverStyle(novel.coverStyle || 'moonstone')
  }, [novel])

  const pickImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !novel) return
    await updateNovel(novel.id, { cover: file })
    onDone()
    onClose()
  }

  const removeImage = async () => {
    await updateNovel(novel.id, { cover: null })
    onDone()
    onClose()
  }

  return (
    <Modal open={!!novel} onClose={onClose} title="Cover" width={440}>
      <div className="field">
        <label>Colour</label>
        <div className="swatch-row">
          {COVER_STYLES.map((c) => (
            <button key={c.key} className={`swatch cover-${c.key} ${coverStyle === c.key ? 'selected' : ''}`} onClick={() => { setCoverStyle(c.key); updateNovel(novel.id, { coverStyle: c.key }); onDone(); }} />
          ))}
        </div>
      </div>
      <div className="field">
        <label>Picture <span className="hint">(optional — stays on this device)</span></label>
        <input type="file" accept="image/*" onChange={pickImage} />
      </div>
      {novel?.cover && (
        <div className="actions-row" style={{ marginBottom: 12 }}>
          <button className="button button-ghost" onClick={removeImage}>Remove picture</button>
        </div>
      )}
    </Modal>
  )
}
