import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createNovel, updateNovel, deleteNovel, listNovels, getNovel, archiveNovel, unarchiveNovel, duplicateNovelStructure } from '../db/novels'
import { makeLock, verifyLock } from '../db/lock'
import { exportBackup } from '../db/backup'
import { getMeta, setMeta } from '../db/meta'
import { downloadBlob } from '../utils/download'
import { createChapter } from '../db/chapters'
import { wordsAndChapters } from '../db/chapters'
import { monthlyWordsAllNovels, currentStreak } from '../db/stats'
import { NOVEL_TEMPLATES } from '../templates'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import AuthModal from '../components/AuthModal'
import SyncStatus from '../components/SyncStatus'
import UserPill from '../components/UserPill'
import { useContextMenu } from '../components/ContextMenu'
import Icon from '../components/Icon'
import { timeAgo } from '../utils/dates'
import { formatWords } from '../utils/words'
import { searchAll } from '../db/search'
import { acceptShareInvite } from '../sync/engine'

const COVER_STYLES = [
  { key: 'moonstone', label: 'Moonstone' },
  { key: 'rose', label: 'Rose' },
  { key: 'sage', label: 'Sage' },
  { key: 'sand', label: 'Sand' },
  { key: 'twilight', label: 'Twilight' }
]

const GENRES = ['Fantasy', 'Sci-Fi', 'Romance', 'Mystery', 'Thriller', 'Horror', 'Literary', 'Historical', 'Young Adult', 'Poetry', 'Memoir', 'Other']

const COLLECTIONS = [
  { key: null, label: 'All' },
  { key: 'working-on', label: 'Working On' },
  { key: 'on-hold', label: 'On Hold' },
  { key: 'drafting', label: 'Drafting' },
  { key: 'finished', label: 'Finished' },
  { key: 'ideas', label: 'Ideas' }
]

const WRITING_QUOTES = [
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'There is no greater agony than bearing an untold story inside you.', author: 'Maya Angelou' },
  { text: 'Start writing, no matter what. The water does not flow until the faucet is turned on.', author: 'Louis L\'Amour' },
  { text: 'You have to write the book that wants to be written.', author: 'Madeleine L\'Engle' },
  { text: 'The first draft is just you telling yourself the story.', author: 'Terry Pratchett' },
  { text: 'Writing is hard work. A clear sentence is no accident.', author: 'William Zinsser' },
  { text: 'The writer who waits for ideal conditions will die without putting a word on paper.', author: 'E.B. White' },
  { text: 'Stories are a communal currency of humanity.', author: 'Tahir Shah' },
  { text: 'We are all storytellers. We all live in a network of stories.', author: 'Neil Gaiman' },
  { text: 'You can make anything by writing.', author: 'C.S. Lewis' },
  { text: 'The very first thing I tell my new students on the first day of a workshop is that good writing is about telling the truth.', author: 'Anne Lamott' },
  { text: 'Writing is an exploration. You start from nothing and learn as you go.', author: 'E.L. Doctorow' }
]

function initials(title) {
  return (title || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function useBlobUrl(blob) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob) { setUrl(null); return }
    if (typeof blob === 'string') {
      setUrl(/^(data:|blob:|https?:\/\/)/i.test(blob) ? blob : null)
      return
    }
    if (!(blob instanceof Blob)) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

function daysBetween(ts) {
  if (!ts) return Infinity
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24))
}

function NovelCard({ novel, counts, onOpen, onRename, onDelete, onCover, onArchive, onToggleLock, onPin, onDuplicate, listView }) {
  const coverUrl = useBlobUrl(novel.cover)
  const { openContextMenu } = useContextMenu()
  const novelCounts =
    counts && typeof counts === 'object' && ('words' in counts || 'chapters' in counts)
      ? counts
      : (counts?.[novel.id] || { words: 0, chapters: 0 })
  const dormant = !novel.archived && daysBetween(novel.lastOpened || novel.updatedAt) > 14
  const dormantDays = daysBetween(novel.lastOpened || novel.updatedAt)
  const isFinished = novel.collection === 'finished'
  const progressPct = novel.novelWordGoal > 0
    ? Math.min(100, Math.round(((novelCounts.words || 0) / novel.novelWordGoal) * 100))
    : null

  const cardMenu = (e) =>
    openContextMenu(e, [
      { label: 'Open', icon: 'fa-solid fa-book-open', onClick: () => onOpen(novel) },
      { label: 'Cover', icon: 'fa-regular fa-image', onClick: () => onCover(novel) },
      { label: 'About / rename', icon: 'fa-solid fa-pen', onClick: () => onRename(novel) },
      novel.pinned
        ? { label: 'Unpin', icon: 'fa-solid fa-thumbtack', onClick: () => onPin(novel, false) }
        : { label: 'Pin to top', icon: 'fa-solid fa-thumbtack', onClick: () => onPin(novel, true) },
      novel.lock
        ? { label: 'Remove lock…', icon: 'fa-solid fa-lock-open', onClick: () => onToggleLock(novel) }
        : { label: 'Lock this novel…', icon: 'fa-solid fa-lock', onClick: () => onToggleLock(novel) },
      { label: novel.archived ? 'Restore to shelf' : 'Archive', icon: 'fa-solid fa-box-archive', onClick: () => onArchive(novel) },
      { label: 'Duplicate structure as template', icon: 'fa-solid fa-copy', onClick: () => onDuplicate(novel) },
      'divider',
      { label: 'Delete novel', icon: 'fa-solid fa-trash', danger: true, onClick: () => onDelete(novel) }
    ])

  if (listView) {
    return (
      <div
        className={`novel-list-row ${dormant ? 'novel-card-dormant' : ''}`}
        onClick={() => onOpen(novel)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(novel)}
        onContextMenu={cardMenu}
      >
        <div className={`novel-list-cover cover-${novel.coverStyle || 'moonstone'}`}>
          {coverUrl ? <img src={coverUrl} alt="" /> : <span>{initials(novel.title)}</span>}
        </div>
        <div className="novel-list-body">
          <div className="novel-list-title">
            {novel.pinned && <Icon icon="fa-solid fa-thumbtack" style={{ marginRight: 5, fontSize: '0.7rem', color: 'var(--moon)' }} />}
            {novel.title}
            {isFinished && <span className="finished-badge">✓</span>}
            {novel.sharedRole && <span className="shared-novel-badge"><Icon icon="fa-solid fa-user-group" /> Shared</span>}
          </div>
          {novel.genres?.length > 0 && (
            <div className="novel-genres">
              {novel.genres.map((g) => <span key={g} className="tag">{g}</span>)}
            </div>
          )}
        </div>
        <div className="novel-list-stats">
          <span className="novel-words">{formatWords(novelCounts.words || 0)}</span>
          <span className="muted">{novelCounts.chapters || 0} ch</span>
          <span className="muted">{timeAgo(novel.lastOpened || novel.updatedAt)}</span>
          {progressPct !== null && (
            <span className="novel-list-progress" title={`${progressPct}% of goal`}>
              <span className="novel-progress-bar"><span style={{ width: `${progressPct}%` }} /></span>
              {progressPct}%
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`novel-card ${dormant ? 'novel-card-dormant' : ''}`}
      onClick={() => onOpen(novel)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(novel)}
      onContextMenu={cardMenu}
    >
      <div className={`novel-cover cover-${novel.coverStyle || 'moonstone'}`}>
        {coverUrl ? (
          <img src={coverUrl} alt="" />
        ) : (
          <span className="cover-initials">{initials(novel.title)}</span>
        )}
        {novel.lock && <span className="novel-lock-badge" title="Locked"><Icon icon="fa-solid fa-lock" /></span>}
        {novel.pinned && <span className="novel-pin-badge" title="Pinned"><Icon icon="fa-solid fa-thumbtack" /></span>}
        {isFinished && <span className="novel-finished-ribbon">✓</span>}
        {novel.sharedRole && <span className="novel-shared-ribbon" title={`Shared with ${novel.sharedRole} access`}><Icon icon="fa-solid fa-user-group" /> Shared</span>}
      </div>
      <div className="novel-menu">
        <button className="button button-quiet" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }} onClick={(e) => { e.stopPropagation(); onPin(novel, !novel.pinned) }} title={novel.pinned ? 'Unpin' : 'Pin to top'}>
          <Icon icon="fa-solid fa-thumbtack" style={{ color: novel.pinned ? 'var(--moon)' : undefined }} />
        </button>
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
          <span className="novel-words">{formatWords(novelCounts.words || 0)} words</span>
          <span>
            {novelCounts.chapters || 0} ch · {timeAgo(novel.lastOpened || novel.updatedAt)}
          </span>
        </div>
        {dormant && (
          <div className="novel-dormant-label">
            last opened {dormantDays < 30 ? `${dormantDays} days ago` : dormantDays < 60 ? 'about a month ago' : `${Math.round(dormantDays / 7)} weeks ago`}
          </div>
        )}
        {progressPct !== null && (
          <div className="novel-progress-wrap" title={`${novelCounts.words || 0} / ${novel.novelWordGoal} words goal`}>
            <div className="novel-progress-bar"><span style={{ width: `${progressPct}%` }} /></div>
          </div>
        )}
      </div>
    </div>
  )
}

function RotatingQuote({ novels }) {
  const CUSTOM_KEY = 'moonscribe_custom_quote'
  const [idx, setIdx] = useState(0)
  const [pinned, setPinned] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY)) } catch { return null }
  })

  useEffect(() => {
    if (pinned) return
    const t = setInterval(() => setIdx((i) => (i + 1) % WRITING_QUOTES.length), 10000)
    return () => clearInterval(t)
  }, [pinned])

  const quote = pinned || WRITING_QUOTES[idx]

  const handlePin = () => {
    if (pinned) {
      localStorage.removeItem(CUSTOM_KEY)
      setPinned(null)
    } else {
      const q = WRITING_QUOTES[idx]
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(q))
      setPinned(q)
    }
  }

  if (!novels.length) return <p style={{ color: 'var(--grey)', margin: 0 }}>This is where the first page starts. There's no hurry.</p>

  return (
    <div className="rotating-quote">
      <span className="rotating-quote-text">"{quote.text}" — {quote.author}</span>
      <button className="button button-quiet rotating-quote-pin" title={pinned ? 'Unpin quote' : 'Pin this quote'} onClick={handlePin}>
        <Icon icon={pinned ? 'fa-solid fa-thumbtack' : 'fa-regular fa-bookmark'} style={{ color: pinned ? 'var(--moon)' : undefined }} />
      </button>
    </div>
  )
}

export default function Dashboard() {
  const { novels, refreshNovels, toast, syncNow, openSettings, forgetNovelUnlock, settings } = useApp()
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('share')
    if (!code) return
    let live = true
    ;(async () => {
      try {
        const result = await acceptShareInvite(code)
        if (!live) return
        const sharedNovel = result.novelId ? await getNovel(result.novelId) : null
        if (!sharedNovel) {
          throw new Error('The invitation was accepted, but the novel has not arrived yet. Keep the owner online and try the link again.')
        }
        await refreshNovels()
        toast('Shared novel added to your library.')
        window.history.replaceState({}, '', '/dashboard')
        if (result.novelId) window.location.hash = `#/novel/${result.novelId}`
      } catch (error) { if (live) toast(error.message) }
    })()
    return () => { live = false }
  }, [refreshNovels, toast])
  const navigate = useNavigate()
  const [counts, setCounts] = useState({})
  const [newOpen, setNewOpen] = useState(false)
  const [editNovel, setEditNovel] = useState(null)
  const [deleteNovelTarget, setDeleteNovelTarget] = useState(null)
  const [coverNovel, setCoverNovel] = useState(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [genreFilter, setGenreFilter] = useState(null)
  const [collectionFilter, setCollectionFilter] = useState(null)
  const [sortKey, setSortKey] = useState('recent')
  const [showNudge, setShowNudge] = useState(false)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('moonscribe_view') || 'grid')
  const [crossResults, setCrossResults] = useState(null)
  const [analytics, setAnalytics] = useState({ inProgress: 0, monthlyWords: 0, streak: 0 })
  const [libraryLoading, setLibraryLoading] = useState(true)

  useEffect(() => {
    if (!novels.length) return
    let cancelled = false
    ;(async () => {
      const week = 7 * 24 * 60 * 60 * 1000
      const last = await getMeta('lastBackupAt', 0)
      const snoozed = await getMeta('backupNudgeAt', 0)
      const now = Date.now()
      if (!cancelled && now - last > week && now - snoozed > week) setShowNudge(true)
    })()
    return () => { cancelled = true }
  }, [novels.length])

  useEffect(() => {
    if (!novels.length) return
    let cancelled = false
    ;(async () => {
      const [monthlyWords, streak] = await Promise.all([monthlyWordsAllNovels(), currentStreak()])
      const inProgress = novels.filter((n) => !n.archived && n.collection !== 'finished').length
      if (!cancelled) setAnalytics({ inProgress, monthlyWords, streak })
    })()
    return () => { cancelled = true }
  }, [novels])

  const backupNow = async () => {
    const data = await exportBackup()
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `moonscribe-backup-${new Date().toISOString().slice(0, 10)}.json`)
    await setMeta('lastBackupAt', Date.now())
    setShowNudge(false)
    toast('Backup downloaded — kept safe.')
  }
  const snoozeNudge = async () => {
    await setMeta('backupNudgeAt', Date.now())
    setShowNudge(false)
  }

  useEffect(() => {
    async function load() {
      setLibraryLoading(true)
      const all = await listNovels()
      const map = {}
      await Promise.all(all.map(async (n) => { map[n.id] = await wordsAndChapters(n.id) }))
      setCounts(map)
      setLibraryLoading(false)
    }
    load()
  }, [novels])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) { setCrossResults(null); return }
    let cancelled = false
    ;(async () => {
      const res = await searchAll(q)
      if (!cancelled) setCrossResults(res)
    })()
    return () => { cancelled = true }
  }, [query])

  const setView = (v) => { setViewMode(v); localStorage.setItem('moonscribe_view', v) }

  const openNovel = async (novel) => {
    await updateNovel(novel.id, { lastOpened: Date.now() }, { sync: false })
    navigate(`/novel/${novel.id}`)
  }

  const toggleNovelLock = async (novel) => {
    if (novel.lock) {
      const pass = window.prompt("Enter this novel's passphrase to remove its lock.")
      if (pass === null) return
      if (!(await verifyLock(novel.lock, pass))) { toast("That didn't match — lock unchanged."); return }
      await updateNovel(novel.id, { lock: null })
      forgetNovelUnlock(novel.id)
      await refreshNovels()
      toast('Lock removed from this novel.')
    } else {
      const pass = window.prompt(`Choose a passphrase to lock "${novel.title || 'this novel'}".\nNo recovery — keep it safe.`)
      if (pass === null) return
      if (!pass.trim()) { toast('A passphrase is needed.'); return }
      const again = window.prompt('Enter it again to confirm.')
      if (again === null) return
      if (pass !== again) { toast("The two entries didn't match."); return }
      const lock = await makeLock(pass, 'passphrase')
      await updateNovel(novel.id, { lock })
      await refreshNovels()
      toast('This novel is locked.')
    }
  }

  const handlePin = async (novel, pinned) => {
    await updateNovel(novel.id, { pinned })
    await refreshNovels()
  }

  const handleDuplicate = async (novel) => {
    toast('Duplicating structure…')
    const newNovel = await duplicateNovelStructure(novel.id)
    await refreshNovels()
    if (newNovel) toast(`"${newNovel.title}" created with the same structure, empty content.`)
  }

  const handleCreate = async ({ title, blurb, coverStyle, genres, series, template }) => {
    const novel = await createNovel({ title, blurb, coverStyle, genres, series })
    const tpl = NOVEL_TEMPLATES.find((t) => t.key === template) || NOVEL_TEMPLATES[0]
    for (const c of tpl.chapters) {
      await createChapter(novel.id, { title: c.title, part: c.part || '', kind: c.kind, content: c.content || '' })
    }
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

  const handleArchive = async (novel) => {
    await archiveNovel(novel.id)
    await refreshNovels()
    toast('Stowed away — its words stay with you.')
  }

  const handleUnarchive = async (novel) => {
    await unarchiveNovel(novel.id)
    await refreshNovels()
    toast('Back on the shelf.')
  }

  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Still awake' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const q = query.trim().toLowerCase()
  const archived = novels.filter((n) => n.archived)
  const active = novels.filter((n) => !n.archived && (!n.sharedExpiresAt || n.sharedExpiresAt > Date.now()))
  const filtered = active.filter((n) => {
    if (genreFilter && !(n.genres || []).includes(genreFilter)) return false
    if (collectionFilter && (n.collection || null) !== collectionFilter) return false
    if (!q) return true
    const hay = `${n.title} ${n.blurb || ''} ${(n.genres || []).join(' ')}`.toLowerCase()
    return hay.includes(q)
  })
  const allGenres = [...new Set(novels.flatMap((n) => n.genres || []))].sort()
  const visible = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    if (sortKey === 'words') return (counts[b.id]?.words || 0) - (counts[a.id]?.words || 0)
    if (sortKey === 'chapters') return (counts[b.id]?.chapters || 0) - (counts[a.id]?.chapters || 0)
    const aTime = a.lastOpened || a.updatedAt || a.createdAt || 0
    const bTime = b.lastOpened || b.updatedAt || b.createdAt || 0
    return bTime - aTime
  })
  const seriesGroups = []
  for (const name of [...new Set(visible.map((n) => n.series || ''))]) {
    seriesGroups.push({ name, items: visible.filter((n) => (n.series || '') === name) })
  }

  const resumeNovel = active.sort((a, b) => (b.lastOpened || b.updatedAt || 0) - (a.lastOpened || a.updatedAt || 0))[0]

  const sharedCardProps = {
    counts,
    onOpen: openNovel,
    onRename: setEditNovel,
    onDelete: setDeleteNovelTarget,
    onCover: setCoverNovel,
    onToggleLock: toggleNovelLock,
    onArchive: handleArchive,
    onPin: handlePin,
    onDuplicate: handleDuplicate,
    listView: viewMode === 'list'
  }

  return (
    <div className="app">
      <div className={`dashboard dashboard-layout-${settings.appLayout || 'studio'}`}>
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
            <UserPill onConnectClick={() => setConnectOpen(true)} />
          </div>
        </div>

        {showNudge && (
          <div className="backup-nudge">
            <span className="backup-nudge-icon"><Icon icon="fa-solid fa-shield-heart" /></span>
            <span className="backup-nudge-text">It's been a while since your last backup. A quick local copy keeps your words safe, no cloud required.</span>
            <div className="actions-row">
              <button className="button button-primary" onClick={backupNow}>Back up now</button>
              <button className="button button-quiet" onClick={snoozeNudge}>Not now</button>
            </div>
          </div>
        )}

        <div className="dashboard-hello">
          <h1>{greeting}{novels.length ? ',' : ''}</h1>
          <RotatingQuote novels={novels} />
        </div>

        {novels.length > 0 && (
          <div className="dashboard-analytics-strip">
            ✦ {analytics.inProgress} {analytics.inProgress === 1 ? 'novel' : 'novels'} in progress
            {analytics.monthlyWords > 0 && <> · {analytics.monthlyWords.toLocaleString()} words this month</>}
            {analytics.streak > 1 && <> · {analytics.streak}-day streak</>}
          </div>
        )}

        {resumeNovel && (
          <HeroCard novel={resumeNovel} counts={counts[resumeNovel.id]} onOpen={openNovel} />
        )}

        {novels.length > 0 && (
          <div className="dashboard-tools">
            <div className="dashboard-tools-top">
              <div style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
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
                {crossResults && q.length >= 3 && (
                  <div className="cross-search-results">
                    {crossResults.chapters.length > 0 && (
                      <div className="cross-section">
                        <div className="cross-section-label">Chapters</div>
                        {crossResults.chapters.slice(0, 4).map((r) => (
                          <button key={r.id} className="cross-result" onClick={() => navigate(`/novel/${r.novelId}`, { state: { chapterId: r.id } })}>
                            <Icon icon="fa-solid fa-book-open" />
                            <span className="cross-result-title">{r.title}</span>
                            <span className="cross-result-sub">{r.subtitle}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {crossResults.characters.length > 0 && (
                      <div className="cross-section">
                        <div className="cross-section-label">Characters</div>
                        {crossResults.characters.slice(0, 4).map((r) => (
                          <button key={r.id} className="cross-result" onClick={() => navigate(`/novel/${r.novelId}/characters`)}>
                            <Icon icon="fa-solid fa-user" />
                            <span className="cross-result-title">{r.title}</span>
                            <span className="cross-result-sub">{r.subtitle}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {crossResults.notes.length > 0 && (
                      <div className="cross-section">
                        <div className="cross-section-label">Notes</div>
                        {crossResults.notes.slice(0, 3).map((r) => (
                          <button key={r.id} className="cross-result" onClick={() => navigate(`/novel/${r.novelId}/notes`)}>
                            <Icon icon="fa-solid fa-note-sticky" />
                            <span className="cross-result-title">{r.title}</span>
                            <span className="cross-result-sub">{r.subtitle}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!crossResults.chapters.length && !crossResults.characters.length && !crossResults.notes.length && (
                      <div style={{ padding: '12px 14px', color: 'var(--grey)', fontSize: '0.86rem' }}>No results across all novels.</div>
                    )}
                  </div>
                )}
              </div>
              <button className="button button-primary" onClick={() => setNewOpen(true)}>
                <Icon icon="fa-solid fa-plus" style={{ marginRight: 6 }} /> New novel
              </button>
            </div>
            <div className="dashboard-tools-bottom">
              <div className="genre-chips">
                <button className={`chip ${genreFilter === null ? 'active' : ''}`} onClick={() => setGenreFilter(null)}>All</button>
                {(allGenres.length ? allGenres : GENRES).slice(0, 12).map((g) => (
                  <button key={g} className={`chip ${genreFilter === g ? 'active' : ''}`} onClick={() => setGenreFilter(genreFilter === g ? null : g)}>{g}</button>
                ))}
              </div>
              <div className="dashboard-sort">
                <label htmlFor="novel-sort">Sort by</label>
                <select id="novel-sort" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                  <option value="recent">Recent</option>
                  <option value="words">Word count</option>
                  <option value="chapters">Chapters</option>
                </select>
                <div className="view-toggle">
                  <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')} title="Grid view">
                    <Icon icon="fa-solid fa-grip" />
                  </button>
                  <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setView('list')} title="List view">
                    <Icon icon="fa-solid fa-list" />
                  </button>
                </div>
              </div>
            </div>
            <div className="collection-chips">
              {COLLECTIONS.map((c) => (
                <button
                  key={String(c.key)}
                  className={`chip ${collectionFilter === c.key ? 'active' : ''}`}
                  onClick={() => setCollectionFilter(collectionFilter === c.key ? null : c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {libraryLoading && novels.length > 0 && <DashboardSkeleton />}
        {!libraryLoading && seriesGroups.map((g) => (
          <div className="series-section" key={g.name || '__none'}>
            {g.name && (
              <div className="section-heading series-heading">
                <Icon icon="fa-solid fa-layer-group" style={{ marginRight: 8 }} /> {g.name}
                <span className="hint">{g.items.length} {g.items.length === 1 ? 'novel' : 'novels'}</span>
              </div>
            )}
            {viewMode === 'list' ? (
              <div className="novel-list">
                {g.items.map((n) => (
                  <NovelCard key={n.id} novel={n} {...sharedCardProps} />
                ))}
                {g.items.length === 0 && novels.length > 0 && (
                  <div className="empty">
                    <div className="empty-icon"><Icon icon="fa-solid fa-magnifying-glass" /></div>
                    <h3>Nothing here</h3>
                    <p>{q ? `No novel matches "${query}".` : `No ${genreFilter} novels yet.`} Try another search.</p>
                    <button className="button button-ghost" onClick={() => { setQuery(''); setGenreFilter(null); setCollectionFilter(null) }}>Clear filters</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="novel-grid">
                {g.items.map((n) => (
                  <NovelCard key={n.id} novel={n} {...sharedCardProps} />
                ))}
                {g.items.length === 0 && novels.length > 0 && (
                  <div className="empty" style={{ gridColumn: '1 / -1' }}>
                    <div className="empty-icon"><Icon icon="fa-solid fa-magnifying-glass" /></div>
                    <h3>Nothing here</h3>
                    <p>{q ? `No novel matches "${query}".` : `No ${genreFilter || collectionFilter} novels yet.`} Try another search.</p>
                    <button className="button button-ghost" onClick={() => { setQuery(''); setGenreFilter(null); setCollectionFilter(null) }}>Clear filters</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div className="series-section">
          <div className="novel-grid" style={{ marginTop: 8 }}>
            <button className="novel-card new-novel-card" onClick={() => setNewOpen(true)}>
              <span className="plus"><Icon icon="fa-solid fa-plus" /></span>
              New novel
            </button>
          </div>
        </div>

        {archived.length > 0 && (
          <div className="dashboard-archived">
            <div className="section-heading">
              Archived <span className="hint">stowed away, still on this device</span>
            </div>
            <div className="novel-grid">
              {archived.map((n) => (
                <NovelCard key={n.id} novel={n} {...sharedCardProps} onArchive={handleUnarchive} />
              ))}
            </div>
          </div>
        )}
      </div>

      <NewNovelModal open={newOpen} onClose={() => setNewOpen(false)} onCreate={handleCreate} />
      <RenameModal novel={editNovel} onClose={() => setEditNovel(null)} onSave={handleRename} />
      <ConfirmDialog
        open={!!deleteNovelTarget}
        onClose={() => setDeleteNovelTarget(null)}
        onConfirm={handleDelete}
        title="Set this novel free?"
      >
        "{deleteNovelTarget?.title}" and all its chapters, characters and notes will be removed from this device. This can't be undone.
      </ConfirmDialog>
      <CoverModal novel={coverNovel} onClose={() => setCoverNovel(null)} onDone={refreshNovels} />
      <AuthModal open={connectOpen} onClose={() => setConnectOpen(false)} />
    </div>
  )
}

function DashboardSkeleton() {
  return <div className="dashboard-skeleton" aria-label="Loading your library" aria-live="polite">
    {[0, 1, 2].map((item) => <div className="skeleton-novel" key={item}><span className="skeleton-cover" /><span className="skeleton-line wide" /><span className="skeleton-line" /><span className="skeleton-line short" /></div>)}
  </div>
}

function HeroCard({ novel, counts, onOpen }) {
  const coverUrl = useBlobUrl(novel.cover)
  const coverClass = `cover-${novel.coverStyle || 'moonstone'}`
  return (
    <div className={`hero-card ${coverClass}`} onClick={() => onOpen(novel)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(novel)}>
      <div className="hero-cover">
        {coverUrl
          ? <img src={coverUrl} alt="" />
          : <span className="hero-initials">{initials(novel.title)}</span>
        }
      </div>
      <div className="hero-body">
        <div className="hero-label">Continue writing</div>
        <div className="hero-title">{novel.title}</div>
        {novel.blurb && <div className="hero-blurb">{novel.blurb}</div>}
        <div className="hero-meta">
          {formatWords(counts?.words || 0)} words · {counts?.chapters || 0} chapters
        </div>
        <button className="button button-primary hero-cta">Continue writing →</button>
      </div>
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
  const [series, setSeries] = useState('')
  const [template, setTemplate] = useState('blank')

  useEffect(() => {
    if (open) {
      setTitle(''); setBlurb(''); setCoverStyle('moonstone'); setGenres([]); setSeries(''); setTemplate('blank')
    }
  }, [open])

  const submit = () => {
    onCreate({ title: title.trim(), blurb: blurb.trim(), coverStyle, genres, series: series.trim() || null, template })
  }

  return (
    <Modal open={open} onClose={onClose} title="Begin a novel" width={520}>
      <div className="field">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A title, or none yet…" autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </div>
      <div className="field">
        <label>One-line idea <span className="hint">(optional)</span></label>
        <input value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="Two strangers, one small town…" />
      </div>
      <div className="field">
        <label>Starting shape</label>
        <div className="template-grid">
          {NOVEL_TEMPLATES.map((t) => (
            <button key={t.key} type="button" className={`template-card ${template === t.key ? 'selected' : ''}`} onClick={() => setTemplate(t.key)} title={t.blurb}>
              <strong>{t.label}</strong>
              <span>{t.blurb}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Series <span className="hint">(optional)</span></label>
        <input value={series} onChange={(e) => setSeries(e.target.value)} placeholder="e.g. The Tide Trilogy" />
      </div>
      <div className="field">
        <label>Genre <span className="hint">(optional)</span></label>
        <GenrePicker value={genres} onChange={setGenres} />
      </div>
      <div className="field">
        <label>Cover colour</label>
        <div className="swatch-row">
          {COVER_STYLES.map((c) => (
            <button key={c.key} className={`swatch cover-${c.key} ${coverStyle === c.key ? 'selected' : ''}`} onClick={() => setCoverStyle(c.key)} title={c.label} aria-label={c.label} style={{ width: 40, height: 40, borderRadius: 12 }} />
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
  const [series, setSeries] = useState('')
  const [collection, setCollection] = useState(null)
  const [novelWordGoal, setNovelWordGoal] = useState('')

  useEffect(() => {
    if (novel) {
      setTitle(novel.title || '')
      setBlurb(novel.blurb || '')
      setGenres(novel.genres || [])
      setSeries(novel.series || '')
      setCollection(novel.collection || null)
      setNovelWordGoal(novel.novelWordGoal != null ? String(novel.novelWordGoal) : '')
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
      <div className="field">
        <label>Series <span className="hint">(optional)</span></label>
        <input value={series} onChange={(e) => setSeries(e.target.value)} placeholder="e.g. The Tide Trilogy" />
      </div>
      <div className="field">
        <label>Collection</label>
        <div className="genre-chips">
          {COLLECTIONS.filter((c) => c.key !== null).map((c) => (
            <button
              key={c.key}
              type="button"
              className={`chip ${collection === c.key ? 'active' : ''}`}
              onClick={() => setCollection(collection === c.key ? null : c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Word count goal <span className="hint">(optional — shows a progress bar on the card)</span></label>
        <input
          type="number"
          min="0"
          step="1000"
          value={novelWordGoal}
          onChange={(e) => setNovelWordGoal(e.target.value)}
          placeholder="e.g. 80000"
        />
      </div>
      <div className="modal-foot">
        <button className="button button-ghost" onClick={onClose}>Cancel</button>
        <button
          className="button button-primary"
          onClick={() => onSave({
            title: title.trim() || 'Untitled',
            blurb: blurb.trim(),
            genres,
            series: series.trim() || null,
            collection: collection || null,
            novelWordGoal: novelWordGoal ? Math.max(0, parseInt(novelWordGoal, 10) || 0) : null
          })}
        >
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
