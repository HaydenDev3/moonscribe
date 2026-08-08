import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getNovel, updateNovel } from '../db/novels'
import { listChapters, updateChapter, createChapter, deleteChapter, moveChapter, mergeChapters, tidyChapter, reorderChapter } from '../db/chapters'
import { listCharacters } from '../db/characters'
import { todayWords, addTodayWords, recordSession } from '../db/stats'
import { useApp } from '../context/AppContext'
import Editor from '../components/Editor'
import Sidebar from '../components/Sidebar'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import AuthModal from '../components/AuthModal'
import MergeModal from '../components/MergeModal'
import { countWords, formatWords } from '../utils/words'
import { htmlToMarkdown } from '../utils/htmlToMarkdown'
import { htmlToText } from '../utils/htmlToText'
import { downloadText, safeName } from '../utils/download'
import { timeAgo } from '../utils/dates'
import { highlightNames } from '../utils/highlight'
import { computeNumbers, titleFor, isContainer } from '../utils/numbering'
import Icon from '../components/Icon'
import DesignPalette from '../components/DesignPalette'
import { designById, DESIGN_MIME } from '../designs/registry'
import Characters from './Characters'
import Notes from './Notes'
import Relationships from './Relationships'
import World from './World'
import Moodboard from './Moodboard'
import Analytics from './Analytics'
import BookDesigner from './BookDesigner'

const GOAL_PRESETS = [300, 500, 1000]

const BINDER_SECTIONS = ['characters', 'notes', 'relationships', 'world', 'moodboard']

const SECTION_LABELS = {
  characters: 'Characters',
  notes: 'Notes',
  relationships: 'Relationships',
  world: 'Worldbuilding',
  moodboard: 'Moodboard',
  design: 'Designer',
  analytics: 'Analytics'
}

export default function Novel() {
  const { id, mode, section } = useParams()
  const activeSection = section || mode || 'write'
  const { focusMode, setFocusMode, toast } = useApp()

  const [novel, setNovel] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [chapters, setChapters] = useState([])
  const [chapter, setChapter] = useState(null)
  const [wordCount, setWordCount] = useState(0)
  const [todayW, setTodayW] = useState(0)
  const [goalWords, setGoalWords] = useState(500)
  const [editingGoal, setEditingGoal] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [reading, setReading] = useState(false)
  const [restoreTick, setRestoreTick] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editChapter, setEditChapter] = useState(null)
  const [deleteChapterTarget, setDeleteChapterTarget] = useState(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [characters, setCharacters] = useState([])
  const [connectOpen, setConnectOpen] = useState(false)
  const [editorDesign, setEditorDesign] = useState(null)
  const [designsOpen, setDesignsOpen] = useState(false)
  const [designOver, setDesignOver] = useState(false)
  const [mergeSource, setMergeSource] = useState(null)

  // refs for save flow (avoid stale closures in debounce)
  const currentIdRef = useRef(null)
  const contentRef = useRef('')
  const chaptersRef = useRef([])
  const novelRef = useRef(null)
  const lastCountRef = useRef({})
  const sessionStartRef = useRef(0)
  const sessionStartAtRef = useRef(Date.now())
  const currentWordsRef = useRef(0)
  const saveTimer = useRef(null)
  const closeSessionRef = useRef(null)

  useEffect(() => {
    novelRef.current = novel
  }, [novel])
  useEffect(() => {
    chaptersRef.current = chapters
  }, [chapters])

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
      setGoalWords(n.goalWords || 500)
      setTodayW(await todayWords(id))
      setCharacters(await listCharacters(id))
      const first = chs.find((c) => c.id === n.lastChapterId) || chs[0]
      if (first) {
        currentIdRef.current = first.id
        contentRef.current = first.content || ''
        lastCountRef.current[first.id] = first.wordCount || 0
        sessionStartRef.current = first.wordCount || 0
        sessionStartAtRef.current = Date.now()
        currentWordsRef.current = first.wordCount || 0
        setChapter(first)
        setWordCount(first.wordCount || 0)
        setTitleDraft(first.title || '')
      }
    })()
    return () => {
      cancelled = true
      clearTimeout(saveTimer.current)
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

    const patch = { content: html, wordCount: words, updatedAt: now }
    const versions = ch.versions || []
    const last = versions[versions.length - 1]
    if (html && html !== ch.content && (!last || now - last.at > 90000)) {
      versions.push({ at: now, words, html })
      if (versions.length > 20) versions.shift()
      patch.versions = versions
    }

    await updateChapter(chId, patch)

    const prev = lastCountRef.current[chId]
    const delta = words - (prev === undefined ? ch.wordCount || 0 : prev)
    if (delta > 0) await addTodayWords(novelRef.current.id, delta)
    lastCountRef.current[chId] = words

    setChapters((prevChs) =>
      prevChs.map((c) => (c.id === chId ? { ...c, content: html, wordCount: words, updatedAt: now } : c))
    )
    setChapter((prev) => (prev && prev.id === chId ? { ...prev, content: html, wordCount: words } : prev))
    setTodayW(await todayWords(novelRef.current.id))
    setSavedAt(now)
    setDirty(false)
  }, [])

  saveNowRef.current = saveNow

  // ---- session pace tracking (per-device, never synced) ----
  const closeSession = useCallback(async () => {
    const chId = currentIdRef.current
    const n = novelRef.current
    if (!chId || !n) return
    const words = Math.max(0, currentWordsRef.current - sessionStartRef.current)
    const startedAt = sessionStartAtRef.current
    const endAt = Date.now()
    if (words > 0 && endAt - startedAt > 15000) {
      await recordSession(n.id, startedAt, endAt, words)
    }
  }, [])

  const resetSession = useCallback((wordCount) => {
    currentWordsRef.current = wordCount
    sessionStartRef.current = wordCount
    sessionStartAtRef.current = Date.now()
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
    setReading(false)
  }, [activeSection])

  useEffect(() => {
    return () => {
      clearTimeout(saveTimer.current)
      saveNowRef.current?.()
      closeSessionRef.current?.()
    }
  }, [])

  const scheduleSave = useCallback(() => {
    setDirty(true)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveNowRef.current()
    }, 600)
  }, [])

  const handleReport = useCallback(
    (html, words) => {
      contentRef.current = html
      currentWordsRef.current = words
      setWordCount(words)
      scheduleSave()
    },
    [scheduleSave]
  )

  const selectChapter = useCallback(async (chOrId) => {
    const chId = typeof chOrId === 'string' ? chOrId : chOrId.id
    if (chId === currentIdRef.current) return
    clearTimeout(saveTimer.current)
    await saveNowRef.current()
    await closeSessionRef.current()
    const ch = typeof chOrId === 'string' ? chaptersRef.current.find((c) => c.id === chId) : chOrId
    if (!ch) return
    currentIdRef.current = chId
    contentRef.current = ch.content || ''
    lastCountRef.current[chId] = ch.wordCount || 0
    resetSession(ch.wordCount || 0)
    setChapter(ch)
    setWordCount(ch.wordCount || 0)
    setTitleDraft(ch.title || '')
    setReading(false)
    setRestoreTick((t) => t + 1)
    setSavedAt(null)
    setDirty(false)
    setSidebarOpen(false)
    updateNovel(novelRef.current.id, { lastChapterId: chId, lastOpened: Date.now() }, { sync: false })
  }, [])

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
      const ch = await createChapter(id, { title: '', kind, parentId })
      const chs = await listChapters(id)
      setChapters(chs)
      selectChapter(ch)
    },
    [id, selectChapter]
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

  const handleDeleteChapter = useCallback(async () => {
    await deleteChapter(deleteChapterTarget.id)
    setDeleteChapterTarget(null)
    const chs = await listChapters(id)
    setChapters(chs)
    if (currentIdRef.current === deleteChapterTarget.id) {
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
    toast('Chapter set free.')
  }, [id, deleteChapterTarget, toast, resetSession])

  const saveChapterEdit = useCallback(async () => {
    if (!editChapter) return
    await updateChapter(editChapter.id, {
      title: editChapter.title?.trim() || '',
      part: editChapter.part,
      kind: editChapter.kind,
      parentId: editChapter.parentId || null,
      status: editChapter.status
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
    const d = designById(dId)
    if (!d) return
    setEditorDesign(d.id)
    updateNovel(id, { layout: { ...(novelRef.current?.layout || {}), editorDesign: d.id } })
    toast(`${d.name} across the page.`)
    setDesignsOpen(false)
  }, [id, toast])

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
        let md = `# ${n.title}\n\n*for Storm*\n\n`
        for (const c of display) {
          if (isContainer(c)) md += `\n# ${c.title}\n\n`
          md += `## ${c.title}\n\n${htmlToMarkdown(c.content)}\n\n`
        }
        downloadText(md, `${safeName(n.title)}.md`)
        toast('Markdown downloaded.')
      } else if (kind === 'txt') {
        let txt = `${n.title}\nfor Storm\n\n`
        for (const c of display) {
          txt += `\n${c.title}\n${'-'.repeat(Math.min(c.title.length, 30))}\n\n${htmlToText(c.content)}\n`
        }
        downloadText(txt, `${safeName(n.title)}.txt`)
        toast('Plain text downloaded.')
      } else if (kind === 'docx') {
        const { exportNovelDocx } = await import('../utils/exportDocx')
        await exportNovelDocx(n, display, n.layout || {})
        toast('Word document downloaded.')
      } else if (kind === 'print') {
        window.location.hash = `#/novel/${n.id}/design/print`
      }
    },
    [toast]
  )

  const totalWords = chapters.reduce((s, c) => s + (c.wordCount || 0), 0)
  const sessionWords = Math.max(0, wordCount - sessionStartRef.current)
  const sessionElapsed = Date.now() - sessionStartAtRef.current
  const sessionWpm = sessionElapsed > 30000 ? Math.round(sessionWords / (sessionElapsed / 60000)) : null
  const goalPct = goalWords > 0 ? Math.min(100, Math.round((todayW / goalWords) * 100)) : 0

  const previewHtml = chapter ? highlightNames(chapter.content, characters) : ''

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

  return (
    <div className={`workspace ${editorDesign ? `design-${editorDesign}` : ''} ${focusMode && activeSection === 'write' ? 'focus-mode' : ''}`}>
      <Sidebar
        novel={novel}
        totalWords={totalWords}
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
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSyncClick={() => setConnectOpen(true)}
      />

      <div
        className={`main ${activeSection === 'write' && designOver ? 'design-dropzone drag-over' : ''}`}
        {...(activeSection === 'write'
          ? {
              onDragOver: (e) => {
                if (e.dataTransfer.types.includes(DESIGN_MIME)) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                }
              },
              onDragEnter: (e) => {
                if (e.dataTransfer.types.includes(DESIGN_MIME)) setDesignOver(true)
              },
              onDragLeave: () => setDesignOver(false),
              onDrop: onDropDesign
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
              <button className="button button-ghost" onClick={() => setExportOpen((o) => !o)}><Icon icon="fa-solid fa-download" style={{ marginRight: 6 }} /> Export</button>
              {exportOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setExportOpen(false)} />
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'var(--surface-elev)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)', padding: 6, zIndex: 50, minWidth: 200 }}>
                    {[
                      ['markdown', 'Markdown (.md)'],
                      ['txt', 'Plain text (.txt)'],
                      ['docx', 'Word (.docx)'],
                      ['print', 'Print / PDF…']
                    ].map(([k, label]) => (
                      <button key={k} className="button button-quiet" style={{ width: '100%', textAlign: 'left', borderRadius: 8 }} onClick={() => runExport(k)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button className="button button-ghost" title={focusMode ? 'Exit focus mode' : 'Focus mode — hide everything but the page'} onClick={() => setFocusMode(!focusMode)}>
              <Icon icon={focusMode ? 'fa-solid fa-expand' : 'fa-solid fa-compress'} style={{ marginRight: 6 }} /> {focusMode ? 'Exit focus' : 'Focus'}
            </button>
          </div>
        </div>

        {activeSection === 'design' ? (
          <BookDesigner novelId={id} embedded />
        ) : activeSection === 'analytics' ? (
          <div className="mode-body">
            <Analytics embedded />
          </div>
        ) : BINDER_SECTIONS.includes(activeSection) ? (
          <div className="mode-body">
            {activeSection === 'characters' && <Characters novelId={id} embedded />}
            {activeSection === 'notes' && <Notes novelId={id} embedded />}
            {activeSection === 'relationships' && <Relationships novelId={id} embedded />}
            {activeSection === 'world' && <World novelId={id} embedded />}
            {activeSection === 'moodboard' && <Moodboard novelId={id} embedded />}
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
              {previewHtml ? (
                <div className="preview-prose" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <p className="muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>
                  Nothing written yet — the page is waiting.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <Editor
              key={`${chapter.id}-${restoreTick}`}
              initialHtml={chapter.content}
              onReport={handleReport}
              title={titleDraft}
              onTitleChange={setTitleDraft}
              onTitleBlur={commitTitle}
              placeholder="The first sentence is the hardest. Start anywhere."
            />

            <div className="editor-footer">
              <span className="stat"><b>{formatWords(wordCount)}</b> words</span>
              <span className="stat">+<b>{formatWords(sessionWords)}</b> this session</span>
              {sessionWpm !== null && <span className="stat">~<b>{sessionWpm}</b> wpm</span>}
              <span className="goal-track" title="Daily goal">
                <span className="bar"><span style={{ width: `${goalPct}%` }} className={goalPct >= 100 ? 'done' : ''} /></span>
                <span className="stat"><b>{formatWords(todayW)}</b>/{formatWords(goalWords)} today</span>
              </span>
              {!editingGoal ? (
                <button className="button button-quiet" onClick={() => setEditingGoal(true)} title="Change daily goal"><Icon icon="fa-solid fa-pen" /></button>
              ) : (
                <span className="actions-row">
                  <select value={goalWords} onChange={(e) => setGoalWords(Number(e.target.value))} autoFocus>
                    {GOAL_PRESETS.map((g) => (
                      <option key={g} value={g}>{g} words</option>
                    ))}
                    <option value={0}>no goal</option>
                  </select>
                  <button className="button button-quiet" onClick={commitGoal}><Icon icon="fa-solid fa-check" /></button>
                </span>
              )}
              <span className="saved-indicator">
                {dirty ? <><span className="dot" style={{ background: 'var(--rose)' }} /> saving…</> : <><span className="dot" /> saved {timeAgo(savedAt)}</>}
              </span>
              {chapter.versions?.length > 0 && (
                <button className="button button-quiet" onClick={() => setHistoryOpen(true)}>History ({chapter.versions.length})</button>
              )}
              <button className="button button-quiet" onClick={() => setDesignsOpen((o) => !o)} title="Premade designs — drag one onto the page, or click">
                <Icon icon="fa-solid fa-palette" style={{ marginRight: 6 }} /> Designs
              </button>
              <button className="button button-quiet" onClick={() => handleTidy(chapter)} title="Auto-format this chapter — scene breaks, headings, stray tags">
                <Icon icon="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 6 }} /> Tidy
              </button>
              <button className="button button-quiet" onClick={() => setMergeSource(chapter)} title="Merge this chapter with another">
                <Icon icon="fa-solid fa-object-ungroup" style={{ marginRight: 6 }} /> Merge
              </button>
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
                    Drag a design onto the page to restyle the manuscript — or click to apply it.
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <ChapterEditModal chapter={editChapter} onChange={setEditChapter} onClose={() => setEditChapter(null)} onSave={saveChapterEdit} />
      <MergeModal source={mergeSource} chapters={chapters} onClose={() => setMergeSource(null)} onMerge={handleMerge} />
      <ConfirmDialog open={!!deleteChapterTarget} onClose={() => setDeleteChapterTarget(null)} onConfirm={handleDeleteChapter} title="Delete this chapter?">
        “{deleteChapterTarget?.title || 'Untitled'}” will be removed. Its words stay with you.
      </ConfirmDialog>
      <AuthModal open={connectOpen} onClose={() => setConnectOpen(false)} />
      <HistoryModal chapter={chapter} open={historyOpen} onClose={() => setHistoryOpen(false)} onRestore={(v) => {
        if (!chapter) return
        contentRef.current = v.html
        setChapter((prev) => (prev ? { ...prev, content: v.html, wordCount: v.words } : prev))
        setWordCount(v.words)
        setRestoreTick((t) => t + 1)
        scheduleSave()
        setHistoryOpen(false)
        toast('Brought back a previous version.')
      }} />
    </div>
  )
}

function ChapterEditModal({ chapter, onChange, onClose, onSave }) {
  const kinds = [
    ['book', 'Book'],
    ['part', 'Part'],
    ['act', 'Act'],
    ['chapter', 'Chapter'],
    ['subchapter', 'Subchapter']
  ]
  return (
    <Modal open={!!chapter} onClose={onClose} title="Chapter settings" width={440}>
      {chapter && (
        <>
          <div className="field">
            <label>Title <span className="hint">(leave blank to use the derived name)</span></label>
            <input value={chapter.title || ''} onChange={(e) => onChange({ ...chapter, title: e.target.value })} />
          </div>
          <div className="field">
            <label>Kind</label>
            <select value={chapter.kind || 'chapter'} onChange={(e) => onChange({ ...chapter, kind: e.target.value })}>
              {kinds.map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              Books, parts and acts become outline headers; chapters are numbered, and subchapters nest beneath a chapter.
            </p>
          </div>
          <div className="field">
            <label>Part / volume</label>
            <input value={chapter.part || ''} onChange={(e) => onChange({ ...chapter, part: e.target.value })} placeholder="Legacy part label — mostly unused now" />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={chapter.status || 'draft'} onChange={(e) => onChange({ ...chapter, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="revised">Revised</option>
              <option value="final">Final</option>
            </select>
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

function HistoryModal({ chapter, open, onClose, onRestore }) {
  return (
    <Modal open={open} onClose={onClose} title="Version history" width={460}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Moonscribe quietly keeps the last 20 versions of each chapter. Restore any of them — nothing is lost.
      </p>
      {chapter?.versions?.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...chapter.versions].reverse().map((v, i) => (
            <div key={v.at + i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface-warm)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ flex: 1, color: 'var(--charcoal)', fontSize: '0.88rem' }}>
                {timeAgo(v.at)} · <b>{formatWords(v.words)}</b> words
              </span>
              <button className="button button-ghost" style={{ padding: '5px 12px', fontSize: '0.8rem' }} onClick={() => onRestore(v)}>
                Restore
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted small">No saved versions yet — keep writing.</p>
      )}
    </Modal>
  )
}
