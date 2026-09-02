import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getNovel, updateNovel } from '../db/novels'
import { listChapters, updateChapter, createChapter, trashChapter, moveChapter, mergeChapters, tidyChapter, reorderChapter } from '../db/chapters'
import { restoreTrashed } from '../db/trash'
import { createFolder, listFolders, deleteFolder, moveFolder, updateFolder } from '../db/folders'
import { listCharacters } from '../db/characters'
import { listEntities } from '../db/entities'
import { listWorld } from '../db/world'
import { todayWords, addTodayWords, recordSession } from '../db/stats'
import { useApp } from '../context/AppContext'
import { readDesktopFile } from '../platform/fileOpen'
import { docxToChapters, epubToChapters } from '../utils/zipReader'
import { isDesktopRuntime } from '../api/config'
import Editor from '../components/Editor'
import Sidebar from '../components/Sidebar'
import Modal from '../components/Modal'
import Select from '../components/Select'
import ConfirmDialog from '../components/ConfirmDialog'
import AuthModal from '../components/AuthModal'
import MergeModal from '../components/MergeModal'
import { countWords, formatWords } from '../utils/words'
import { htmlToMarkdown } from '../utils/htmlToMarkdown'
import { markdownToChapters } from '../utils/markdownToChapters'
import { rtfToChapters } from '../utils/importRtf'
import { htmlToText } from '../utils/htmlToText'
import { downloadText, safeName } from '../utils/download'
import { timeAgo } from '../utils/dates'
import { computeNumbers, titleFor, isContainer } from '../utils/numbering'
import Icon from '../components/Icon'
import DesignPalette from '../components/DesignPalette'
import { designById, DESIGN_MIME } from '../designs/registry'
const Characters = lazy(() => import('./Characters'))
const Entities = lazy(() => import('./Entities'))
const Relationships = lazy(() => import('./Relationships'))
const FamilyTree = lazy(() => import('./FamilyTree'))
const World = lazy(() => import('./World'))
const Glossary = lazy(() => import('./Glossary'))
const Moodboard = lazy(() => import('./Moodboard'))
import ProsePreview from '../components/ProsePreview'
import { listGlossary } from '../db/glossary'
import { listRelationships } from '../db/relationships'
import { autoChapterMentions } from '../utils/mentions'
import AnnotationsPanel from '../components/AnnotationsPanel'
import { listAnnotations, createAnnotation, updateAnnotation, deleteAnnotation } from '../db/annotations'
import { readRecentWriting, saveRecentWriting } from '../utils/recentWriting'
const Analytics = lazy(() => import('./Analytics'))
const StoryMemory = lazy(() => import('./StoryMemory'))
const ProseTools = lazy(() => import('./ProseTools'))
const BookDesigner = lazy(() => import('./BookDesigner'))
const MediaLibrary = lazy(() => import('./MediaLibrary'))
const ProjectFiles = lazy(() => import('./ProjectFiles'))
const PlanningCockpit = lazy(() => import('./PlanningCockpit'))
const Trash = lazy(() => import('./Trash'))
const Corkboard = lazy(() => import('./Corkboard'))
const Timeline = lazy(() => import('./Timeline'))
const Continuity = lazy(() => import('./Continuity'))
const Milestones = lazy(() => import('./Milestones'))
const WritingJournal = lazy(() => import('./WritingJournal'))
const ArchiveHub = lazy(() => import('./ArchiveHub'))
import ReferencePane from '../components/ReferencePane'
import UserPill from '../components/UserPill'
import ChapterLibrary from '../components/ChapterLibrary'
import LockScreen from '../components/LockScreen'
import SessionReplay from '../components/SessionReplay'
import { saveSnapshot, clearOldSnapshots } from '../db/snapshots'
import { useContextMenu } from '../components/ContextMenu'
import ExportModal from '../components/ExportModal'
import ShareWritingModal from '../components/ShareWritingModal'
import NotificationBell from '../components/NotificationBell'
import CollaborationPresence from '../components/CollaborationPresence'
import { publishLiveRecord } from '../sync/engine'
import { sentenceDiff } from '../utils/sentenceDiff'
import { listMoodboard, deleteTile } from '../db/moodboard'

const GOAL_PRESETS = [300, 500, 1000]

const TIME_OF_DAY = ['Dawn', 'Morning', 'Midday', 'Afternoon', 'Dusk', 'Night', 'Uncertain']

const EMPTY_META = { pov: '', location: '', timeOfDay: '', tone: '', beat: '' }

const BINDER_SECTIONS = ['characters', 'relationships', 'family-tree', 'world', 'glossary', 'moodboard', 'trash']

const SECTION_LABELS = {
  characters: 'Characters',
  relationships: 'Relationships',
  'family-tree': 'Family tree',
  planning: 'Planning cockpit',
  files: 'Project files',
  world: 'Worldbuilding',
  glossary: 'Glossary',
  moodboard: 'Moodboard',
  trash: 'Trash',
  design: 'Designer',
  analytics: 'Analytics',
  'story-memory': 'Story Memory',
  'prose-tools': 'Prose tools',
  corkboard: 'Corkboard',
  timeline: 'Timeline',
  continuity: 'Continuity',
  milestones: 'Milestones',
  'writing-journal': 'Writing journal',
  versions: 'Draft history'
}

const JOURNAL_SECTIONS = ['corkboard', 'timeline', 'continuity', 'milestones', 'writing-journal', 'versions']
const MAX_OPEN_TABS = 8

export default function Novel() {
  const { id, mode, section } = useParams()
  const activeSection = section || mode || 'write'
  const location = useLocation()
  const { focusMode, setFocusMode, toast, openSettings, isNovelUnlocked, unlockNovel, settings, hasRole, syncNow } = useApp()
  const canShare = hasRole('admin') || hasRole('developer') || hasRole('beta_tester')
  const { openContextMenu } = useContextMenu()

  const [novel, setNovel] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [chapters, setChapters] = useState([])
  const [folders, setFolders] = useState([])
  const [mediaFiles, setMediaFiles] = useState([])
  const [chapter, setChapter] = useState(null)
  const [wordCount, setWordCount] = useState(0)
  const [metaDraft, setMetaDraft] = useState(EMPTY_META)
  const [todayW, setTodayW] = useState(0)
  const [goalWords, setGoalWords] = useState(500)
  const [editingGoal, setEditingGoal] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [reading, setReading] = useState(false)
  const [mobileReadPreferenceApplied, setMobileReadPreferenceApplied] = useState(false)
  useEffect(() => {
    if (mobileReadPreferenceApplied || typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 600px)').matches && activeSection === 'write') setReading(true)
    setMobileReadPreferenceApplied(true)
  }, [activeSection, mobileReadPreferenceApplied])
  const [restoreTick, setRestoreTick] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [annotations, setAnnotations] = useState([])
  const [annotationsOpen, setAnnotationsOpen] = useState(false)
  const [activeAnnotationId, setActiveAnnotationId] = useState(null)
  const [commentDraft, setCommentDraft] = useState<any>(null)
  const [editChapter, setEditChapter] = useState(null)
  const [deleteChapterTarget, setDeleteChapterTarget] = useState(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [characters, setCharacters] = useState([])
  const [terms, setTerms] = useState([])
  const [entities, setEntities] = useState([])
  const [relationships, setRelationships] = useState([])
  const [connectOpen, setConnectOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const refreshMediaFiles = useCallback(async () => { setMediaFiles((await listMoodboard(id)).filter((item) => item.kind === 'image' && item.image)) }, [id])
  const refreshFolders = useCallback(async () => { setFolders(await listFolders(id)) }, [id])
  useEffect(() => { void refreshMediaFiles() }, [refreshMediaFiles])
  useEffect(() => { void refreshFolders() }, [refreshFolders])
  const [editorDesign, setEditorDesign] = useState(null)
  const [customDesignBg, setCustomDesignBg] = useState('#ffffff')
  const [customDesignText, setCustomDesignText] = useState('#1a1a18')
  const [designsOpen, setDesignsOpen] = useState(false)
  const [designOver, setDesignOver] = useState(false)
  const [mergeSource, setMergeSource] = useState(null)
  const [replayOpen, setReplayOpen] = useState(false)
  const [lineSpacingWpp, setLineSpacingWpp] = useState(333)  // words per page at current line spacing
  const [openChapterTabs, setOpenChapterTabs] = useState([])
  const [workspacePaneIds, setWorkspacePaneIds] = useState([])
  const [collaboratorPresence, setCollaboratorPresence] = useState([])
  const [sessionTick, setSessionTick] = useState(0)
  const [sessionPaused, setSessionPaused] = useState(false)

  // refs for save flow (avoid stale closures in debounce)
  const currentIdRef = useRef(null)
  const contentRef = useRef('')
  const chaptersRef = useRef([])
  const novelRef = useRef(null)
  const lastCountRef = useRef({})
  const sessionStartRef = useRef(0)
  const sessionStartAtRef = useRef(Date.now())
  const sessionPausedAtRef = useRef(0)
  const sessionPausedMsRef = useRef(0)
  const currentWordsRef = useRef(0)
  const saveTimer = useRef(null)
  const closeSessionRef = useRef(null)
  const metaTimer = useRef(null)
  const snapshotTimer = useRef(null)
  const snapshotCaptureTimer = useRef(null)
  const liveEditTimer = useRef(null)
  const lastSnapshotContentRef = useRef(null)
  const editRevisionRef = useRef(0)
  const persistedRevisionRef = useRef(0)
  const queuedRevisionRef = useRef(0)
  const saveQueueRef = useRef(Promise.resolve())
  const isEditorFocusedRef = useRef(false)
  const hasLocalDraftRef = useRef(false)
  const saveInFlightRef = useRef(false)
  const localEditRevisionRef = useRef(0)
  const pendingRemoteChapterRef = useRef(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const captureReplaySnapshot = useCallback(async () => {
    const chId = currentIdRef.current
    const nId = novelRef.current?.id
    const content = contentRef.current
    if (!chId || !nId || content === lastSnapshotContentRef.current) return
    lastSnapshotContentRef.current = content
    await saveSnapshot(chId, nId, content || '<p><br></p>', currentWordsRef.current)
  }, [])

  const canEditSharedNovel = !novel?.sharedRole || novel.sharedRole === 'editor'
  const canProofreadSharedNovel = !novel?.sharedRole || novel.sharedRole === 'editor' || novel.sharedRole === 'commenter' || novel.sharedRole === 'viewer'

  useEffect(() => {
    novelRef.current = novel
  }, [novel])
  useEffect(() => {
    chaptersRef.current = chapters
  }, [chapters])

  // ---- snapshot recording (session baseline + timely changed states) ----
  useEffect(() => {
    clearOldSnapshots()
    snapshotTimer.current = setInterval(captureReplaySnapshot, 10_000)
    return () => clearInterval(snapshotTimer.current)
  }, [captureReplaySnapshot])

  // ---- initial load ----
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const n = await getNovel(id)
      if (cancelled) return
      if (!n) {
        setNotFound(true)
        return
      }
      novelRef.current = n
      const chs = await listChapters(id)
      if (cancelled) return
      chaptersRef.current = chs
      setNovel(n)
      setChapters(chs)
      setEditorDesign(n.layout?.editorDesign || null)
      setCustomDesignBg(n.layout?.customPageBg || '#ffffff')
      setCustomDesignText(n.layout?.customPageText || '#1a1a18')
      setGoalWords(n.goalWords || 500)
      setTodayW(await todayWords(id))
      setCharacters(await listCharacters(id))
      setTerms(await listGlossary(id))
      const [factions, artefacts, places, worldItems] = await Promise.all([
        listEntities(id, 'faction'),
        listEntities(id, 'artefact'),
        listEntities(id, 'place'),
        listWorld(id),
      ])
      const kindMap = { place: 'place', faction: 'faction', item: 'artefact' }
      const worldEntities = worldItems
        .filter((w) => kindMap[w.kind])
        .map((w) => ({ id: w.id, name: w.name, kind: kindMap[w.kind], color: w.color || null }))
      setEntities([...factions, ...artefacts, ...places, ...worldEntities])
      setRelationships(await listRelationships(id))
      const recent = readRecentWriting()
      const first = chs.find((c) => recent?.novelId === id && c.id === recent.chapterId) || chs.find((c) => c.id === n.lastChapterId) || chs[0]
      if (first) {
        setOpenChapterTabs([first.id])
        currentIdRef.current = first.id
        contentRef.current = first.content || ''
        lastCountRef.current[first.id] = first.wordCount || 0
        sessionStartRef.current = first.wordCount || 0
        sessionStartAtRef.current = Date.now()
        currentWordsRef.current = first.wordCount || 0
        lastSnapshotContentRef.current = null
        editRevisionRef.current = 0
        persistedRevisionRef.current = 0
        queuedRevisionRef.current = 0
        captureReplaySnapshot()
        setChapter(first)
        setWordCount(first.wordCount || 0)
        setTitleDraft(first.title || '')
        if (recent?.novelId === id && recent.chapterId === first.id && Number(recent.scrollTop) > 0) {
          requestAnimationFrame(() => {
            const wrap = document.querySelector('.editor-wrap')
            if (wrap) wrap.scrollTop = Number(recent.scrollTop)
          })
        }
      }
    })()
    return () => {
      cancelled = true
      clearTimeout(saveTimer.current)
      clearTimeout(snapshotCaptureTimer.current)
      clearTimeout(liveEditTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // flush save on unmount
  const saveNowRef = useRef(null)

  // ---- saving ----
  const saveNow = useCallback(async () => {
    const chId = currentIdRef.current
    const ch = chaptersRef.current.find((c) => c.id === chId)
    if (!ch || !novelRef.current) return
    const html = contentRef.current
    const words = countWords(html)
    const now = Date.now()
    const revision = editRevisionRef.current
    const novelId = novelRef.current.id

    if (revision <= persistedRevisionRef.current || revision <= queuedRevisionRef.current) {
      return saveQueueRef.current
    }
    queuedRevisionRef.current = revision

    const patch: any = { content: html, wordCount: words, updatedAt: now }
    const versions = [...(((ch as any).versions) || [])]
    const last = versions[versions.length - 1]
    if (html && html !== ch.content && (!last || now - last.at > 90000)) {
      versions.push({ at: now, words, html })
      // Keep at most 20, but never trim a named milestone unless nothing else
      // is left to drop.
      while (versions.length > 20) {
        const idx = versions.findIndex((v) => !v.label)
        versions.splice(idx === -1 ? 0 : idx, 1)
      }
      patch.versions = versions
    }

    saveQueueRef.current = saveQueueRef.current.catch(() => {}).then(async () => {
      saveInFlightRef.current = true
      // Shared-room chapter edits are persisted by the live collaboration
      // socket. Keeping them out of the ordinary pending-sync queue prevents
      // the same edit from being treated as a two-device conflict.
      await updateChapter(chId, patch, { sync: !novelRef.current.sharedRole })
      persistedRevisionRef.current = Math.max(persistedRevisionRef.current, revision)

      const prev = lastCountRef.current[chId]
      const delta = words - (prev === undefined ? ch.wordCount || 0 : prev)
      if (delta > 0) await addTodayWords(novelId, delta)
      lastCountRef.current[chId] = words

      // Only publish this save back into React when it is still the newest
      // edit. An older async write must never replace a newer live draft.
      if (currentIdRef.current === chId && editRevisionRef.current === revision) {
        setChapters((prevChs) =>
          prevChs.map((c) => (c.id === chId ? { ...c, content: html, wordCount: words, updatedAt: now } : c))
        )
        setChapter((prev) => (prev && prev.id === chId ? { ...prev, content: html, wordCount: words } : prev))
        setTodayW(await todayWords(novelId))
        setSavedAt(now)
        setDirty(false)
        hasLocalDraftRef.current = false
      }
      saveInFlightRef.current = false
    }).catch((error) => {
      // Keep the draft in memory and make a later autosave/manual save retry the
      // same revision. A local write failure must never look like a saved chapter.
      queuedRevisionRef.current = persistedRevisionRef.current
      setDirty(true)
      saveInFlightRef.current = false
      toast(error?.message || 'MoonScribe could not save this change locally. Your draft is still open — try Save again.')
    })
    return saveQueueRef.current
  }, [toast])

  saveNowRef.current = saveNow

  // ---- session pace tracking (per-device, never synced) ----
  const closeSession = useCallback(async () => {
    const chId = currentIdRef.current
    const n = novelRef.current
    if (!chId || !n) return
    const words = Math.max(0, currentWordsRef.current - sessionStartRef.current)
    const startedAt = sessionStartAtRef.current
    const now = Date.now()
    const endAt = sessionPaused ? sessionPausedAtRef.current || now : now
    const pausedMs = sessionPausedMsRef.current + (sessionPaused ? now - sessionPausedAtRef.current : 0)
    if (words > 0 && endAt - startedAt - pausedMs > 15000) {
      await recordSession(n.id, startedAt, endAt - pausedMs, words)
    }
  }, [sessionPaused])

  const resetSession = useCallback((wordCount) => {
    currentWordsRef.current = wordCount
    sessionStartRef.current = wordCount
    sessionStartAtRef.current = Date.now()
    sessionPausedAtRef.current = 0
    sessionPausedMsRef.current = 0
    setSessionPaused(false)
  }, [])

  closeSessionRef.current = closeSession

  // Switching out of write mode must flush any debounced words first, so a
  // quiet draft is never left behind on the shelf.
  const prevSectionRef = useRef(activeSection)
  useEffect(() => {
    const prev = prevSectionRef.current
    prevSectionRef.current = activeSection
    if (prev === activeSection) return
    if (prev === 'write') {
      clearTimeout(saveTimer.current)
      saveNowRef.current?.()
      closeSessionRef.current?.()
    }
    // Returning to the page: refresh the entities that feed hover cards, so
    // binder edits (new characters, terms, relationships) show up at once.
    if (activeSection === 'write') {
      listCharacters(id).then(setCharacters)
      listGlossary(id).then(setTerms)
      listRelationships(id).then(setRelationships)
      Promise.all([listEntities(id, 'faction'), listEntities(id, 'artefact'), listEntities(id, 'place'), listWorld(id)])
        .then(([f, a, p, w]) => {
          const kindMap = { place: 'place', faction: 'faction', item: 'artefact' }
          const we = w.filter((x) => kindMap[x.kind]).map((x) => ({ id: x.id, name: x.name, kind: kindMap[x.kind], color: x.color || null }))
          setEntities([...f, ...a, ...p, ...we])
        })
    }
    setReading(false)
  }, [activeSection, id])

  useEffect(() => {
    return () => {
      clearTimeout(saveTimer.current)
      clearTimeout(metaTimer.current)
      clearTimeout(snapshotCaptureTimer.current)
      saveNowRef.current?.()
      closeSessionRef.current?.()
    }
  }, [])

  const scheduleSave = useCallback(() => {
    setDirty(true)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveNowRef.current()
    }, Number(settings.autosaveDelay) || 1800)
  }, [settings.autosaveDelay])

  const handleReport = useCallback(
    (html, words) => {
      editRevisionRef.current += 1
      localEditRevisionRef.current += 1
      hasLocalDraftRef.current = true
      contentRef.current = html
      currentWordsRef.current = words
      setWordCount(words)
      clearTimeout(liveEditTimer.current)
      liveEditTimer.current = setTimeout(() => {
        const current = chaptersRef.current.find((item) => item.id === currentIdRef.current)
        if (!current || !canEditSharedNovel) return
        const updatedAt = Date.now()
        publishLiveRecord({
          store: 'chapters', id: current.id, novelId: id, updatedAt, deleted: false,
          payload: { ...current, content: html, wordCount: words, updatedAt }
        })
      }, 650)
      scheduleSave()
      clearTimeout(snapshotCaptureTimer.current)
      snapshotCaptureTimer.current = setTimeout(captureReplaySnapshot, 1400)
    },
    [scheduleSave, captureReplaySnapshot, canEditSharedNovel, id]
  )

  const selectChapter = useCallback(async (chOrId) => {
    const chId = typeof chOrId === 'string' ? chOrId : chOrId.id
    if (!openChapterTabs.includes(chId) && openChapterTabs.length >= MAX_OPEN_TABS) {
      toast('Eight chapters are already open. Close a tab before opening another.')
      return
    }
    setOpenChapterTabs((tabs) => tabs.includes(chId) ? tabs : [...tabs, chId])
    if (chId === currentIdRef.current) return
    clearTimeout(saveTimer.current)
    await saveNowRef.current()
    await closeSessionRef.current()
    const ch = typeof chOrId === 'string' ? chaptersRef.current.find((c) => c.id === chId) : chOrId
    if (!ch) return
    currentIdRef.current = chId
    contentRef.current = ch.content || ''
    lastSnapshotContentRef.current = null
    editRevisionRef.current = 0
    persistedRevisionRef.current = 0
    queuedRevisionRef.current = 0
    lastCountRef.current[chId] = ch.wordCount || 0
    resetSession(ch.wordCount || 0)
    captureReplaySnapshot()
    setChapter(ch)
    setWordCount(ch.wordCount || 0)
    setTitleDraft(ch.title || '')
    setReading(false)
    setRestoreTick((t) => t + 1)
    setSavedAt(null)
    setDirty(false)
    setSidebarOpen(false)
    updateNovel(novelRef.current.id, { lastChapterId: chId, lastOpened: Date.now() }, { sync: false })
    saveRecentWriting({ novelId: novelRef.current.id, chapterId: chId, mode: activeSection, scrollTop: 0 })
  }, [captureReplaySnapshot, resetSession, toast, openChapterTabs, activeSection])

  useEffect(() => {
    const wrap = document.querySelector('.editor-wrap')
    if (!wrap || !novelRef.current?.id || !currentIdRef.current) return
    const remember = () => saveRecentWriting({ novelId: novelRef.current.id, chapterId: currentIdRef.current, mode: activeSection, scrollTop: wrap.scrollTop })
    wrap.addEventListener('scroll', remember, { passive: true })
    return () => wrap.removeEventListener('scroll', remember)
  }, [chapter?.id, activeSection])

  const handleMobileTouchStart = useCallback((event) => {
    if (activeSection !== 'write' || event.touches.length !== 1) return
    const touch = event.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [activeSection])

  const handleMobileTouchEnd = useCallback((event) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start || activeSection !== 'write' || event.changedTouches.length !== 1) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.35) return
    const writable = chaptersRef.current.filter((item) => item.kind === 'chapter' || item.kind === 'subchapter')
    const currentIndex = writable.findIndex((item) => item.id === currentIdRef.current)
    const next = writable[currentIndex + (dx < 0 ? 1 : -1)]
    if (next) void selectChapter(next)
  }, [activeSection, selectChapter])

  const closeChapterTab = useCallback(async (tabId) => {
    const remaining = openChapterTabs.filter((item) => item !== tabId)
    setOpenChapterTabs(remaining)
    setWorkspacePaneIds((current) => current.filter((item) => item !== tabId))
    if (tabId === currentIdRef.current && remaining.length) await selectChapter(remaining[remaining.length - 1])
    if (!remaining.length) {
      setSplitOpen(false)
    }
  }, [openChapterTabs, selectChapter])

  const workspacePanes = useMemo(
    () => workspacePaneIds
      .map((paneId) => chapters.find((item) => item.id === paneId))
      .filter(Boolean),
    [chapters, workspacePaneIds]
  )

  const collaboratorsByChapter = useMemo(() => collaboratorPresence.reduce((acc, person) => {
    if (!person?.chapterId) return acc
    if (!acc[person.chapterId]) acc[person.chapterId] = []
    acc[person.chapterId].push(person)
    return acc
  }, {}), [collaboratorPresence])

  const openInSplit = useCallback((chapterId) => {
    if (!chapterId || chapterId === currentIdRef.current) return
    if (!openChapterTabs.includes(chapterId) && openChapterTabs.length >= MAX_OPEN_TABS) {
      toast('Eight chapters are already open. Close a tab before opening another.')
      return
    }
    if (!workspacePaneIds.includes(chapterId) && workspacePaneIds.length >= 3) {
      toast('The workspace can hold up to four chapters at once.')
      return
    }
    setOpenChapterTabs((tabs) => tabs.includes(chapterId) ? tabs : [...tabs, chapterId])
    setWorkspacePaneIds((current) => current.includes(chapterId) ? current : [...current, chapterId])
    setSplitOpen(true)
  }, [openChapterTabs, toast, workspacePaneIds])

  const removeWorkspacePane = useCallback((chapterId) => {
    setWorkspacePaneIds((current) => {
      const next = current.filter((item) => item !== chapterId)
      if (!next.length) setSplitOpen(false)
      return next
    })
  }, [])

  const promoteWorkspacePane = useCallback(async (chapterId) => {
    if (!chapterId || chapterId === currentIdRef.current) return
    const previousMainId = currentIdRef.current
    await selectChapter(chapterId)
    setWorkspacePaneIds((current) => {
      const withoutPromoted = current.filter((item) => item !== chapterId && item !== previousMainId)
      const next = previousMainId ? [previousMainId, ...withoutPromoted] : withoutPromoted
      return next.slice(0, 3)
    })
    setSplitOpen(true)
  }, [selectChapter])

  const toggleSplitView = useCallback(() => {
    if (splitOpen && workspacePaneIds.length) {
      setWorkspacePaneIds([])
      setSplitOpen(false)
      return
    }
    const fallback = openChapterTabs.find((tabId) => tabId !== currentIdRef.current) || chapters.find((item) => item.id !== currentIdRef.current)?.id || null
    if (!fallback) {
      toast('Open another chapter first, then split the workspace.')
      return
    }
    setWorkspacePaneIds((current) => current.length ? current : [fallback])
    setSplitOpen(true)
  }, [chapters, currentIdRef, openChapterTabs, splitOpen, toast, workspacePaneIds.length])

  const patchChapterLocal = useCallback((chapterId, patch) => {
    if (!chapterId || !patch) return
    setChapters((prev) => prev.map((item) => (item.id === chapterId ? { ...item, ...patch } : item)))
    setChapter((prev) => (prev && prev.id === chapterId ? { ...prev, ...patch } : prev))
  }, [])

  // Scene metadata (POV, place, time, tone, beat) — synced to the chapter
  // record so the editor's metadata bar stays a quiet, low-stakes surface.
  useEffect(() => {
    setMetaDraft(chapter?.meta || EMPTY_META)
  }, [chapter?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Private comments for the open chapter. They live in their own store, so
  // they never travel into an export.
  useEffect(() => {
    if (chapter?.id) listAnnotations(id, chapter.id).then(setAnnotations)
    else setAnnotations([])
    setCommentDraft(null)
    setActiveAnnotationId(null)
  }, [chapter?.id, id])

  const onComment = useCallback((quote) => {
    setCommentDraft({ quote: quote || '', comment: '', type: 'note' })
    setAnnotationsOpen(true)
  }, [])

  const revealComment = useCallback((annotationId) => {
    setActiveAnnotationId(annotationId || null)
    if (annotationId) setAnnotationsOpen(true)
  }, [])

  const saveComment = useCallback(async () => {
    if (!commentDraft || !chapter) return
    if (!commentDraft.comment.trim()) {
      toast('Add a note to save the comment.')
      return
    }
    await createAnnotation(id, {
      chapterId: chapter.id,
      quote: commentDraft.quote,
      comment: commentDraft.comment.trim(),
      type: commentDraft.type
    } as any)
    const next = await listAnnotations(id, chapter.id)
    setAnnotations(next)
    setActiveAnnotationId(next[next.length - 1]?.id || null)
    setCommentDraft(null)
    toast(novel?.sharedRole ? 'Proofread comment saved to the shared novel.' : 'Comment kept — private to you.')
  }, [commentDraft, chapter, id, novel?.sharedRole, toast])

  const resolveAnnotation = useCallback(async (a) => {
    await updateAnnotation(a.id, { resolved: !a.resolved })
    if (chapter?.id) setAnnotations(await listAnnotations(id, chapter.id))
  }, [id, chapter?.id])

  const removeAnnotation = useCallback(async (a) => {
    await deleteAnnotation(a.id)
    if (chapter?.id) setAnnotations(await listAnnotations(id, chapter.id))
  }, [id, chapter?.id])

  const applyLiveRecord = useCallback(async (record) => {
    if (!record || String(record.novelId || '') !== String(id)) return
    if (record.store === 'chapters') {
      if (record.deleted) {
        setChapters((items) => items.filter((item) => String(item.id) !== String(record.id)))
        return
      }
      const incoming = record.payload
      if (!incoming || typeof incoming !== 'object' || typeof incoming.content !== 'string') return
      // The live socket can echo this tab's own optimistic chapter update.
      // Treating that echo as a remote restore remounts Editor while its
      // autosave timer is active, which creates a save/reload loop.
      if (String(incoming.id) === String(currentIdRef.current)
        && contentRef.current === (incoming.content || '')
        && currentWordsRef.current === (Number(incoming.wordCount) || 0)) return
      setChapters((items) => {
        let matched = false
        const next = items.map((item) => {
          if (String(item.id) !== String(incoming.id)) return item
          matched = true
          return { ...item, ...incoming }
        })
        return matched ? next : [...next, incoming]
      })
      if (String(incoming.id) === String(currentIdRef.current)) {
        // Never remount or replace an editor while it has local input in
        // flight. Doing so interrupts the contenteditable transaction and
        // was the source of the shared-room crash screen.
        pendingRemoteChapterRef.current = incoming
        if (isEditorFocusedRef.current || hasLocalDraftRef.current || saveInFlightRef.current || dirty) return
        contentRef.current = incoming.content || ''
        currentWordsRef.current = Number(incoming.wordCount) || 0
        lastCountRef.current[incoming.id] = Number(incoming.wordCount) || 0
        setChapter((prev) => prev && String(prev.id) === String(incoming.id) ? { ...prev, ...incoming } : incoming)
        setWordCount(Number(incoming.wordCount) || 0)
        setTitleDraft(incoming.title || '')
        setDirty(false)
        setSavedAt(new Date())
      }
    } else if (record.store === 'annotations') {
      const targetChapterId = record.payload?.chapterId || record.chapterId
      if (chapter?.id && (!targetChapterId || String(targetChapterId) === String(chapter.id))) {
        setAnnotations(await listAnnotations(id, chapter.id))
      }
    } else if (record.store === 'novels' && record.payload) {
      setNovel(record.payload)
    } else if (record.store === 'moodboard') {
      window.dispatchEvent(new CustomEvent('moonscribe:shared-media-refresh', { detail: { novelId: id, record } }))
    }
  }, [id, chapter?.id, dirty])

  const commitMeta = useCallback((meta) => {
    const chId = currentIdRef.current
    if (!chId) return
    clearTimeout(metaTimer.current)
    metaTimer.current = setTimeout(async () => {
      await updateChapter(chId, { meta })
      setChapters((prev) => prev.map((c) => (c.id === chId ? { ...c, meta } : c)))
      setChapter((prev) => (prev && prev.id === chId ? { ...prev, meta } : prev))
    }, 450)
  }, [])

  // The command palette can deep-link straight to a specific chapter.
  useEffect(() => {
    const cid = location.state?.chapterId
    if (!cid || cid === currentIdRef.current) return
    const ch = chaptersRef.current.find((c) => c.id === cid)
    if (ch) selectChapter(ch)
  }, [location.state?.chapterId, selectChapter])

  // ---- chapter operations ----
  const addChapter = useCallback(
    async (part = '') => {
      const ch = await createChapter(id, { title: '', part })
      const chs = await listChapters(id)
      setChapters(chs)
      selectChapter(ch)
    },
    [id, selectChapter]
  )

  const addNode = useCallback(
    async (kind, parentId = null) => {
      if (kind === 'folder') {
        const rootOrders = [...chapters.filter((chapter) => !chapter.parentId).map((chapter) => Number(chapter.order) || 0), ...folders.filter((folder) => !folder.parentId).map((folder) => Number(folder.order) || 0)]
        await createFolder(id, { name: 'New folder', order: (rootOrders.length ? Math.max(...rootOrders) : 0) + 1 })
        await refreshFolders()
        toast('Folder created at the manuscript root.')
        return
      }
      // Folders are manuscript-level containers by default. Chapters/scenes
      // may still be explicitly created inside a selected folder.
      const folderParent = parentId && folders.some((folder) => folder.id === parentId) ? parentId : null
      const resolvedParentId = kind === 'part' || folderParent ? null : parentId
      const ch = await createChapter(id, { title: '', kind, parentId: resolvedParentId, folderId: folderParent })
      const chs = await listChapters(id)
      setChapters(chs)
      selectChapter(ch)
    },
    [chapters, folders, id, refreshFolders, selectChapter, toast]
  )

  const handleReorder = useCallback(
    async (chId, parentId, index) => {
      setChapters(await reorderChapter(id, chId, { parentId, index }))
    },
    [id]
  )

  const handleMove = useCallback(
    async (chId, dir) => {
      setChapters(await moveChapter(id, chId, dir))
    },
    [id]
  )

  const handleTrashChapter = useCallback(async () => {
    const target = deleteChapterTarget
    if (!target) return
    // Preserve the outline when removing a container or parent chapter. A
    // missing parent used to make its descendants disappear from the tree;
    // re-parent them first, retaining their folder membership in both cases.
    const current = await listChapters(id)
    const children = current.filter((chapter) => chapter.parentId === target.id)
    if (children.length) {
      await Promise.all(children.map((chapter) => updateChapter(chapter.id, {
        parentId: target.parentId || null,
        folderId: chapter.folderId || null
      })))
    }
    await trashChapter(target.id)
    setDeleteChapterTarget(null)
    const chs = await listChapters(id)
    setChapters(chs)
    if (currentIdRef.current === target.id) {
      const next = chs[0]
      if (next) {
        currentIdRef.current = next.id
        contentRef.current = next.content || ''
        resetSession(next.wordCount || 0)
        setChapter(next)
        setWordCount(next.wordCount || 0)
        setTitleDraft(next.title || '')
        setRestoreTick((t) => t + 1)
      } else {
        currentIdRef.current = null
        contentRef.current = ''
        currentWordsRef.current = 0
        sessionStartRef.current = 0
        sessionStartAtRef.current = Date.now()
        setChapter(null)
        setWordCount(0)
        setTitleDraft('')
      }
    }
    toast('Moved to the Trash — recoverable for 30 days.', { label: 'Undo', run: async () => { await restoreTrashed('chapters', target.id); const restored = await listChapters(id); setChapters(restored); if (!chapter && restored[0]) await selectChapter(restored[0].id) } })
  }, [id, deleteChapterTarget, toast, resetSession, chapter, selectChapter])

  const saveChapterEdit = useCallback(async () => {
    if (!editChapter) return
    await updateChapter(editChapter.id, {
      title: editChapter.title?.trim() || '',
      part: editChapter.part,
      kind: editChapter.kind,
      parentId: editChapter.parentId || null,
      folderId: ['book', 'part', 'act'].includes(editChapter.kind) ? null : (editChapter.folderId || null),
      status: editChapter.status,
      icon: editChapter.icon || null,
      color: editChapter.color || null,
      folderTheme: editChapter.folderTheme || null
    })
    setChapters(await listChapters(id))
    setEditChapter(null)
  }, [editChapter, id])

  const commitTitle = useCallback(async () => {
    if (!chapter) return
    const t = titleDraft.trim()
    if (t !== chapter.title) {
      await updateChapter(chapter.id, { title: t })
      setChapters((prev) => prev.map((c) => (c.id === chapter.id ? { ...c, title: t } : c)))
      setChapter((prev) => (prev ? { ...prev, title: t } : prev))
    }
  }, [chapter, titleDraft])

  // A named snapshot — "End of Act 1", "Beta draft". Protected from the
  // rolling auto-snapshot trim so it stays until deliberately removed.
  const saveMilestone = useCallback(async (label) => {
    const chId = currentIdRef.current
    const ch = chaptersRef.current.find((c) => c.id === chId)
    if (!ch) return
    const html = contentRef.current || ch.content || ''
    const words = countWords(html)
    const versions = [...(ch.versions || []), { at: Date.now(), words, html, label: label || 'Milestone' }]
    await updateChapter(chId, { versions })
    setChapters((prev) => prev.map((c) => (c.id === chId ? { ...c, versions } : c)))
    setChapter((prev) => (prev && prev.id === chId ? { ...prev, versions } : prev))
    toast(`Milestone “${label || 'Milestone'}” saved.`)
  }, [toast])

  // ---- tidy + merge ----
  const applyTidiedChapter = useCallback((res, chId) => {
    if (!res) return
    setChapters((prev) => prev.map((c) => (c.id === chId && res.chapter ? { ...c, ...res.chapter } : c)))
    if (chId === currentIdRef.current && res.chapter) {
      currentIdRef.current = res.chapter.id
      contentRef.current = res.chapter.content || ''
      lastCountRef.current[res.chapter.id] = res.chapter.wordCount || 0
      sessionStartRef.current = res.chapter.wordCount || 0
      setChapter(res.chapter)
      setWordCount(res.chapter.wordCount || 0)
      setTitleDraft(res.chapter.title || '')
      setRestoreTick((t) => t + 1)
    }
    const s = res.stats
    const bits = []
    if (s.sceneBreaks) bits.push(`${s.sceneBreaks} scene break${s.sceneBreaks === 1 ? '' : 's'}`)
    if (s.headings) bits.push(`${s.headings} heading${s.headings === 1 ? '' : 's'}`)
    if (s.unwrapped) bits.push(`${s.unwrapped} stray tag${s.unwrapped === 1 ? '' : 's'}`)
    if (s.blankLines) bits.push(`${s.blankLines} blank line${s.blankLines === 1 ? '' : 's'}`)
    toast(res.changed ? `Tidied — ${bits.join(', ') || 'polish applied'}.` : 'Already clean — nothing to tidy.')
  }, [toast])

  const handleTidy = useCallback(
    async (c) => {
      const res = await tidyChapter(c.id)
      applyTidiedChapter(res, c.id)
    },
    [applyTidiedChapter]
  )

  const handleMerge = useCallback(
    async (direction, targetId, separator) => {
      if (!mergeSource) return
      const keepId = direction === 'into-current' ? mergeSource.id : targetId
      const absorbId = direction === 'into-current' ? targetId : mergeSource.id
      clearTimeout(saveTimer.current)
      await closeSessionRef.current()
      const res = await mergeChapters(id, keepId, absorbId, { separator })
      if (!res) {
        toast('Nothing to merge.')
        return
      }
      setChapters(res.after)
      setMergeSource(null)
      const next = res.keep
      currentIdRef.current = next.id
      contentRef.current = next.content || ''
      lastCountRef.current[next.id] = next.wordCount || 0
      resetSession(next.wordCount || 0)
      setChapter(next)
      setWordCount(next.wordCount || 0)
      setTitleDraft(next.title || '')
      setRestoreTick((t) => t + 1)
      toast(`“${next.title || 'Untitled'}” now holds ${formatWords(next.wordCount || 0)} words.`)
    },
    [id, toast, mergeSource, resetSession]
  )

  // ---- goal ----
  const commitGoal = useCallback(async () => {
    const g = Math.max(0, Math.floor(Number(goalWords) || 0))
    setGoalWords(g)
    setEditingGoal(false)
    if (novel) await updateNovel(id, { goalWords: g })
  }, [goalWords, novel, id])

  // ---- premade designs ----
  const applyEditorDesign = useCallback((dId) => {
    const persistDesign = (layoutPatch) => {
      const layout = { ...(novelRef.current?.layout || {}), ...layoutPatch }
      novelRef.current = { ...novelRef.current, layout }
      setNovel((current) => current ? { ...current, layout } : current)
      updateNovel(id, { layout })
    }
    if (dId === 'custom') {
      setEditorDesign('custom')
      persistDesign({ editorDesign: 'custom', customPageBg: customDesignBg, customPageText: customDesignText })
      setDesignsOpen(false)
      return
    }
    const d = designById(dId)
    if (!d) return
    setEditorDesign(d.id)
    persistDesign({ editorDesign: d.id })
    toast(`${d.name} across the page.`)
    setDesignsOpen(false)
  }, [id, toast, customDesignBg, customDesignText])

  const onDropDesign = useCallback((e) => {
    e.preventDefault()
    setDesignOver(false)
    const d = designById(e.dataTransfer.getData(DESIGN_MIME))
    if (d) applyEditorDesign(d.id)
  }, [applyEditorDesign])

  // ---- export ----
  const runExport = useCallback(
    async (kind) => {
      setExportOpen(false)
      const n = novelRef.current
      if (!n) return
      const chs = chaptersRef.current
      const ordered = [...chs].sort((a, b) => a.order - b.order)
      const numbers = computeNumbers(ordered)
      const display = ordered.map((c) => ({ ...c, title: titleFor(c, numbers) }))
      if (kind === 'markdown') {
        let md = `# ${n.title}\n\n*for Storm Tattersall*\n\n`
        for (const c of display) {
          if (isContainer(c)) md += `\n# ${c.title}\n\n`
          md += `## ${c.title}\n\n${htmlToMarkdown(c.content)}\n\n`
        }
        downloadText(md, `${safeName(n.title)}.md`)
        toast('Markdown downloaded.')
      } else if (kind === 'txt') {
        let txt = `${n.title}\nfor Storm Tattersall\n\n`
        for (const c of display) {
          txt += `\n${c.title}\n${'-'.repeat(Math.min(c.title.length, 30))}\n\n${htmlToText(c.content)}\n`
        }
        downloadText(txt, `${safeName(n.title)}.txt`)
        toast('Plain text downloaded.')
      } else if (kind === 'docx') {
        const { exportNovelDocx } = await import('../utils/exportDocx')
        await exportNovelDocx(n, display, n.layout || {})
        toast('Word document downloaded.')
      } else if (kind === 'epub') {
        const { exportNovelEpub } = await import('../utils/exportEpub')
        await exportNovelEpub(n, display, n.layout || {})
        toast('eBook downloaded.')
      } else if (kind === 'print') {
        window.location.hash = `#/novel/${n.id}/design/print`
      }
    },
    [toast]
  )

  const reloadChapters = useCallback(async () => {
    const chs = await listChapters(id)
    chaptersRef.current = chs
    setChapters(chs)
    return chs
  }, [id])

  const importMdRef = useRef(null)
  const importRtfRef = useRef(null)

  const importChapters = useCallback(
    async (imported, fileName) => {
      if (!imported || !imported.length) {
        toast('Nothing to import from that file.')
        return
      }
      for (const ch of imported) {
        await createChapter(id, { title: ch.title, content: ch.content })
      }
      await reloadChapters()
      updateNovel(id, { updatedAt: Date.now() }, { sync: false })
      toast(`${imported.length} ${imported.length === 1 ? 'chapter' : 'chapters'} imported from “${fileName}”.`)
    },
    [id, reloadChapters, toast]
  )

  const handleImportMd = useCallback(
    async (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      setExportOpen(false)
      const text = await file.text()
      await importChapters(markdownToChapters(text), file.name)
    },
    [importChapters]
  )

  const handleImportRtf = useCallback(
    async (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      setExportOpen(false)
      const text = await file.text()
      const imported = rtfToChapters(text)
      if (imported === null) {
        toast('That doesn’t look like an RTF file. In Scrivener, use Compile → Rich Text (.rtf).')
        return
      }
      await importChapters(imported, file.name)
    },
    [importChapters, toast]
  )

  const handleMoveToFolder = useCallback(async (chapterId, folderId) => {
    const chapter = chapters.find((item) => item.id === chapterId)
    if (!chapter || ['book', 'part', 'act'].includes(chapter.kind)) return
    await updateChapter(chapterId, { folderId, parentId: null })
    setChapters(await listChapters(id))
    toast(folderId ? 'Chapter moved into folder.' : 'Chapter moved to manuscript root.')
  }, [chapters, id, toast])

  const handleMoveFolder = useCallback(async (folderId, targetId, position = 'inside') => {
    if (targetId == null) {
      await moveFolder(folderId, null, null)
      await refreshFolders()
      toast('Folder moved to manuscript root.')
      return
    }
    if (folderId === targetId) return
    const source = folders.find((folder) => folder.id === folderId)
    const target = folders.find((folder) => folder.id === targetId)
    if (!source || !target) return
    const siblings = folders.filter((folder) => (folder.parentId || null) === (target.parentId || null) && folder.id !== folderId).sort((a, b) => (a.order || 0) - (b.order || 0))
    const index = position === 'after' ? siblings.findIndex((folder) => folder.id === targetId) + 1 : Math.max(0, siblings.findIndex((folder) => folder.id === targetId))
    await moveFolder(folderId, position === 'inside' ? targetId : target.parentId || null, position === 'inside' ? null : index)
    await refreshFolders()
    toast('Folder moved.')
  }, [folders, refreshFolders, toast])

  const handleFolderAppearance = useCallback(async (folder, kind) => {
    const colors = ['#c9953d', '#d85ab5', '#78a6d8', '#82b879', '#b78bd6']
    const icons = ['fa-solid fa-folder', 'fa-solid fa-folder-open', 'fa-solid fa-star', 'fa-solid fa-moon', 'fa-solid fa-feather-pointed']
    const themes = ['plain', 'soft', 'outline', 'glow']
    const values = kind === 'color' ? colors : kind === 'icon' ? icons : themes
    const field = kind === 'color' ? 'color' : kind === 'icon' ? 'icon' : 'theme'
    const current = folder[field]
    const next = values[(Math.max(0, values.indexOf(current)) + 1) % values.length]
    await updateFolder(folder.id, { [field]: next })
    await refreshFolders()
    toast(`${kind === 'color' ? 'Folder colour' : kind === 'icon' ? 'Folder icon' : 'Folder theme'} updated.`)
  }, [refreshFolders, toast])

  const handleImportFile = useCallback(async (file) => {
    if (!file) return
    const name = file.name || 'imported manuscript'
    const extension = name.split('.').pop()?.toLowerCase()
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (extension === 'docx') await importChapters(await docxToChapters(bytes), name)
      else if (extension === 'epub') await importChapters(await epubToChapters(bytes), name)
      else {
        const text = new TextDecoder().decode(bytes)
        const imported = extension === 'rtf' ? rtfToChapters(text) : markdownToChapters(text)
        if (imported) await importChapters(imported, name)
      }
    } catch (error) { toast(error instanceof Error ? error.message : `Could not import “${name}”.`) }
  }, [importChapters, toast])

  useEffect(() => {
    if (!isDesktopRuntime()) return
    const onDesktopFiles = (event: Event) => {
      const paths = (event as CustomEvent<{ paths?: string[] }>).detail?.paths || []
      void (async () => {
        for (const path of paths) {
          const name = path.split(/[\\/]/).pop() || path
          try {
            const bytes = await readDesktopFile(path)
            await handleImportFile(new File([bytes], name))
          } catch (error) {
            toast(error instanceof Error ? error.message : `Could not open “${name}”.`)
          }
        }
      })()
    }
    window.addEventListener('moonscribe:desktop-files-opened', onDesktopFiles)
    return () => window.removeEventListener('moonscribe:desktop-files-opened', onDesktopFiles)
  }, [handleImportFile, importChapters, toast])

  useEffect(() => {
    if (activeSection !== 'write' || !chapter?.id) return
    const timer = window.setInterval(() => setSessionTick((tick) => tick + 1), 1000)
    return () => window.clearInterval(timer)
  }, [activeSection, chapter?.id])

  const toggleSessionPause = useCallback(() => {
    const now = Date.now()
    if (sessionPaused) {
      sessionPausedMsRef.current += Math.max(0, now - sessionPausedAtRef.current)
      sessionPausedAtRef.current = 0
      setSessionPaused(false)
    } else {
      sessionPausedAtRef.current = now
      setSessionPaused(true)
    }
  }, [sessionPaused])

  const totalWords = chapters.reduce((s, c) => s + (c.wordCount || 0), 0)
  const sessionWords = Math.max(0, wordCount - sessionStartRef.current)
  const sessionElapsed = Math.max(0, Date.now() - sessionStartAtRef.current - sessionPausedMsRef.current - (sessionPaused ? Date.now() - sessionPausedAtRef.current : 0))
  void sessionTick
  const sessionMinutes = Math.floor(sessionElapsed / 60000)
  const sessionSeconds = Math.floor(sessionElapsed / 1000) % 60
  const sessionClock = `${sessionMinutes}:${String(sessionSeconds).padStart(2, '0')}`
  const sessionWpm = sessionElapsed > 30000 ? Math.round(sessionWords / (sessionElapsed / 60000)) : null
  const goalPct = goalWords > 0 ? Math.min(100, Math.round((todayW / goalWords) * 100)) : 0

  const hasProse = !!(chapter && chapter.content && chapter.content.replace(/<[^>]*>/g, '').trim())
  const mentionsMap = useMemo(() => autoChapterMentions(chapters, characters), [chapters, characters])
  const navigate = useNavigate()
  const openSection = useCallback((seg) => { navigate(`/novel/${id}/${seg}`) }, [id, navigate])

  if (notFound) {
    return (
      <div className="app" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-5)' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '3rem', fontWeight: 600, color: 'var(--twilight)', lineHeight: 1 }}>The book’s not here</div>
          <div style={{ color: 'var(--rose)', fontSize: '1.1rem', letterSpacing: '0.4em', margin: '12px 0 18px' }}>❦</div>
          <p className="muted" style={{ margin: '0 0 28px' }}>This novel may have been tucked away, or the shelf was rearranged.</p>
          <Link className="button button-primary" to="/" style={{ textDecoration: 'none' }}>← Back to all novels</Link>
        </div>
      </div>
    )
  }

  if (!novel) {
    return <div className="app" style={{ padding: 'var(--space-7)', textAlign: 'center', color: 'var(--grey)' }}>Finding your novel…</div>
  }

  if (novel.lock && !isNovelUnlocked(novel.id)) {
    return (
      <div className="app">
        <LockScreen
          title="This novel is locked"
          lead={`Enter the passphrase for “${novel.title || 'this novel'}”.`}
          onUnlock={(pass) => unlockNovel(novel, pass)}
        />
      </div>
    )
  }

  return (
    <div
      className={`workspace ${editorDesign ? `design-${editorDesign}` : ''} ${focusMode && activeSection === 'write' ? 'focus-mode' : ''}`}
      style={editorDesign === 'custom' ? ({ ['--design-custom-bg' as any]: customDesignBg, ['--design-custom-text' as any]: customDesignText } as CSSProperties) : undefined}
    >
      <Sidebar
        novel={novel}
        totalWords={totalWords}
        chapters={chapters}
        folders={folders}
        onFolderDelete={async (folder) => { await deleteFolder(folder.id); await refreshFolders(); toast('Folder deleted.') }}
        onMoveToFolder={handleMoveToFolder}
        onMoveFolder={handleMoveFolder}
        onFolderAppearance={handleFolderAppearance}
        onFolderSettings={async (folder) => { await updateFolder(folder.id, { name: folder.name.trim() || 'New folder', icon: folder.icon || null, color: folder.color || null, theme: folder.theme || 'plain' }); await refreshFolders(); toast('Folder settings saved.') }}
        mediaFiles={mediaFiles}
        onMediaSelect={() => navigate(`/novel/${id}/media`)}
        onMediaDelete={async (file) => { await deleteTile(file.id); await refreshMediaFiles(); toast('Media file deleted.') }}
        collaborators={collaboratorPresence}
        currentId={currentIdRef.current}
        onSelect={selectChapter}
        onAdd={addNode}
        onMove={handleMove}
        onEdit={setEditChapter}
        onDelete={setDeleteChapterTarget}
        onTidy={handleTidy}
        onMerge={setMergeSource}
        onReorder={handleReorder}
        onOpenLibrary={() => setLibraryOpen(true)}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSyncClick={async () => { try { await syncNow?.(); toast('Synced.') } catch { toast('Sync needs attention.') } }}
        onTitleChange={(title) => setNovel((n) => n ? { ...n, title } : n)}
        onTitleSave={() => novel && updateNovel(novel.id, { title: novel.title })}
        onToggleFavorite={async (target) => {
          const next = await updateChapter(target.id, { favorite: !target.favorite })
          patchChapterLocal(target.id, { favorite: next?.favorite })
          toast(next?.favorite ? 'Added to favorites.' : 'Removed from favorites.')
        }}
      />
      {sidebarOpen && <button type="button" className="mobile-sidebar-backdrop" aria-label="Close chapters sidebar" onClick={() => setSidebarOpen(false)} />}

      <ChapterLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        chapters={chapters}
        currentId={currentIdRef.current}
        onSelect={selectChapter}
        onAdd={addNode}
        onMove={handleMove}
        onEdit={setEditChapter}
        onDelete={setDeleteChapterTarget}
        onTidy={handleTidy}
        onMerge={setMergeSource}
        onReorder={handleReorder}
      />

      <div
        className={`main ${activeSection === 'write' && designOver ? 'design-dropzone drag-over' : ''}`}
        onTouchStart={handleMobileTouchStart}
        onTouchEnd={handleMobileTouchEnd}
        {...(activeSection === 'write'
          ? {
              onDragOver: (e) => {
                if (e.dataTransfer.types.includes(DESIGN_MIME) || e.dataTransfer.types.includes('text/plain')) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DESIGN_MIME) ? 'copy' : 'move'
                }
              },
              onDragEnter: (e) => {
                if (e.dataTransfer.types.includes(DESIGN_MIME)) setDesignOver(true)
              },
              onDragLeave: () => setDesignOver(false),
              onDrop: (e) => {
                if (e.dataTransfer.types.includes(DESIGN_MIME)) return onDropDesign(e)
                if (e.dataTransfer.files?.length) {
                  e.preventDefault()
                  Array.from(e.dataTransfer.files).forEach((file) => void handleImportFile(file))
                  return
                }
                e.preventDefault()
                const chapterId = e.dataTransfer.getData('text/plain')
                if (chaptersRef.current.some((item) => item.id === chapterId)) {
                  if (chapterId === currentIdRef.current) return
                  openInSplit(chapterId)
                  toast('Chapter opened in the workspace.')
                }
              }
            }
          : {})}
      >
        <div className="workspace-topbar">
            <div className="actions-row">
              <button className="button button-quiet mobile-menu-btn" onClick={() => setSidebarOpen(true)} title="Chapters" aria-label="Open chapters">
                <Icon icon="fa-solid fa-bars" />
              </button>
            <span className="crumbs">
              <Link to="/">All novels</Link> ·{' '}
              {activeSection === 'write' ? (
                <strong>{novel.title}</strong>
              ) : (
                <>
                  <Link to={`/novel/${id}`}>{novel.title}</Link> · <strong>{SECTION_LABELS[activeSection] || activeSection}</strong>
                </>
              )}
            </span>
          </div>
          <div className="actions-row">
            {canShare && <CollaborationPresence novelId={id} chapterId={chapter?.id} chapterTitle={chapter?.title} workspace={SECTION_LABELS[activeSection] || activeSection} onPresenceChange={setCollaboratorPresence} onRecord={applyLiveRecord} />}
            <button className={`button button-ghost ${!canShare ? 'beta-locked-button' : ''}`} onClick={() => canShare && setShareOpen(true)} disabled={!canShare} title={canShare ? 'Invite writers and manage access' : 'Share is locked during the beta'}><Icon icon={canShare ? 'fa-solid fa-user-plus' : 'fa-solid fa-lock'} style={{ marginRight: 6 }} /> Share</button>
            {activeSection === 'write' ? (
              reading ? (
                <button className="button button-primary" onClick={() => setReading(false)}><Icon icon="fa-solid fa-pen-nib" style={{ marginRight: 6 }} /> Write</button>
              ) : (
                <button className="button button-ghost" onClick={() => setReading(true)}>Read</button>
              )
            ) : (
              <Link className="button button-primary" to={`/novel/${id}`}><Icon icon="fa-solid fa-pen-nib" style={{ marginRight: 6 }} /> Write</Link>
            )}
            <div style={{ position: 'relative' }}>
              <input ref={importMdRef} type="file" accept=".md,.markdown,text/markdown,text/plain" style={{ display: 'none' }} onChange={handleImportMd} />
              <input ref={importRtfRef} type="file" accept=".rtf,text/rtf,application/rtf" style={{ display: 'none' }} onChange={handleImportRtf} />
              <button className="button button-ghost" onClick={() => setExportOpen(true)}><Icon icon="fa-solid fa-download" style={{ marginRight: 6 }} /> Export</button>
            </div>
            <button className="button button-ghost" title={focusMode ? 'Exit focus mode' : 'Focus mode — hide everything but the page'} onClick={() => setFocusMode(!focusMode)}>
              <Icon icon={focusMode ? 'fa-solid fa-expand' : 'fa-solid fa-compress'} style={{ marginRight: 6 }} /> {focusMode ? 'Exit focus' : 'Focus'}
            </button>
            <NotificationBell />
            <UserPill onConnectClick={() => setConnectOpen(true)} />
          </div>
        </div>

        {activeSection === 'write' && openChapterTabs.length > 0 && <div className="chapter-tabbar" aria-label="Open chapters">
          {openChapterTabs.map((tabId) => {
            const tabChapter = chapters.find((item) => item.id === tabId)
            if (!tabChapter) return null
            const inWorkspace = workspacePaneIds.includes(tabId)
            const tabPeople = collaboratorsByChapter[tabId] || []
            return <button key={tabId} className={`chapter-work-tab ${tabId === currentIdRef.current ? 'active' : ''} ${inWorkspace ? 'secondary' : ''} ${tabPeople.length ? 'has-presence' : ''}`} onClick={() => selectChapter(tabId)} onContextMenu={(event) => openContextMenu(event, [
              { label: 'Open chapter', icon: 'fa-regular fa-file-lines', onClick: () => selectChapter(tabId) },
              { label: inWorkspace ? 'Remove from split view' : 'Open in split view', icon: 'fa-solid fa-table-columns', disabled: tabId === currentIdRef.current, onClick: () => inWorkspace ? removeWorkspacePane(tabId) : openInSplit(tabId) },
              { label: 'Copy chapter link', icon: 'fa-solid fa-link', onClick: () => navigator.clipboard?.writeText(`${window.location.origin}/novel/${id}?chapter=${tabId}`) },
              'divider',
              { label: 'Close tab', icon: 'fa-solid fa-xmark', onClick: () => closeChapterTab(tabId) },
              { label: 'Close other tabs', icon: 'fa-solid fa-table-columns', disabled: openChapterTabs.length < 2, onClick: () => { setOpenChapterTabs([tabId]); setWorkspacePaneIds((current) => current.filter((item) => item === tabId)) } },
            ])} draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', tabId); event.dataTransfer.effectAllowed = 'move' }}><Icon icon="fa-regular fa-file-lines" /><span>{tabChapter.title || 'Untitled chapter'}</span>{tabPeople.length > 0 && <span className="chapter-tab-presence" aria-label={`${tabPeople.length} collaborator${tabPeople.length === 1 ? '' : 's'} in this chapter`} title={tabPeople.map((person) => `${person.username} · ${person.activity === 'writing' ? 'writing' : 'viewing'} · ${person.tabName || 'This chapter'}`).join('\n')}>{tabPeople.slice(0, 3).map((person) => <span key={person.id} className={`chapter-tab-presence-dot ${person.activity === 'writing' ? 'is-writing' : 'is-viewing'}`} style={{ ['--presence-color' as any]: presenceColor(person.id) } as CSSProperties} />)}{tabPeople.length > 3 && <b>+{tabPeople.length - 3}</b>}</span>}<i role="button" aria-label="Close tab" onClick={(event) => { event.stopPropagation(); closeChapterTab(tabId) }}><Icon icon="fa-solid fa-xmark" /></i></button>
          })}
          <button className={`button button-quiet chapter-split-toggle ${splitOpen ? 'active' : ''}`} onClick={toggleSplitView} title={splitOpen ? 'Close split view' : 'Open split view'}>
            <Icon icon="fa-solid fa-table-columns" />
            {splitOpen ? 'Single pane' : 'Split view'}
          </button>
          <span className="chapter-tab-limit">{openChapterTabs.length}/{MAX_OPEN_TABS}</span>
        </div>}

        <Suspense fallback={<div className="workspace-loading">Loading workspace…</div>}>
        {activeSection === 'planning' ? (
          <div className="mode-body"><PlanningCockpit novelId={id} embedded /></div>
        ) : activeSection === 'files' ? (
          <div className="mode-body"><ProjectFiles novelId={id} embedded /></div>
        ) : activeSection === 'design' ? (
          <div className="mode-body">
            <BookDesigner novelId={id} embedded />
          </div>
        ) : activeSection === 'media' ? (
          <div className="mode-body"><MediaLibrary novelId={id} embedded /></div>
          ) : activeSection === 'analytics' ? (
          <div className="mode-body">
            <Analytics embedded />
          </div>
        ) : BINDER_SECTIONS.includes(activeSection) ? (
          <div className="mode-body">
            {activeSection === 'characters' && <Characters novelId={id} embedded />}
            {activeSection === 'entities' && <Entities novelId={id} embedded />}
            {activeSection === 'relationships' && <Relationships novelId={id} embedded />}
            {activeSection === 'family-tree' && <FamilyTree novelId={id} embedded />}
            {activeSection === 'world' && <World novelId={id} embedded />}
            {activeSection === 'glossary' && <Glossary novelId={id} embedded />}
            {activeSection === 'moodboard' && <Moodboard novelId={id} embedded />}
            {activeSection === 'trash' && <Trash novelId={id} embedded />}
          </div>
        ) : activeSection === 'story-memory' ? (
          <div className="mode-body story-memory-mode"><StoryMemory novelId={id} embedded /></div>
        ) : activeSection === 'prose-tools' ? (
          <div className="mode-body prose-tools-mode"><ProseTools novelId={id} embedded /></div>
        ) : JOURNAL_SECTIONS.includes(activeSection) ? (
          <div className="mode-body">
            {activeSection === 'corkboard' && <Corkboard novelId={id} embedded />}
            {activeSection === 'timeline' && <Timeline novelId={id} embedded />}
            {activeSection === 'continuity' && <Continuity novelId={id} embedded />}
            {activeSection === 'milestones' && <Milestones novelId={id} embedded />}
            {activeSection === 'writing-journal' && <WritingJournal novelId={id} />}
            {activeSection === 'versions' && <ArchiveHub novelId={id} chapters={chapters} onBranchRestored={async () => { const refreshed = await listChapters(id); setChapters(refreshed); if (chapter?.id) setChapter(refreshed.find((item) => item.id === chapter.id) || refreshed[0] || null); toast('Manuscript branch restored.') }} onOpenHistory={async (chapterId) => { await selectChapter(chapterId); setHistoryOpen(true) }} />}
          </div>
        ) : !chapter ? (
          <div className="page">
            <div className="empty">
              <div className="empty-icon"><Icon icon="fa-solid fa-pen-nib" /></div>
              <h3>A fresh page</h3>
              <p>Every novel begins with a first chapter. Let’s make yours.</p>
              <button className="button button-primary" onClick={() => addChapter('')}>Add the first chapter</button>
            </div>
          </div>
        ) : reading ? (
          <div className="page" style={{ maxWidth: 720 }}>
            <div className="editor-canvas" style={{ maxWidth: 'none' }}>
              <div className="editor-head">
                <div className="chapter-edit-title" style={{ borderBottom: 'none', fontSize: '2rem' }}>{titleFor(chapter, computeNumbers(chapters))}</div>
              </div>
              {hasProse ? (
                <ProsePreview
                  html={chapter.content}
                  characters={characters}
                  terms={terms}
                  relationships={relationships}
                  mentionsMap={mentionsMap}
                  onOpenCharacter={() => openSection('characters')}
                  onOpenTerm={() => openSection('glossary')}
                />
              ) : (
                <p className="muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>
                  Nothing written yet — the page is waiting.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="scene-meta" aria-label="Scene context">
              <div className="scene-meta-header">
                <span className="scene-meta-label">Scene context</span>
              </div>
              <label className="scene-meta-field">
                <span>POV</span>
                <select
                  value={metaDraft.pov || ''}
                  onChange={(e) => {
                    const next = { ...metaDraft, pov: e.target.value }
                    setMetaDraft(next)
                    commitMeta(next)
                  }}
                >
                  <option value="">—</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="scene-meta-field">
                <span>Where</span>
                <input
                  value={metaDraft.location || ''}
                  onChange={(e) => {
                    const next = { ...metaDraft, location: e.target.value }
                    setMetaDraft(next)
                    commitMeta(next)
                  }}
                  placeholder="The lighthouse"
                />
              </label>
              <label className="scene-meta-field">
                <span>Time</span>
                <select
                  value={metaDraft.timeOfDay || ''}
                  onChange={(e) => {
                    const next = { ...metaDraft, timeOfDay: e.target.value }
                    setMetaDraft(next)
                    commitMeta(next)
                  }}
                >
                  <option value="">—</option>
                  {TIME_OF_DAY.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="scene-meta-field">
                <span>Tone</span>
                <input
                  value={metaDraft.tone || ''}
                  onChange={(e) => {
                    const next = { ...metaDraft, tone: e.target.value }
                    setMetaDraft(next)
                    commitMeta(next)
                  }}
                  placeholder="Hushed"
                />
              </label>
              <label className="scene-meta-field scene-meta-beat">
                <span>Beat</span>
                <input
                  value={metaDraft.beat || ''}
                  onChange={(e) => {
                    const next = { ...metaDraft, beat: e.target.value }
                    setMetaDraft(next)
                    commitMeta(next)
                  }}
                  placeholder="The letter is opened"
                />
              </label>
            </div>

            <div className={`editor-host ${splitOpen && workspacePanes.length ? 'editor-host-split' : ''}`}>
              <div className={`split-view ${splitOpen && workspacePanes.length ? 'active' : ''}`} style={splitOpen && workspacePanes.length ? ({ ['--pane-count' as any]: 1 + workspacePanes.length } as CSSProperties) : undefined}>
                <div
                  className="split-editor split-editor-primary"
                  onWheel={(e) => {
                    const target = e.target as HTMLElement | null
                    if (
                      target?.closest('.editor-wrap') ||
                      target?.closest('.cselect') ||
                      target?.closest('.cselect-pop') ||
                      target?.closest('select') ||
                      target?.closest('input') ||
                      target?.closest('textarea')
                    ) return
                    const wrap = e.currentTarget.querySelector('.editor-wrap')
                    if (wrap) wrap.scrollTop += e.deltaY
                  }}
                  onContextMenu={(e) => {
                    const sel = window.getSelection()
                    if (sel && sel.toString().length > 0) return
                    e.preventDefault()
                    openContextMenu(e, [
                      { label: 'Add comment', icon: 'fa-regular fa-comment', onClick: () => { setCommentDraft({ quote: '', comment: '', type: 'note' }); setAnnotationsOpen(true) } },
                      { label: 'Add milestone snapshot', icon: 'fa-solid fa-flag', onClick: () => saveMilestone('Manual snapshot') },
                      'divider',
                      { label: 'Open another chapter in split view', icon: 'fa-solid fa-table-columns', onClick: () => toggleSplitView() },
                      { label: 'Tidy formatting', icon: 'fa-solid fa-wand-magic-sparkles', onClick: () => handleTidy(chapter) },
                      { label: 'View history', icon: 'fa-solid fa-clock-rotate-left', onClick: () => setHistoryOpen(true) },
                      { label: 'Writing replay', icon: 'fa-solid fa-play', onClick: () => setReplayOpen(true) },
                      'divider',
                      { label: 'Focus mode', icon: focusMode ? 'fa-solid fa-expand' : 'fa-solid fa-compress', onClick: () => setFocusMode(!focusMode) },
                      { label: 'Read mode', icon: 'fa-regular fa-eye', onClick: () => setReading(true) },
                    ])
                  }}
                >
                  <Editor
                    key={`${chapter.id}-${restoreTick}`}
                    initialHtml={chapter.content}
                    onReport={handleReport}
                    onEditorFocus={() => { isEditorFocusedRef.current = true }}
                    onEditorBlur={() => { isEditorFocusedRef.current = false }}
                    title={titleDraft}
                    onTitleChange={setTitleDraft}
                    onTitleBlur={commitTitle}
                    onComment={onComment}
                    annotations={annotations}
                    onCommentHover={revealComment}
                    typewriterMode={settings.typewriterMode}
                    onSave={saveNow}
                    readOnly={!canEditSharedNovel}
                    spellCheck={settings.spellCheck !== false}
                    autoCorrect={settings.autoCorrect !== false}
                    characters={characters}
                    terms={terms}
                    entities={entities}
                    collaborators={collaboratorPresence}
                    canEdit={canEditSharedNovel}
                    chapterId={chapter.id}
                    novelId={id}
                    placeholder="The first sentence is the hardest. Start anywhere."
                    onDesigns={() => setDesignsOpen((o) => !o)}
                    onApplyDesign={applyEditorDesign}
                    onLineSpacingChange={(spacing) => {
                      const WPP_MAP = { '1.0': 500, '1.15': 430, '1.5': 333, '2.0': 250 }
                      setLineSpacingWpp(WPP_MAP[spacing] || 333)
                    }}
                    pageLayout={novel.layout || {}}
                    typography={novel.typography || {}}
                    onTypographyChange={(patch) => {
                      const typography = { ...(novelRef.current?.typography || {}), ...patch }
                      novelRef.current = { ...novelRef.current, typography }
                      setNovel((current) => current ? { ...current, typography } : current)
                      updateNovel(id, { typography })
                    }}
                    onPageLayoutChange={(patch) => {
                      const layout = { ...(novelRef.current?.layout || {}), ...patch }
                      novelRef.current = { ...novelRef.current, layout }
                      setNovel((current) => current ? { ...current, layout } : current)
                      updateNovel(id, { layout })
                    }}
                  />
                </div>

                {splitOpen && workspacePanes.map((paneChapter, paneIndex) => (
                  <SecondarySplitEditor
                    key={`${paneChapter.id}-${restoreTick}`}
                    chapter={paneChapter}
                    paneIndex={paneIndex}
                    novelId={id}
                    sharedRole={novel?.sharedRole}
                    layout={novel.layout || {}}
                    settings={settings}
                    characters={characters}
                    terms={terms}
                    entities={entities}
                    collaborators={collaboratorPresence}
                    onPatch={patchChapterLocal}
                    onPromote={() => promoteWorkspacePane(paneChapter.id)}
                    onClose={() => removeWorkspacePane(paneChapter.id)}
                    toast={toast}
                  />
                ))}
              </div>
            </div>

            <div className="editor-footer">
              <div className="editor-footer-metrics">
                <span className="stat editor-footer-primary"><b>{formatWords(wordCount)}</b> words</span>
                <span className="stat">+<b>{formatWords(sessionWords)}</b> this session</span>
                <span className="stat" title="Elapsed writing session"><Icon icon="fa-regular fa-clock" /> <b>{sessionClock}</b></span>
                <button className="button button-quiet editor-footer-pause" onClick={toggleSessionPause} title={sessionPaused ? 'Resume writing session' : 'Pause writing session'}><Icon icon={sessionPaused ? 'fa-solid fa-play' : 'fa-solid fa-pause'} /> {sessionPaused ? 'Resume' : 'Pause'}</button>
                {wordCount > 0 && <span className="stat" title={`~${lineSpacingWpp} words per page at current spacing`}>~<b>{Math.ceil(wordCount / lineSpacingWpp)}</b> {Math.ceil(wordCount / lineSpacingWpp) === 1 ? 'page' : 'pages'}</span>}
                {sessionWpm !== null && <span className="stat">~<b>{sessionWpm}</b> wpm</span>}
              </div>
              <div className="editor-footer-goal">
                <span className="goal-track" title="Daily goal"><span className="bar"><span style={{ width: `${goalPct}%` }} className={goalPct >= 100 ? 'done' : ''} /></span><span className="stat"><b>{formatWords(todayW)}</b>/{formatWords(goalWords)} today</span></span>
                {!editingGoal ? <button className="button button-quiet" onClick={() => setEditingGoal(true)} title="Change daily goal"><Icon icon="fa-solid fa-pen" /></button> : <span className="actions-row"><select value={goalWords} onChange={(e) => setGoalWords(Number(e.target.value))} autoFocus>{GOAL_PRESETS.map((g) => <option key={g} value={g}>{g} words</option>)}<option value={0}>no goal</option></select><button className="button button-quiet" onClick={commitGoal}><Icon icon="fa-solid fa-check" /></button></span>}
              </div>
              <div className="editor-footer-actions">
                <span className="saved-indicator">{dirty ? <><span className="dot" style={{ background: 'var(--rose)' }} /> <span role="status" aria-live="polite">Saving locally…</span></> : <><span className="dot" /> <span role="status" aria-live="polite">Saved locally {savedAt ? timeAgo(savedAt) : ''}</span></>}</span>
                <button className="button button-quiet" onClick={() => saveNowRef.current?.()} title="Save now (Ctrl+S)"><Icon icon="fa-regular fa-floppy-disk" /> Save</button>
                {chapter.versions?.length > 0 && <button className="button button-quiet" onClick={() => setHistoryOpen(true)}>History ({chapter.versions.length})</button>}
                <button className="button button-quiet" onClick={() => setDesignsOpen((o) => !o)} title="Premade manuscript designs"><Icon icon="fa-solid fa-palette" /> <span>Designs</span></button>
                <button className="button button-quiet" onClick={() => setReplayOpen((o) => !o)} title="Writing Time Machine — scrub through what you typed this session"><Icon icon="fa-solid fa-clock-rotate-left" /> <span>Replay</span></button>
                <button className="button button-quiet" onClick={() => { setCommentDraft(null); setAnnotationsOpen((o) => !o) }} title="Private comments on this chapter"><Icon icon="fa-regular fa-comment" /> <span>Comments{annotations.filter((a) => !a.resolved).length > 0 ? ` (${annotations.filter((a) => !a.resolved).length})` : ''}</span></button>
                <button className="button button-quiet" onClick={() => setMergeSource(chapter)} title="Merge this chapter with another"><Icon icon="fa-solid fa-object-ungroup" /> <span>Merge</span></button>
              </div>
            </div>

            {designsOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 44 }} onClick={() => setDesignsOpen(false)} />
                <div className="editor-designs" onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                    <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem' }}>Designs</strong>
                    <button className="button button-quiet" onClick={() => setDesignsOpen(false)}><Icon icon="fa-solid fa-xmark" /></button>
                  </div>
                  <DesignPalette compact activeId={editorDesign} onPick={applyEditorDesign} />
                  <p className="small muted" style={{ margin: '10px 0 0' }}>
                    Click to apply, or drag onto the page.
                  </p>
                  <div style={{ marginTop: 'var(--space-3)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-2)' }}>Custom colour</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--grey)' }}>
                        <span>Page</span>
                        <input type="color" value={customDesignBg} className="tb-custom-color"
                          onChange={(e) => { const next = e.target.value; setCustomDesignBg(next); updateNovel(id, { layout: { ...(novelRef.current?.layout || {}), editorDesign: 'custom', customPageBg: next, customPageText: customDesignText } }) }} style={{ width: 28, height: 24 }} />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--grey)' }}>
                        <span>Text</span>
                        <input type="color" value={customDesignText} className="tb-custom-color"
                          onChange={(e) => { const next = e.target.value; setCustomDesignText(next); updateNovel(id, { layout: { ...(novelRef.current?.layout || {}), editorDesign: 'custom', customPageBg: customDesignBg, customPageText: next } }) }} style={{ width: 28, height: 24 }} />
                      </label>
                      <button className="button button-primary" style={{ fontSize: '0.78rem', padding: '4px 12px' }}
                        onClick={() => { applyEditorDesign('custom'); toast('Custom colours applied.') }}>
                        Apply
                      </button>
                      {editorDesign && (
                        <button className="button button-quiet" style={{ fontSize: '0.78rem' }}
                          onClick={() => { setEditorDesign(null); updateNovel(id, { layout: { ...(novelRef.current?.layout || {}), editorDesign: null } }); setDesignsOpen(false); toast('Design cleared.') }}>
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
        </Suspense>
      </div>

      <ChapterEditModal chapter={editChapter} onChange={setEditChapter} onClose={() => setEditChapter(null)} onSave={saveChapterEdit} />
      <MergeModal source={mergeSource} chapters={chapters} onClose={() => setMergeSource(null)} onMerge={handleMerge} />
      <ConfirmDialog open={!!deleteChapterTarget} onClose={() => setDeleteChapterTarget(null)} onConfirm={handleTrashChapter} title="Move this chapter to the Trash?">
        “{deleteChapterTarget?.title || 'Untitled'}” will wait in the Trash for 30 days. Its words stay with you — restore it any time.
      </ConfirmDialog>
      {annotationsOpen && activeSection === 'write' && chapter && (
        <AnnotationsPanel
          annotations={annotations}
          draft={commentDraft}
          activeId={activeAnnotationId}
          onDraftChange={setCommentDraft}
          onSaveDraft={saveComment}
          onCancelDraft={() => setCommentDraft(null)}
          onResolve={resolveAnnotation}
          onDelete={removeAnnotation}
          onClose={() => { setAnnotationsOpen(false); setCommentDraft(null); setActiveAnnotationId(null) }}
        />
      )}

      {replayOpen && activeSection === 'write' && chapter && (
        <SessionReplay
          chapterId={chapter.id}
          sessionStart={sessionStartAtRef.current}
          onClose={() => setReplayOpen(false)}
        />
      )}

      <AuthModal open={connectOpen} onClose={() => setConnectOpen(false)} />
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        novel={novel}
        chapters={chapters}
        toast={toast}
        importMdRef={importMdRef}
        importRtfRef={importRtfRef}
      />
      <ShareWritingModal open={shareOpen} onClose={() => setShareOpen(false)} novelId={id} novelTitle={novel?.title} toast={toast} />
      <HistoryModal chapter={chapter} open={historyOpen} onClose={() => setHistoryOpen(false)} onMilestone={saveMilestone} onRestore={(v) => {
        if (!chapter) return
        contentRef.current = v.html
        setChapter((prev) => (prev ? { ...prev, content: v.html, wordCount: v.words } : prev))
        setWordCount(v.words)
        setRestoreTick((t) => t + 1)
        scheduleSave()
        setHistoryOpen(false)
        toast('Brought back a previous version.')
      }} />
      <nav className="mobile-workspace-nav" aria-label="Mobile workspace navigation">
        <button type="button" className={activeSection === 'write' ? 'active' : ''} onClick={() => navigate(`/novel/${id}`)}>
          <Icon icon="fa-solid fa-pen-nib" /><span>Write</span>
        </button>
        <button type="button" onClick={() => navigate('/dashboard')}>
          <Icon icon="fa-solid fa-books" /><span>Library</span>
        </button>
        <button type="button" className="mobile-workspace-nav-primary" onClick={() => { navigate(`/novel/${id}`); setFocusMode(true) }}>
          <Icon icon="fa-solid fa-feather-pointed" /><span>Focus</span>
        </button>
        <button type="button" className={activeSection === 'writing-journal' ? 'active' : ''} onClick={() => navigate(`/novel/${id}/writing-journal`)}>
          <Icon icon="fa-solid fa-book-open" /><span>Journal</span>
        </button>
        <button type="button" onClick={() => setSidebarOpen(true)}>
          <Icon icon="fa-solid fa-ellipsis" /><span>More</span>
        </button>
      </nav>
    </div>
  )
}

function ChapterEditModal({ chapter, onChange, onClose, onSave }) {
  const [tab, setTab] = useState('overview')
  const kinds = [
    ['book', 'Book'],
    ['part', 'Part'],
    ['act', 'Act'],
    ['prologue', 'Prologue'],
    ['chapter', 'Chapter'],
    ['epilogue', 'Epilogue'],
    ['subchapter', 'Subchapter']
  ]
  return (
      <Modal open={!!chapter} onClose={onClose} title="Chapter settings" width={680} className="folder-settings-modal">
      {chapter && (
        <>
          <nav className="folder-settings-tabs" aria-label="Chapter settings sections">
            {[['overview', 'Overview', 'fa-solid fa-feather-pointed'], ['appearance', 'Appearance', 'fa-solid fa-palette'], ['details', 'Details', 'fa-solid fa-sliders']].map(([value, label, icon]) => <button key={value} type="button" className={tab === value ? 'active' : ''} onClick={() => setTab(value)}><Icon icon={icon} /><span>{label}</span></button>)}
          </nav>
          <div className="folder-settings-panel">
          {tab === 'overview' && <>
            <div className="folder-settings-intro"><span>MANUSCRIPT NODE</span><strong>Shape how this item appears in your book.</strong></div>
            <div className="field">
              <label>Title <span className="hint">(blank uses the derived name)</span></label>
              <input value={chapter.title || ''} onChange={(e) => onChange({ ...chapter, title: e.target.value })} />
            </div>
            <div className="field">
              <label>Kind</label>
              <Select ariaLabel="Chapter kind" width="100%" value={chapter.kind || 'chapter'} onChange={(value) => onChange({ ...chapter, kind: value })} options={kinds.map(([value, label]) => ({ value, label }))} />
              <p className="small muted">Books, parts and acts become outline headers; chapters are numbered, and subchapters nest beneath chapters.</p>
            </div>
          </>}
          {['book', 'part', 'act'].includes(chapter.kind) && <>
          {tab === 'appearance' && <>
            <div className="field">
              <label>Folder icon</label>
              <Select ariaLabel="Folder icon" width="100%" value={chapter.icon || ''} onChange={(value) => onChange({ ...chapter, icon: value || null })} options={[['', 'Automatic'], ['fa-solid fa-folder', 'Folder'], ['fa-solid fa-folder-open', 'Open folder'], ['fa-solid fa-book', 'Book'], ['fa-solid fa-layer-group', 'Layers'], ['fa-solid fa-box-archive', 'Archive'], ['fa-solid fa-star', 'Starred'], ['fa-solid fa-moon', 'Moon'], ['fa-solid fa-feather-pointed', 'Writing']].map(([value, label]) => ({ value, label }))} />
            </div>
            <div className="field" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ flex: 1 }}>Folder colour<input className="folder-color-input" type="color" value={chapter.color || '#c79b53'} onChange={(e) => onChange({ ...chapter, color: e.target.value })} /></label>
              <label style={{ flex: 1 }}>Theme<Select ariaLabel="Folder theme" width="100%" value={chapter.folderTheme || 'plain'} onChange={(value) => onChange({ ...chapter, folderTheme: value })} options={[{ value: 'plain', label: 'Plain' }, { value: 'soft', label: 'Soft tint' }, { value: 'outline', label: 'Outline' }, { value: 'glow', label: 'Glow' }]} /></label>
            </div>
          </>}
          </>}
          {tab === 'details' && <>
          <div className="field">
            <label>Part / volume</label>
            <input value={chapter.part || ''} onChange={(e) => onChange({ ...chapter, part: e.target.value })} placeholder="Legacy part label — mostly unused now" />
          </div>
          <div className="field">
            <label>Status</label>
            <Select ariaLabel="Chapter status" width="100%" value={chapter.status || 'draft'} onChange={(value) => onChange({ ...chapter, status: value })} options={[{ value: 'draft', label: 'Draft' }, { value: 'revised', label: 'Revised' }, { value: 'final', label: 'Final' }]} />
          </div>
          </>}
          </div>
          <div className="modal-foot">
            <button className="button button-ghost" onClick={onClose}>Cancel</button>
            <button className="button button-primary" onClick={onSave}>Save</button>
          </div>
        </>
      )}
    </Modal>
  )
}

function SecondarySplitEditor({
  chapter,
  paneIndex = 0,
  novelId,
  sharedRole,
  layout,
  settings,
  characters,
  terms,
  entities,
  collaborators = [],
  canEdit = true,
  onPatch,
  onPromote,
  onClose,
  toast,
}) {
  const [titleDraft, setTitleDraft] = useState(chapter?.title || '')
  const [wordCount, setWordCount] = useState(chapter?.wordCount || 0)
  const [restoreTick, setRestoreTick] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState(chapter?.updatedAt || null)
  const contentRef = useRef(chapter?.content || '')
  const revisionRef = useRef(0)
  const savedRevisionRef = useRef(0)
  const timerRef = useRef(null)
  const liveTimerRef = useRef(null)

  useEffect(() => {
    setTitleDraft(chapter?.title || '')
    setWordCount(chapter?.wordCount || 0)
    setSavedAt(chapter?.updatedAt || null)
    setDirty(false)
    setRestoreTick((tick) => tick + 1)
    contentRef.current = chapter?.content || ''
    revisionRef.current = 0
    savedRevisionRef.current = 0
    clearTimeout(timerRef.current)
  // `onPatch` updates the parent chapter after every save. Do not treat that
  // normal acknowledgement as a new document: resetting the editor here
  // remounts it, which reports its content again and starts a save loop in the
  // secondary split pane. A new chapter is the only change that needs a reset.
  // This reset intentionally runs only when switching chapters; save acknowledgements must not remount the editor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter?.id])

  useEffect(() => () => { clearTimeout(timerRef.current); clearTimeout(liveTimerRef.current) }, [])

  const saveContent = useCallback(async () => {
    if (!chapter?.id) return
    if (revisionRef.current <= savedRevisionRef.current) return
    const nextHtml = contentRef.current
    const nextWords = countWords(nextHtml)
    const updatedAt = Date.now()
    await updateChapter(chapter.id, {
      content: nextHtml,
      wordCount: nextWords,
      updatedAt,
    }, { sync: !sharedRole })
    savedRevisionRef.current = revisionRef.current
    onPatch(chapter.id, { content: nextHtml, wordCount: nextWords, updatedAt })
    setSavedAt(updatedAt)
    setDirty(false)
  }, [chapter?.id, onPatch, sharedRole])

  const scheduleSave = useCallback(() => {
    setDirty(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      saveContent()
    }, Number(settings.autosaveDelay) || 1800)
  }, [saveContent, settings.autosaveDelay])

  const handleReport = useCallback((html, words) => {
    if (!canEdit) return
    revisionRef.current += 1
    contentRef.current = html
    setWordCount(words)
    clearTimeout(liveTimerRef.current)
    liveTimerRef.current = setTimeout(() => {
      const updatedAt = Date.now()
      publishLiveRecord({
        store: 'chapters', id: chapter.id, novelId, updatedAt, deleted: false,
        payload: { ...chapter, content: html, wordCount: words, updatedAt }
      })
    }, 120)
    scheduleSave()
  }, [scheduleSave, canEdit, chapter, novelId])

  const commitTitle = useCallback(async () => {
    if (!chapter?.id) return
    const nextTitle = titleDraft.trim() || 'Untitled chapter'
    if (nextTitle === (chapter.title || '')) return
    await updateChapter(chapter.id, { title: nextTitle, updatedAt: Date.now() })
    onPatch(chapter.id, { title: nextTitle, updatedAt: Date.now() })
    setTitleDraft(nextTitle)
    toast?.('Split chapter title updated.')
  }, [chapter?.id, chapter?.title, onPatch, titleDraft, toast])

  return (
    <div className="split-editor split-editor-secondary">
      <div className="split-pane-topbar">
        <div className="split-pane-copy">
          <span className="split-pane-eyebrow">Workspace pane {paneIndex + 2}</span>
          <strong>{chapter?.title || 'Untitled chapter'}</strong>
        </div>
        <div className="split-pane-actions">
          <button className="button button-quiet" onClick={onPromote} title="Make this the main chapter">
            <Icon icon="fa-solid fa-arrow-up-right-from-square" /> Main
          </button>
          <button className="button button-quiet" onClick={async () => { await saveContent(); onClose() }} title="Close split view">
            <Icon icon="fa-solid fa-xmark" />
          </button>
        </div>
      </div>

      <div
        className="split-editor-body"
        onWheel={(e) => {
          const target = e.target as HTMLElement | null
          if (
            target?.closest('.editor-wrap') ||
            target?.closest('.cselect') ||
            target?.closest('.cselect-pop') ||
            target?.closest('select') ||
            target?.closest('input') ||
            target?.closest('textarea')
          ) return
          const wrap = e.currentTarget.querySelector('.editor-wrap')
          if (wrap) wrap.scrollTop += e.deltaY
        }}
      >
        <Editor
          key={`${chapter.id}-${restoreTick}`}
          initialHtml={chapter.content}
          onReport={handleReport}
          title={titleDraft}
          onTitleChange={setTitleDraft}
          onTitleBlur={commitTitle}
          onComment={undefined}
          onCommentHover={undefined}
          typewriterMode={settings.typewriterMode}
          onSave={saveContent}
          readOnly={!canEdit}
          spellCheck={settings.spellCheck !== false}
          autoCorrect={settings.autoCorrect !== false}
          characters={characters}
          terms={terms}
          entities={entities}
          collaborators={collaborators}
          canEdit={canEdit}
          chapterId={chapter.id}
          placeholder="Open another chapter and keep both threads moving."
          onDesigns={undefined}
          onLineSpacingChange={undefined}
          pageLayout={layout}
          onPageLayoutChange={() => {}}
        />
      </div>

      <div className="split-pane-footer">
        <span className="stat"><b>{formatWords(wordCount)}</b> words</span>
        <span className="saved-indicator">
          {dirty ? <><span className="dot" style={{ background: 'var(--rose)' }} /> saving…</> : <><span className="dot" /> saved {timeAgo(savedAt)}</>}
        </span>
        <button className="button button-quiet" onClick={saveContent}>
          <Icon icon="fa-regular fa-floppy-disk" /> Save
        </button>
      </div>
    </div>
  )
}

function HistoryModal({ chapter, open, onClose, onRestore, onMilestone }) {
  const [compare, setCompare] = useState(null)

  useEffect(() => {
    if (!open) setCompare(null)
  }, [open])

  const nameMilestone = () => {
    const label = window.prompt('Name this milestone (e.g. “End of Act 1”, “Beta draft”)')
    if (label && label.trim()) onMilestone?.(label.trim())
  }

  const currentText = htmlToPlain(chapter?.content || '')

  return (
    <Modal open={open} onClose={onClose} title="Version history" width={compare ? 760 : 480}>
      {compare ? (
        <>
          <button className="button button-quiet" onClick={() => setCompare(null)} style={{ marginBottom: 'var(--space-3)' }}>
            <Icon icon="fa-solid fa-arrow-left" style={{ marginRight: 6 }} /> Back to history
          </button>
          <SentenceComparison before={htmlToPlain(compare.html)} after={currentText} beforeLabel={compare.label ? compare.label : timeAgo(compare.at)} beforeWords={compare.words} afterWords={countWords(chapter?.content || '')} />
          <div className="modal-foot">
            <button className="button button-ghost" onClick={() => setCompare(null)}>Cancel</button>
            <button className="button button-primary" onClick={() => onRestore(compare)}>Restore this version</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 0, marginBottom: 'var(--space-3)' }}>
            <p className="small muted" style={{ margin: 0, flex: 1 }}>
              Snapshots save themselves as you write. Name a milestone to keep it forever.
            </p>
            <button className="button button-ghost" style={{ flex: 'none' }} onClick={nameMilestone}>
              <Icon icon="fa-solid fa-flag" style={{ marginRight: 6 }} /> Milestone
            </button>
          </div>
          {chapter?.versions?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...chapter.versions].reverse().map((v, i) => (
                <div key={v.at + i} className={`version-row ${v.label ? 'milestone' : ''}`}>
                  <span className="version-node" />
                  <span style={{ flex: 1, color: 'var(--charcoal)', fontSize: '0.88rem' }}>
                    {v.label && <b className="version-label"><Icon icon="fa-solid fa-flag" /> {v.label}</b>}
                    <span style={{ color: v.label ? 'var(--grey)' : 'var(--charcoal)' }}>
                      {timeAgo(v.at)} · <b>{formatWords(v.words)}</b> words
                    </span>
                  </span>
                  <button className="button button-quiet" style={{ padding: '5px 10px', fontSize: '0.78rem' }} onClick={() => setCompare(v)}>
                    Compare
                  </button>
                  <button className="button button-ghost" style={{ padding: '5px 12px', fontSize: '0.8rem' }} onClick={() => onRestore(v)}>
                    Restore
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No saved versions yet — keep writing.</p>
          )}
        </>
      )}
    </Modal>
  )
}

function SentenceComparison({ before, after, beforeLabel, beforeWords, afterWords }) {
  const changes = sentenceDiff(before, after)
  const removed = changes.filter((item) => item.type === 'removed').length
  const added = changes.filter((item) => item.type === 'added').length
  return <><div className="version-diff-summary" aria-live="polite"><span><i className="diff-dot removed"/> {removed} removed</span><span><i className="diff-dot added"/> {added} added</span><small>Sentence-level comparison</small></div><div className="version-compare"><div className="version-col"><div className="version-col-head">This version <span>{beforeLabel} · {formatWords(beforeWords)} w</span></div><div className="version-col-body sentence-diff">{changes.filter((item) => item.type !== 'added').map((item, index) => <span key={`${item.type}-${index}`} className={`diff-sentence ${item.type}`}>{item.text}</span>)}</div></div><div className="version-col"><div className="version-col-head">Now <span>{formatWords(afterWords)} w</span></div><div className="version-col-body sentence-diff">{changes.filter((item) => item.type !== 'removed').map((item, index) => <span key={`${item.type}-${index}`} className={`diff-sentence ${item.type}`}>{item.text}</span>)}</div></div></div></>
}

function htmlToPlain(html) {
  return String(html || '')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function presenceColor(seed) {
  const palette = ['#7db6f4', '#d99b75', '#9ecb9d', '#c39adf', '#e2bb72', '#7fc8c0']
  const value = String(seed || '').split('').reduce((total, char) => total + char.charCodeAt(0), 0)
  return palette[value % palette.length]
}
