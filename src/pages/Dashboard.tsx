import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createNovel, updateNovel, deleteNovel, listNovels, getNovel, archiveNovel, unarchiveNovel, duplicateNovelStructure } from '../db/novels'
import { makeLock, verifyLock } from '../db/lock'
import { exportBackup } from '../db/backup'
import { getMeta, setMeta } from '../db/meta'
import { downloadBlob } from '../utils/download'
import { createChapter, listChapters, wordsAndChapters } from '../db/chapters'
import { dailyHistory, monthlyWordsAllNovels, currentStreak, todayWords } from '../db/stats'
import { createNote } from '../db/notes'
import { listAnnotations } from '../db/annotations'
import { continuityReport } from '../db/continuity'
import { NOVEL_TEMPLATES } from '../templates'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import AuthModal from '../components/AuthModal'
import SyncStatus from '../components/SyncStatus'
import NotificationBell from '../components/NotificationBell'
import UserPill from '../components/UserPill'
import { useContextMenu } from '../components/ContextMenu'
import Icon from '../components/Icon'
import { Button } from '../components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '../components/ui/sheet'
import { timeAgo } from '../utils/dates'
import { formatWords } from '../utils/words'
import { searchAll } from '../db/search'
import { acceptShareInvite } from '../sync/engine'
import DashboardHome, { MobileDashboardHeader } from '../dashboard/DashboardHome'
import ProfileAvatar from '../components/ProfileAvatar'
import GlobalMedia from '../dashboard/GlobalMedia'
import AdSlot from '../components/AdSlot'
import BookShelf from '../components/books/BookShelf'
import { readRecentWriting } from '../utils/recentWriting'
import '../styles/dashboard-mobile-fixes.css'

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

const DEFAULT_DASHBOARD_WIDGETS = ['today', 'pulse', 'recent', 'progress']
const MAX_NOVELS_PER_USER = 15
const DASHBOARD_WIDGETS = ['today', 'recent', 'pulse', 'progress', 'editing', 'health', 'quickCapture']

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

function textFromHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function lastLine(html) {
  const lines = textFromHtml(html).split(/(?<=[.!?])\s+/).filter(Boolean)
  return lines.at(-1) || ''
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
  const { novels, refreshNovels, toast, syncUsername, syncStatus, syncDiscordAvatar, syncProvider, syncNow, disconnectSync, forgetNovelUnlock, settings, setFocusMode, openSettings, hasRole } = useApp()
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
  const [dashboardData, setDashboardData] = useState({ today: 0, pulse: [], recent: [], resumeChapter: null, editingQueue: [], health: null })
  const [dashboardWidgets, setDashboardWidgets] = useState(DEFAULT_DASHBOARD_WIDGETS)
  const [customizingDashboard, setCustomizingDashboard] = useState(false)
  const [draggingWidget, setDraggingWidget] = useState(null)
  const [quickCapture, setQuickCapture] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('moonscribe_dashboard_sidebar') === 'collapsed'
    } catch {
      return false
    }
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const libraryRef = useRef<HTMLDivElement | null>(null)
  const [dashboardView, setDashboardView] = useState<'home' | 'library' | 'media' | 'journal' | 'insights'>(() => {
    const view = new URLSearchParams(window.location.search).get('view')
    return view === 'library' || view === 'media' || view === 'journal' || view === 'insights' ? view : 'home'
  })
  const currentStory = novels.find((novel) => novel.title === dashboardData.recent[0]?.novelTitle)
  const currentStoryCover = useBlobUrl(currentStory?.cover)
  const dashboardWidgetsKey = `dashboardWidgets:${syncUsername || 'local'}`

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const saved = await getMeta(dashboardWidgetsKey, DEFAULT_DASHBOARD_WIDGETS)
      if (!cancelled && Array.isArray(saved) && saved.length) {
        setDashboardWidgets(saved.filter((widget) => DASHBOARD_WIDGETS.includes(widget)))
      }
    })()
    return () => { cancelled = true }
  }, [dashboardWidgetsKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
      const activeNovels = novels.filter((novel) => !novel.archived)
      const chaptersByNovel = await Promise.all(activeNovels.map(async (novel) => ({
        novel,
        chapters: await listChapters(novel.id)
      })))
      const allChapters = chaptersByNovel.flatMap(({ novel, chapters }) =>
        chapters.map((chapter) => ({ ...chapter, novelTitle: novel.title }))
      )
      const recent = [...allChapters]
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 5)
      const recentNovel = [...activeNovels]
        .sort((a, b) => (b.lastOpened || b.updatedAt || 0) - (a.lastOpened || a.updatedAt || 0))[0]
      const recentContext = readRecentWriting()
      const resumeChapter = recentContext?.novelId && allChapters.some((chapter) => chapter.novelId === recentContext.novelId && chapter.id === recentContext.chapterId)
        ? allChapters.find((chapter) => chapter.novelId === recentContext.novelId && chapter.id === recentContext.chapterId)
        : recentNovel
        ? allChapters.filter((chapter) => chapter.novelId === recentNovel.id)
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null
        : null
      const [today, histories] = await Promise.all([
        Promise.all(activeNovels.map((novel) => todayWords(novel.id))).then((values) => values.reduce((total, value) => total + value, 0)),
        Promise.all(activeNovels.map((novel) => dailyHistory(novel.id, 7)))
      ])
      const pulse = Array.from({ length: 7 }, (_, index) => ({
        date: histories[0]?.[index]?.date || '',
        words: histories.reduce((total, history) => total + (history[index]?.words || 0), 0)
      }))
      const reviewData = await Promise.all(chaptersByNovel.map(async ({ novel, chapters }) => {
        const [annotations, continuity] = await Promise.all([listAnnotations(novel.id), continuityReport(novel.id)])
        const unresolvedByChapter = annotations.reduce((counts, annotation) => {
          if (!annotation.resolved && annotation.chapterId) counts[annotation.chapterId] = (counts[annotation.chapterId] || 0) + 1
          return counts
        }, {} as Record<string, number>)
        return {
          novel,
          chapters,
          unresolvedByChapter,
          continuityIssues: continuity.issues.filter((issue) => issue.severity > 0)
        }
      }))
      const editingQueue = reviewData.flatMap(({ novel, chapters, unresolvedByChapter, continuityIssues }) =>
        chapters
          .filter((chapter) => chapter.status === 'revised' || unresolvedByChapter[chapter.id] || continuityIssues.some((issue) => issue.chapterId === chapter.id))
          .map((chapter) => ({
            ...chapter,
            novelTitle: novel.title,
            unresolvedComments: unresolvedByChapter[chapter.id] || 0,
            continuityIssues: continuityIssues.filter((issue) => issue.chapterId === chapter.id).length
          }))
      ).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5)
      const health = {
        chapters: allChapters.length,
        drafted: allChapters.filter((chapter) => chapter.status === 'draft').length,
        editing: allChapters.filter((chapter) => chapter.status === 'revised').length,
        complete: allChapters.filter((chapter) => chapter.status === 'final').length,
        unresolvedComments: reviewData.reduce((total, item) => total + (Object.values(item.unresolvedByChapter) as number[]).reduce((sum, value) => sum + value, 0), 0),
        continuityIssues: reviewData.reduce((total, item) => total + item.continuityIssues.length, 0)
      }
      if (!cancelled) setDashboardData({ today, pulse, recent, resumeChapter, editingQueue, health })
      } catch (error) {
        if (import.meta.env.DEV) console.error('Legacy dashboard sidebar data could not load', error)
        if (!cancelled) setDashboardData({ today: 0, pulse: [], recent: [], resumeChapter: null, editingQueue: [], health: null })
      }
    })()
    return () => { cancelled = true }
  }, [novels])

  const saveDashboardWidgets = async (next) => {
    setDashboardWidgets(next)
    await setMeta(dashboardWidgetsKey, next)
  }

  const setSidebarMode = (collapsed) => {
    setSidebarCollapsed(collapsed)
    try {
      localStorage.setItem('moonscribe_dashboard_sidebar', collapsed ? 'collapsed' : 'expanded')
    } catch {
      // Storage can be unavailable in private or locked-down browser contexts.
    }
  }

  const toggleDashboardWidget = (widget) => {
    const next = dashboardWidgets.includes(widget)
      ? dashboardWidgets.filter((item) => item !== widget)
      : [...dashboardWidgets, widget]
    saveDashboardWidgets(next.length ? next : dashboardWidgets)
  }

  const moveDashboardWidget = (target) => {
    if (!draggingWidget || draggingWidget === target) return
    const next = [...dashboardWidgets]
    const from = next.indexOf(draggingWidget)
    const to = next.indexOf(target)
    next.splice(from, 1)
    next.splice(to, 0, draggingWidget)
    setDraggingWidget(null)
    saveDashboardWidgets(next)
  }

  const saveQuickCapture = async () => {
    const content = quickCapture.trim()
    const target = resumeNovel
    if (!content || !target) return
    const title = content.split(/\r?\n/, 1)[0].slice(0, 72)
    await createNote(target.id, { title: title || 'Quick capture', content })
    setQuickCapture('')
    toast(`Saved to ${target.title}.`)
  }

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
    if (novels.filter((novel) => !novel.archived).length >= MAX_NOVELS_PER_USER) {
      toast(`MoonScribe supports up to ${MAX_NOVELS_PER_USER} active novels per user. Archive one before creating another.`)
      return
    }
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
  const attentionCount = (dashboardData.health?.unresolvedComments || 0) + (dashboardData.health?.continuityIssues || 0)
  const resumeChapter = dashboardData.resumeChapter
  const openResume = () => {
    if (!resumeNovel) return
    navigate(`/novel/${resumeNovel.id}`, { state: resumeChapter ? { chapterId: resumeChapter.id } : undefined })
  }
  const startFocusSession = () => {
    setFocusMode(true)
    openResume()
  }
  const hasCurrentStory = !!(resumeChapter || (dashboardData.recent && dashboardData.recent.length > 0))
  const openSearch = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
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
    <div className="app dashboard-app">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarMode(!sidebarCollapsed)}
        view={dashboardView}
        onHome={() => setDashboardView('home')}
        onContinue={openResume}
        onLibrary={() => setDashboardView('library')}
        onMedia={() => setDashboardView('media')}
        onJournal={() => setDashboardView('journal')}
        onInsights={() => setDashboardView('insights')}
        onWebsite={() => navigate('/author-website')}
        onSearch={openSearch}
        onNew={() => setNewOpen(true)}
        onOpenChapter={(chapter) => navigate(`/novel/${chapter.novelId}`, { state: { chapterId: chapter.id } })}
        onSettings={openSettings}
        onSignOut={async () => { await disconnectSync(); toast('Signed out.') }}
        onAdmin={hasRole('admin') ? () => navigate('/admin') : undefined}
        syncUsername={syncUsername}
        syncStatus={syncStatus}
        syncAvatar={syncDiscordAvatar}
        syncProvider={syncProvider}
        onSync={syncNow}
        resumeChapter={resumeChapter}
        recent={dashboardData.recent}
        showCurrentStory={hasCurrentStory}
        currentStoryCover={currentStoryCover}
      />
      <main className={`dashboard-main ${sidebarCollapsed ? 'dashboard-sidebar-collapsed' : ''}`}>
      <div className={`dashboard dashboard-layout-${settings.appLayout || 'studio'}`}>
        <div className="topbar">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild><Button className="dashboard-mobile-menu" variant="outline" size="icon" aria-label="Open dashboard navigation"><Icon icon="fa-solid fa-bars" /></Button></SheetTrigger>
            <SheetContent side="left" className="dashboard-mobile-sheet animate-in slide-in-from-left duration-300 ease-out">
              <SheetTitle>MoonScribe studio</SheetTitle>
              <nav className="dashboard-mobile-nav" aria-label="Dashboard navigation">
                {[
                  ['home', 'Home', 'fa-solid fa-house'], ['library', 'Library', 'fa-solid fa-book-open'], ['media', 'Media', 'fa-solid fa-images'], ['journal', 'Journal', 'fa-solid fa-book'], ['insights', 'Insights', 'fa-solid fa-chart-line']
                ].map(([key, label, icon]) => <Button key={key} variant={dashboardView === key ? 'secondary' : 'ghost'} className="justify-start" onClick={() => { setDashboardView(key as typeof dashboardView); setMobileNavOpen(false) }}><Icon icon={icon} />{label}</Button>)}
                <Button variant="ghost" className="justify-start" onClick={() => { navigate('/author-website'); setMobileNavOpen(false) }}><Icon icon="fa-solid fa-globe" />Author website</Button><Button variant="ghost" className="justify-start" onClick={() => { setNewOpen(true); setMobileNavOpen(false) }}><Icon icon="fa-solid fa-plus" />New story</Button>
                <Button variant="ghost" className="justify-start" onClick={() => { openSettings(); setMobileNavOpen(false) }}><Icon icon="fa-solid fa-gear" />Settings</Button>
              </nav>
            </SheetContent>
          </Sheet>
          <Button variant="outline" className="dashboard-command-launcher" onClick={openSearch}><Icon icon="fa-solid fa-magnifying-glass" /> Search MoonScribe <kbd>Ctrl K</kbd></Button>
          <div className="actions-row">
            <button
              className={`button button-quiet dashboard-customize ${customizingDashboard ? 'active' : ''}`}
              onClick={() => setCustomizingDashboard((editing) => !editing)}
              aria-pressed={customizingDashboard}
            >
              <Icon icon="fa-solid fa-sliders" /> {customizingDashboard ? 'Done' : 'Customize'}
            </button>
            <SyncStatus onClick={() => void syncNow()} />
            <NotificationBell />
            <UserPill onConnectClick={() => setConnectOpen(true)} />
          </div>
        </div>

        <div className="dashboard-workspace">
        {dashboardView === 'home' && <DashboardHome
          novels={novels}
          username={syncUsername}
          syncStatus={syncStatus}
          syncAvatar={syncDiscordAvatar}
          onCreate={() => setNewOpen(true)}
          onLibrary={() => setDashboardView('library')}
          onSearch={openSearch}
          onMenu={() => setMobileNavOpen(true)}
          onAccount={openSettings}
        />}

        {dashboardView === 'library' && <section className="dashboard-library" ref={libraryRef}>
          <MobileDashboardHeader username={syncUsername} syncStatus={syncStatus} syncAvatar={syncDiscordAvatar} onMenu={() => setMobileNavOpen(true)} onAccount={openSettings} />
        {novels.length === 0 ? (
          <section className="dashboard-empty-view">
            <span className="dashboard-section-label">Library</span>
            <h1>Stories will appear here.</h1>
            <p>Your novel library is empty right now. Create the first one and MoonScribe will keep it close at hand.</p>
            <button className="button button-primary" onClick={() => setNewOpen(true)}>Create a story</button>
          </section>
        ) : (
          <>
            <div className="dashboard-tools">
              <div className="dashboard-library-heading">
                <div><h2>Your Library</h2><p>Find a story, continue one, or begin something new.</p></div>
              </div>
              <div className="dashboard-tools-top">
                <div style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
                  <div className="search-wrap">
                    <Icon icon="fa-solid fa-magnifying-glass" />
                    <input
                      className="search-input"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search stories…"
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
                <div className="dashboard-sort">
                  <label htmlFor="novel-genre">Genre</label>
                  <select id="novel-genre" value={genreFilter || ''} onChange={(e) => setGenreFilter(e.target.value || null)}>
                    <option value="">All genres</option>
                    {((Array.isArray(allGenres) && allGenres.length ? allGenres : GENRES) as string[]).map((genre) => <option key={genre} value={genre}>{genre}</option>)}
                  </select>
                  <label htmlFor="novel-status">Status</label>
                  <select id="novel-status" value={collectionFilter || ''} onChange={(e) => setCollectionFilter(e.target.value || null)}>
                    <option value="">All statuses</option>
                    {COLLECTIONS.filter((collection) => collection.key).map((collection) => <option key={collection.key} value={collection.key || ''}>{collection.label}</option>)}
                  </select>
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
            </div>
          </>
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
              <div className="novel-bookshelf-wrap">
                <BookShelf books={g.items.map((n) => ({ ...n, novelId: n.id, author: syncUsername, cover: n.layout?.cover?.frontImage || n.cover, coverDesign: n.layout?.cover }))} counts={counts} />
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
        </section>
        }
        {dashboardView === 'media' && <GlobalMedia novels={novels} onOpenNovel={(novelId) => navigate(`/novel/${novelId}/media`)} />}
        {dashboardView === 'journal' && <><MobileDashboardHeader username={syncUsername} syncStatus={syncStatus} syncAvatar={syncDiscordAvatar} onMenu={() => setMobileNavOpen(true)} onAccount={openSettings} /><DashboardJournal novel={resumeNovel} analytics={analytics} onOpen={() => resumeNovel && navigate(`/novel/${resumeNovel.id}/writing-journal`)} /></>}
        {dashboardView === 'insights' && <DashboardInsights analytics={analytics} data={dashboardData} onOpen={() => resumeNovel && navigate(`/novel/${resumeNovel.id}/analytics`)} />}
        </div>
        <AdSlot placement="dashboard-secondary" />
      </div>
      </main>

      <MobileDashboardNav
        view={dashboardView}
        onNavigate={setDashboardView}
        onNew={() => setNewOpen(true)}
        onSettings={openSettings}
      />

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

type MobileDashboardView = 'home' | 'library' | 'media' | 'journal' | 'insights'
function MobileDashboardNav({ view, onNavigate, onNew, onSettings }: { view: MobileDashboardView; onNavigate: (view: MobileDashboardView) => void; onNew: () => void; onSettings: () => void }) {
  const items = [
    ['home', 'Home', 'fa-solid fa-house'],
    ['library', 'Library', 'fa-solid fa-book-open'],
    ['journal', 'Journal', 'fa-solid fa-feather-pointed'],
    ['insights', 'Insights', 'fa-solid fa-chart-line'],
  ] as const
  return <nav className="mobile-dashboard-nav flex items-end justify-around gap-1 border-t border-white/10 bg-[#0b0b0f]/95 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-xl" aria-label="Mobile dashboard navigation">
    {items.slice(0, 2).map(([key, label, icon]) => <button key={key} aria-current={view === key ? 'page' : undefined} className={`grid min-h-11 min-w-11 place-items-center gap-1 rounded-lg px-2 py-1 text-[.62rem] transition-colors focus-visible:outline-2 focus-visible:outline-[#c79b53] ${view === key ? 'active text-[#c79b53]' : 'text-[#858188] hover:text-[#c79b53]'}`} onClick={() => onNavigate(key)}><Icon icon={icon} /><span>{label}</span></button>)}
    <button className="mobile-dashboard-create grid h-12 w-12 min-w-12 place-items-center rounded-full border-2 border-[#c79b53] bg-[#141218] text-[#c79b53] shadow-[0_5px_20px_rgba(0,0,0,.45)] focus-visible:outline-2 focus-visible:outline-[#f1d28a]" onClick={onNew} aria-label="Create new"><Icon icon="fa-solid fa-plus" /></button>
    {items.slice(2, 3).map(([key, label, icon]) => <button key={key} aria-current={view === key ? 'page' : undefined} className={`grid min-h-11 min-w-11 place-items-center gap-1 rounded-lg px-2 py-1 text-[.62rem] transition-colors focus-visible:outline-2 focus-visible:outline-[#c79b53] ${view === key ? 'active text-[#c79b53]' : 'text-[#858188] hover:text-[#c79b53]'}`} onClick={() => onNavigate(key)}><Icon icon={icon} /><span>{label}</span></button>)}
    <button className="grid min-h-11 min-w-11 place-items-center gap-1 rounded-lg px-2 py-1 text-[.62rem] text-[#858188] transition-colors hover:text-[#c79b53] focus-visible:outline-2 focus-visible:outline-[#c79b53]" onClick={onSettings}><Icon icon="fa-solid fa-ellipsis" /><span>More</span></button>
  </nav>
}

function DashboardSkeleton() {
  return <div className="dashboard-skeleton" aria-label="Loading your library" aria-live="polite">
    {[0, 1, 2].map((item) => <div className="skeleton-novel" key={item}><span className="skeleton-cover" /><span className="skeleton-line wide" /><span className="skeleton-line" /><span className="skeleton-line short" /></div>)}
  </div>
}

function HeroCard({ novel, chapter, counts, todayWords, streak, onOpen, onOpenChapter, onStartFocus }) {
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
        {chapter && <div className="hero-chapter">{chapter.title || 'Untitled chapter'} · last edited {timeAgo(chapter.updatedAt)}</div>}
        {chapter?.meta?.location && <div className="hero-context">Scene: {chapter.meta.location}{chapter.meta.tone ? ` · Tone: ${chapter.meta.tone}` : ''}</div>}
        {lastLine(chapter?.content) && <div className="hero-last-line">“{lastLine(chapter.content)}”</div>}
        <div className="hero-meta">
          {formatWords(todayWords)} / {formatWords(novel.goalWords || 500)} today · {counts?.chapters || 0} chapters · {streak || 0}-day streak
        </div>
        <div className="hero-actions">
          <Button className="button button-primary hero-cta" onClick={(event) => { event.stopPropagation(); onOpen() }}>Continue writing</Button>
          <button className="button button-quiet hero-secondary-action" onClick={(event) => { event.stopPropagation(); onOpenChapter() }}>Open chapter</button>
          <button className="button button-quiet hero-secondary-action" onClick={(event) => { event.stopPropagation(); onStartFocus() }}>Start focus</button>
        </div>
      </div>
    </div>
  )
}

function DashboardSidebar({ collapsed, onToggle, view, onHome, onContinue, onLibrary, onMedia, onJournal, onInsights, onWebsite, onSearch, onNew, onOpenChapter, onSettings, onSignOut, onAdmin, syncUsername, syncStatus, syncAvatar, syncProvider, onSync, resumeChapter, recent, currentStoryCover, showCurrentStory = true }) {
  const { openContextMenu } = useContextMenu()
  const openProfileMenu = (event) => {
    event.preventDefault()
    openContextMenu(event, [
      { label: syncUsername || 'Local writer', icon: 'fa-solid fa-user', disabled: true },
      'divider',
      { label: 'Settings', icon: 'fa-solid fa-gear', onClick: onSettings },
      { label: 'Sync now', icon: 'fa-solid fa-rotate', onClick: onSync },
      { label: 'Copy username', icon: 'fa-regular fa-copy', disabled: !syncUsername, onClick: () => syncUsername && navigator.clipboard?.writeText(syncUsername) },
      'divider',
      { label: syncUsername ? 'Sign out' : 'Exit offline mode', icon: 'fa-solid fa-right-from-bracket', onClick: onSignOut },
    ])
  }
  const item = (key, label, icon, onClick) => (
    <button className={`dashboard-sidebar-item ${view === key ? 'active' : ''}`} onClick={onClick} title={collapsed ? label : undefined}>
      <Icon icon={icon} /><span className="dashboard-sidebar-label">{label}</span>
    </button>
  )
  return (
    <aside className={`dashboard-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="dashboard-sidebar-brand">
        <img src="/moonscribelogo.png" alt="" />
        <span>MoonScribe<small>Stories, quietly written.</small></span>
        <button onClick={onToggle} aria-label={collapsed ? 'Expand dashboard sidebar' : 'Collapse dashboard sidebar'}><Icon icon={collapsed ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left'} /></button>
      </div>
      <nav className="dashboard-sidebar-nav" aria-label="Dashboard navigation">
        {item('home', 'Home', 'fa-solid fa-house', onHome)}
        {item('library', 'Library', 'fa-solid fa-book', onLibrary)}
        {item('media', 'Media Library', 'fa-regular fa-images', onMedia)}
        {item('journal', 'Writing journal', 'fa-solid fa-feather-pointed', onJournal)}
        {item('insights', 'Insights', 'fa-solid fa-chart-line', onInsights)}
        {item('website', 'Author website', 'fa-solid fa-globe', onWebsite)}
        <button className="dashboard-sidebar-item" onClick={onSearch} title={collapsed ? 'Search MoonScribe' : undefined}><Icon icon="fa-solid fa-magnifying-glass" /><span className="dashboard-sidebar-label">Search</span></button>
      </nav>
      {showCurrentStory && (
        <div className="dashboard-current-story">
          <span>Current story</span>
          <button onClick={onContinue} title={collapsed ? 'Continue writing' : undefined}>
            {currentStoryCover ? <img className="dashboard-current-story-cover" src={currentStoryCover} alt="" /> : <Icon icon="fa-solid fa-sparkles" />}
            <span className="dashboard-sidebar-label">{recent[0]?.novelTitle || 'Choose a story'}<small>{resumeChapter?.title || 'Start where you left off'}</small></span>
          </button>
        </div>
      )}
      <div className="dashboard-sidebar-bottom">
        <button className="dashboard-sidebar-item" onClick={onNew} title={collapsed ? 'New story' : undefined}><Icon icon="fa-solid fa-plus" /><span className="dashboard-sidebar-label">New story</span></button>
        <button className="dashboard-sidebar-item" onClick={onSettings} title={collapsed ? 'Settings' : undefined}><Icon icon="fa-solid fa-gear" /><span className="dashboard-sidebar-label">Settings</span></button>
        {onAdmin && <button className="dashboard-sidebar-item dashboard-admin-tab" onClick={onAdmin} title={collapsed ? 'Admin' : undefined}><Icon icon="fa-solid fa-shield-halved" /><span className="dashboard-sidebar-label">Admin</span></button>}
        <div className={`dashboard-account-card status-${syncStatus || 'offline'}`} title={collapsed ? `${syncUsername || 'Local writer'} · ${syncStatus || 'offline'}` : undefined} onContextMenu={openProfileMenu}>
          <button className="dashboard-account-identity" type="button" onClick={openProfileMenu} aria-label="Open account menu">
            <span className="dashboard-account-avatar">
              <ProfileAvatar src={syncAvatar} name={syncUsername || 'MoonScribe writer'} />
              <i className={`dashboard-account-presence ${syncStatus === 'synced' ? 'online' : syncStatus === 'error' ? 'error' : ''}`} />
            </span>
            <span className="dashboard-sidebar-label dashboard-account-copy">
              <strong>{syncUsername || 'Local writer'}</strong>
              <small>{syncStatus === 'synced' ? 'Synced' : syncStatus === 'local' ? 'Saved locally · cloud sync queued' : syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'connecting' ? 'Connecting…' : syncStatus === 'error' ? 'Sync needs attention' : 'Offline · changes saved locally'}</small>
            </span>
          </button>
          <div className="dashboard-account-actions dashboard-sidebar-label">
            <button type="button" onClick={onSync} aria-label="Sync now" title="Sync now"><Icon icon="fa-solid fa-rotate" /></button>
            {syncProvider === 'discord' && <span title="Connected with Discord" aria-label="Connected with Discord"><Icon icon="fa-brands fa-discord" /></span>}
            <button type="button" onClick={onSettings} aria-label="Open settings" title="Settings"><Icon icon="fa-solid fa-gear" /></button>
          </div>
        </div>
        {!collapsed && <div className="moonscribe-legal-footer">
          <span>Developed with Love by Hayden Ford</span>
          <a href="https://abr.business.gov.au/ABN/View?abn=47600241842" target="_blank" rel="noreferrer">ABN 47 600 241 842</a>
        </div>}
      </div>
    </aside>
  )
}

function RecentTouched({ chapters, onOpenChapter }) {
  if (!chapters.length) return null
  return <section className="dashboard-recent-touched">
    <div className="dashboard-section-label">Recently touched</div>
    <div>{chapters.slice(0, 3).map((chapter) => <button key={chapter.id} onClick={() => onOpenChapter(chapter)}>{chapter.title || 'Untitled chapter'}<small>{timeAgo(chapter.updatedAt)}</small></button>)}</div>
  </section>
}

function DashboardJournal({ novel, analytics, onOpen }) {
  return <section className="dashboard-empty-view dashboard-journal-home">
    <div className="dashboard-journal-hero">
      <span className="dashboard-section-label">Writing journal</span>
      <div className="dashboard-journal-title-row">
        <div>
          <h1>Your writing, remembered.</h1>
          <p>{analytics.streak ? `${analytics.streak} days in your current rhythm.` : 'Start a writing session and MoonScribe will keep the rhythm here.'}</p>
        </div>
        <span className="dashboard-journal-mark" aria-hidden="true"><Icon icon="fa-solid fa-feather-pointed" /></span>
      </div>
    </div>
    <div className="dashboard-journal-stats" aria-label="Writing rhythm">
      <div><strong>{analytics.streak || 0}</strong><span>day rhythm</span></div>
      <div><strong>{analytics.monthlyWords || 0}</strong><span>words this month</span></div>
    </div>
    <div className="dashboard-journal-prompt">
      <Icon icon="fa-solid fa-sparkles" />
      <div><strong>A quiet place for the pages between pages.</strong><span>Keep a thought, a turning point, or a note for your future self.</span></div>
    </div>
    {novel && <button className="button button-primary dashboard-journal-cta" onClick={onOpen}><span>Open {novel.title}'s journal</span><Icon icon="fa-solid fa-arrow-right" /></button>}
  </section>
}

function DashboardInsights({ analytics, data, onOpen }) {
  return <section className="dashboard-empty-view">
    <span className="dashboard-section-label">Insights</span>
    <h1>Progress without the noise.</h1>
    <p>{formatWords(analytics.monthlyWords)} words this month · {data.health?.chapters || 0} chapters in your library.</p>
    <button className="button button-primary" onClick={onOpen}>Open story analytics</button>
  </section>
}

function DashboardWidgets({ widgets, customizing, draggingWidget, onDragStart, onDragEnd, onDrop, onToggle, data, analytics, counts, onOpenChapter, quickCapture, onQuickCaptureChange, onSaveQuickCapture }) {
  const maxPulse = Math.max(...data.pulse.map((day) => day.words), 1)
  const widgetContent = {
    today: (
      <>
        <div className="dashboard-widget-heading"><Icon icon="fa-solid fa-feather-pointed" /> Today</div>
        <strong className="dashboard-widget-number">{formatWords(data.today)}</strong>
        <span>words written</span>
        <div className="dashboard-widget-summary">{analytics.streak ? `${analytics.streak}-day writing streak` : 'A fresh page is waiting.'}</div>
      </>
    ),
    pulse: (
      <>
        <div className="dashboard-widget-heading"><Icon icon="fa-solid fa-wave-square" /> Writing pulse</div>
        <div className="writing-pulse" aria-label="Words written over the last seven days">
          {data.pulse.map((day) => <span key={day.date} className="writing-pulse-bar" style={{ height: `${Math.max(8, (day.words / maxPulse) * 100)}%` }} title={`${day.words} words`} />)}
        </div>
        <span>Last 7 days · {formatWords(data.pulse.reduce((total, day) => total + day.words, 0))} words</span>
      </>
    ),
    recent: (
      <>
        <div className="dashboard-widget-heading"><Icon icon="fa-regular fa-clock" /> Recent chapters</div>
        <div className="dashboard-recent-list">
          {data.recent.length ? data.recent.slice(0, 4).map((chapter) => (
            <button key={chapter.id} onClick={() => onOpenChapter(chapter)}>
              <span>{chapter.title || 'Untitled chapter'}</span>
              <small>{chapter.novelTitle} · {timeAgo(chapter.updatedAt)}</small>
            </button>
          )) : <span className="muted">Your recently edited chapters will appear here.</span>}
        </div>
      </>
    ),
    editing: (
      <>
        <div className="dashboard-widget-heading"><Icon icon="fa-solid fa-pen-ruler" /> Editing queue</div>
        <div className="dashboard-recent-list">
          {data.editingQueue.length ? data.editingQueue.slice(0, 4).map((chapter) => (
            <button key={chapter.id} onClick={() => onOpenChapter(chapter)}>
              <span>{chapter.title || 'Untitled chapter'}</span>
              <small>{chapter.unresolvedComments ? `${chapter.unresolvedComments} unresolved comment${chapter.unresolvedComments === 1 ? '' : 's'}` : chapter.continuityIssues ? `${chapter.continuityIssues} continuity item${chapter.continuityIssues === 1 ? '' : 's'}` : 'Ready for revision'}</small>
            </button>
          )) : <span className="muted">Revision-ready chapters and open comments will appear here.</span>}
        </div>
      </>
    ),
    health: (
      <>
        <div className="dashboard-widget-heading"><Icon icon="fa-solid fa-heart-pulse" /> Novel health</div>
        <strong className="dashboard-widget-number">{data.health?.chapters || 0}</strong>
        <span>chapters · {data.health?.drafted || 0} drafted · {data.health?.editing || 0} editing · {data.health?.complete || 0} complete</span>
        <div className="dashboard-widget-summary">{data.health?.unresolvedComments || 0} unresolved comments · {data.health?.continuityIssues || 0} continuity items</div>
      </>
    ),
    quickCapture: (
      <>
        <div className="dashboard-widget-heading"><Icon icon="fa-solid fa-bolt" /> Quick capture</div>
        <textarea className="dashboard-quick-capture" value={quickCapture} onChange={(event) => onQuickCaptureChange(event.target.value)} placeholder="A line, scene idea, or detail before it disappears…" aria-label="Quick capture note" />
        <button className="button button-ghost dashboard-quick-capture-save" onClick={onSaveQuickCapture} disabled={!quickCapture.trim()}>Save to current story</button>
      </>
    ),
    progress: (
      <>
        <div className="dashboard-widget-heading"><Icon icon="fa-solid fa-book-open" /> Story progress</div>
        <strong className="dashboard-widget-number">{formatWords((Object.values(counts) as { words?: number; chapters?: number }[]).reduce((total, count) => total + (count.words || 0), 0))}</strong>
        <span>words across {(Object.values(counts) as { words?: number; chapters?: number }[]).reduce((total, count) => total + (count.chapters || 0), 0)} chapters</span>
        <div className="dashboard-widget-summary">{analytics.inProgress} active {analytics.inProgress === 1 ? 'story' : 'stories'} · {formatWords(analytics.monthlyWords)} words this month</div>
      </>
    )
  }

  return (
    <section className={`dashboard-widget-area ${customizing ? 'is-customizing' : ''}`} aria-label="Writing dashboard">
      {customizing && (
        <div className="dashboard-widget-picker">
          {DEFAULT_DASHBOARD_WIDGETS.map((widget) => (
            <button key={widget} className={widgets.includes(widget) ? 'active' : ''} onClick={() => onToggle(widget)}>
              {widgets.includes(widget) ? <Icon icon="fa-solid fa-eye" /> : <Icon icon="fa-regular fa-eye-slash" />} {widget}
            </button>
          ))}
        </div>
      )}
      <div className="dashboard-widget-grid">
        {widgets.map((widget) => (
          <article
            key={widget}
            className={`dashboard-widget dashboard-widget-${widget}`}
            draggable={customizing}
            onDragStart={() => onDragStart(widget)}
            onDragEnd={onDragEnd}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDrop(widget)}
          >
            {customizing && <span className="dashboard-drag-handle" aria-hidden="true"><Icon icon="fa-solid fa-grip-vertical" /></span>}
            {widgetContent[widget]}
          </article>
        ))}
      </div>
    </section>
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
    <Modal open={open} onClose={onClose} title="Begin a novel" width={520} className="new-novel-modal">
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
    <Modal open={!!novel} onClose={onClose} title="About this novel" width={520}>
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
