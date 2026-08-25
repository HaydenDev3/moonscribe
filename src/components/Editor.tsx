import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { countWords } from '../utils/words'
import { normalizeSafeLinkUrl, sanitizePaste, sanitizeStoredHtml } from '../utils/formatHtml'
import { annotateProse, stripAnnotations } from '../utils/highlight'
import { useContextMenu } from './ContextMenu'
import Icon from './Icon'
import Select from './Select'
import ScrollRail from './ScrollRail'
import Modal from './Modal'
import { useApp } from '../context/AppContext'
import { buildEditorFontOptions } from '../utils/fonts'
import { PAGE_TEMPLATES, TEMPLATE_MIME } from '../designs/pageTemplates'
import { listMoodboard } from '../db/moodboard'
import { editorPageGeometry, PAGE_MARGIN_PRESETS, PAGE_PRESETS } from '../utils/pageSize'

type TypographyStyle = { fontFamily?: string; color?: string; [key: string]: unknown }
type TypographyConfig = { bodyStyle?: TypographyStyle; chapterTitleStyle?: TypographyStyle; [key: string]: unknown }

const FONT_SIZES = [
  '9', '10', '11', '12', '13', '14',
  '16', '18', '20', '24', '28', '36',
]

const LINE_SPACINGS = [
  { value: '1.0', label: 'Single', wpp: 500 },
  { value: '1.15', label: '1.15', wpp: 430 },
  { value: '1.5', label: '1.5×', wpp: 333 },
  { value: '2.0', label: 'Double', wpp: 250 },
]

const TEXT_COLORS = [
  '#000000',
  '#201f1d',
  '#4a4540',
  '#6b5a4e',
  '#b44c2a',
  '#c19a14',
  '#2a7a3a',
  '#1a4f8a',
  '#6a3090',
  '#c0184e',
  '#ffffff',
  '#f5eedf',
]

const PAGE_SIZES = [
  { id: 'continuous', label: 'Continuous' },
  ...PAGE_PRESETS.map((preset) => ({ id: preset.key, label: preset.label })),
]

const PAGE_MARGINS = PAGE_MARGIN_PRESETS.map((preset) => ({
  value: String(preset.value),
  label: preset.label,
}))

const migratePageSize = (value) => ({
  None: 'continuous',
  A4: 'a4',
  A5: 'a5',
  Letter: 'letter',
}[value] || (typeof value === 'string' ? value : 'trade-paperback') || 'continuous')

const HIGHLIGHT_COLORS = [
  '#fff7a8',
  '#dcfce7',
  '#dbeafe',
  '#fce7f3',
  '#ffedd5',
  '#ede9fe',
  '#e0f2fe',
  '#f0fdf4',
  '#fef3c7',
  '#cffafe',
  '#fdf2f8',
  '#fee2e2',
  'transparent',
]

const PRESENCE_COLORS = ['#7db6f4', '#d99b75', '#9ecb9d', '#c39adf', '#e2bb72', '#7fc8c0']
const MAX_EMBEDDED_IMAGE_BYTES = 5 * 1024 * 1024

function presenceColor(seed) {
  const value = String(seed || '').split('').reduce((total, char) => total + char.charCodeAt(0), 0)
  return PRESENCE_COLORS[value % PRESENCE_COLORS.length]
}

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'
}

export default function Editor({
  initialHtml,
  onReport,
  onEditorFocus = () => {},
  onEditorBlur = () => {},
  placeholder = '',
  title = '',
  onTitleChange = (_value: string) => {},
  onTitleBlur = () => {},
  onComment = undefined,
  annotations = [],
  onCommentHover = undefined,
  typewriterMode = false,
  onSave = undefined,
  characters = [],
  terms = [],
  entities = [],
  onDesigns = undefined,
  onApplyDesign = undefined,
  onLineSpacingChange = undefined,
  pageLayout,
  onPageLayoutChange = (_patch: any) => {},
  typography = {} as TypographyConfig,
  onTypographyChange = (_patch: any) => {},
  canEdit = false,
  readOnly = false,
  spellCheck = true,
  autoCorrect = true,
  collaborators = [],
  chapterId = null,
  novelId = null,
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const wrapRef = useRef(null)
  const titleRef = useRef(null)
  const onReportRef = useRef(onReport)
  const { customFonts, systemFonts, toast } = useApp()
  const editorFontOptions = useMemo(() => buildEditorFontOptions({ systemFonts, customFonts }), [systemFonts, customFonts])
  const [libraryImages, setLibraryImages] = useState<any[]>([])
  const [mediaOpen, setMediaOpen] = useState(false)
  const [pageTemplatesOpen, setPageTemplatesOpen] = useState(false)
  useEffect(() => {
    if (!novelId) return
    listMoodboard(novelId).then((tiles) => setLibraryImages(tiles.filter((tile) => tile.kind === 'image' && tile.image))).catch(() => {})
  }, [novelId])

  const liveCollaborators = useMemo(() => {
    const textLength = Math.max(1, (ref.current?.innerText || String(initialHtml || '').replace(/<[^>]+>/g, '')).length)
    return collaborators
      .filter((person) => person?.chapterId === chapterId && person.status !== 'offline')
      .map((person, index) => {
        const rawOffset = Number(person.cursorOffset)
        const fallback = Math.min(0.94, Math.max(0.06, ((Number(person.lineNumber) || index + 1) - 1) / 42))
        const topRatio = Number.isFinite(rawOffset) && rawOffset >= 0
          ? Math.min(0.96, Math.max(0.035, rawOffset / textLength))
          : fallback
        return {
          ...person,
          topRatio,
          color: presenceColor(person.id),
          label: `${person.username || 'Collaborator'} · ${person.activity === 'writing' ? 'writing here' : 'viewing here'}`,
          shortLabel: initials(person.username),
          emphasis: person.activity === 'writing',
        }
      })
  }, [collaborators, chapterId, initialHtml])

  const { openContextMenu } = useContextMenu()

  // ── Toolbar state ────────────────────────────────────────────────────────
  const [colorPop, setColorPop] = useState(null)
  const defaultBodyFont = typography?.bodyStyle?.fontFamily || editorFontOptions[0]?.value || "'Literata', Georgia, serif"
  const defaultTitleFont = typography?.chapterTitleStyle?.fontFamily || "'Cormorant Garamond', Georgia, serif"
  const [fontFamily, setFontFamily] = useState(defaultBodyFont)
  const [titleFontFamily, setTitleFontFamily] = useState(defaultTitleFont)
  const [typographyTarget, setTypographyTarget] = useState<'body' | 'title'>('body')
  const [fontSize, setFontSize] = useState('12')

  const [pageSize, setPageSize] = useState(() => {
    if (pageLayout?.pageSize) return migratePageSize(pageLayout.pageSize)
    try {
      return migratePageSize(localStorage.getItem('moonscribe:pageSize'))
    } catch {
      return 'continuous'
    }
  })

  const [lineSpacing, setLineSpacing] = useState('1.5')
  const [toolbarIdle, setToolbarIdle] = useState(false)
  const [dictationSupported, setDictationSupported] = useState(false)
  const [dictating, setDictating] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const [linkPopover, setLinkPopover] = useState(null)
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [findMatches, setFindMatches] = useState(0)
  const editingLinkRef = useRef<ReturnType<typeof document.createElement> | null>(null)

  // ── Pagination ───────────────────────────────────────────────────────────
  const [pageCount, setPageCount] = useState(1)

  const savedRange = useRef(null)
  const dictationRef = useRef(null)

  const pgTimer = useRef(null)
  const reAnnotateTimer = useRef(null)
  const recalcRef = useRef(null)

  const skipAnnotationRef = useRef(false)
  const skipAnnotationTimer = useRef(null)

  const toolbarTimerRef = useRef(null)
  const currentFindRef = useRef<{ node: globalThis.Text; start: number; length: number } | null>(null)

  const findInChapter = useCallback((query: string) => {
    const root = ref.current
    const needle = query.trim().toLocaleLowerCase()
    if (!root || !needle) {
      setFindMatches(0)
      return
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: globalThis.Text[] = []
    let node
    while ((node = walker.nextNode())) nodes.push(node as globalThis.Text)
    const matches: Array<{ node: globalThis.Text; start: number }> = []
    for (const textNode of nodes) {
      const value = textNode.data.toLocaleLowerCase()
      let from = 0
      while (from < value.length) {
        const start = value.indexOf(needle, from)
        if (start < 0) break
        matches.push({ node: textNode, start })
        from = start + needle.length
      }
    }
    setFindMatches(matches.length)
    const selection = window.getSelection()
    const currentNode = selection?.anchorNode
    const currentOffset = selection?.anchorOffset || 0
    const next = matches.find((match) => match.node === currentNode && match.start > currentOffset) || matches[0]
    if (next && selection) {
      const range = document.createRange()
      range.setStart(next.node, next.start)
      range.setEnd(next.node, next.start + needle.length)
      selection.removeAllRanges()
      selection.addRange(range)
      currentFindRef.current = { node: next.node, start: next.start, length: needle.length }
      next.node.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [])

  const replaceCurrentMatch = useCallback(() => {
    const match = currentFindRef.current
    if (!match || !findQuery.trim()) return
    const value = match.node.data
    if (value.slice(match.start, match.start + match.length).toLocaleLowerCase() !== findQuery.trim().toLocaleLowerCase()) {
      findInChapter(findQuery)
      return
    }
    match.node.data = `${value.slice(0, match.start)}${replaceQuery}${value.slice(match.start + match.length)}`
    currentFindRef.current = null
    report()
    findInChapter(findQuery)
  // report is declared later in this component and is intentionally omitted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findInChapter, findQuery, replaceQuery])

  const replaceAllMatches = useCallback(() => {
    const root = ref.current
    const needle = findQuery.trim()
    if (!root || !needle) return
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: globalThis.Text[] = []
    let node
    while ((node = walker.nextNode())) nodes.push(node as globalThis.Text)
    const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    let replaced = 0
    for (const textNode of nodes) {
      const before = textNode.data
      const next = before.replace(pattern, () => { replaced += 1; return replaceQuery })
      if (next !== before) textNode.data = next
    }
    if (replaced) {
      currentFindRef.current = null
      report()
      toast(`${replaced} ${replaced === 1 ? 'match' : 'matches'} replaced.`)
      findInChapter(findQuery)
    }
  // report is declared later in this component and is intentionally omitted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findInChapter, findQuery, replaceQuery, toast])

  useEffect(() => {
    if (pageLayout?.pageSize) setPageSize(migratePageSize(pageLayout.pageSize))
  }, [pageLayout?.pageSize])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDictationSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))
  }, [])

  // ── Character/entity references ───────────────────────────────────────────
  const [charTip, setCharTip] = useState(null)
  const [entityTip, setEntityTip] = useState(null)

  const charactersRef = useRef(characters || [])
  const termsRef = useRef(terms || [])
  const entitiesRef = useRef(entities || [])
  const annotationsRef = useRef(annotations || [])

  useEffect(() => {
    charactersRef.current = characters || []
  }, [characters])

  useEffect(() => {
    termsRef.current = terms || []
  }, [terms])

  useEffect(() => {
    entitiesRef.current = entities || []
  }, [entities])

  useEffect(() => {
    annotationsRef.current = annotations || []
  }, [annotations])

  useEffect(() => {
    onReportRef.current = onReport
  }, [onReport])

  // ── Cursor helpers ───────────────────────────────────────────────────────
  const getCursorOffset = useCallback(() => {
    const el = ref.current
    const sel = window.getSelection()

    if (!el || !sel || !sel.rangeCount) return null
    if (!el.contains(sel.anchorNode)) return null

    const range = sel.getRangeAt(0)
    const pre = range.cloneRange()

    pre.selectNodeContents(el)
    pre.setEnd(range.startContainer, range.startOffset)

    return pre.toString().length
  }, [])

  const setCursorOffset = useCallback((offset) => {
    if (offset === null || offset === undefined) return

    const el = ref.current
    if (!el) return

    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
    )

    let remaining = offset

    while (walker.nextNode()) {
      const node = walker.currentNode
      const len = node.textContent.length

      if (remaining <= len) {
        try {
          const range = document.createRange()

          range.setStart(node, remaining)
          range.collapse(true)

          const sel = window.getSelection()

          sel.removeAllRanges()
          sel.addRange(range)
        } catch {
          // Ignore invalid cursor restoration.
        }

        return
      }

      remaining -= len
    }
  }, [])

  const resizeChapterTitle = useCallback(() => {
    const el = titleRef.current

    if (!el) return

    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    resizeChapterTitle()

    // A wrapped chapter title changes the usable position of the manuscript
    // below it. Re-measure after the browser has applied that new height.
    const frame = requestAnimationFrame(() => {
      recalcRef.current?.()
    })

    return () => cancelAnimationFrame(frame)
  }, [resizeChapterTitle, title])

  // Automatic page gaps carry layout metadata so paged exports can reproduce
  // the same pagination. They remain non-editable and are never counted as
  // manuscript text.
  const getPersistentHtml = useCallback((el) => {
    const copy = el.cloneNode(true)

    copy
      .querySelectorAll('.comment-anchor')
      .forEach((node) => node.replaceWith(...Array.from(node.childNodes)))

    return stripAnnotations(copy.innerHTML)
  }, [])

  const annotateCommentAnchors = useCallback((html) => {
    if (!html) return html
    const pending = (annotationsRef.current || [])
      .filter((item) => !item?.resolved && item?.quote?.trim())

    if (!pending.length) return html

    const doc = document.implementation.createHTMLDocument('')
    doc.body.innerHTML = html
    const used = new Set()

    for (const annotation of pending) {
      const quote = annotation.quote.trim()
      if (!quote || used.has(annotation.id)) continue
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
      let wrapped = false

      while (walker.nextNode() && !wrapped) {
        const node = walker.currentNode
        const parent = node.parentElement
        if (!parent || parent.closest('.comment-anchor, .hl-name, .hl-entity, .hl-term')) continue
        const text = node.textContent || ''
        const index = text.indexOf(quote)
        if (index === -1) continue

        const before = text.slice(0, index)
        const match = text.slice(index, index + quote.length)
        const after = text.slice(index + quote.length)
        const frag = doc.createDocumentFragment()

        if (before) frag.appendChild(doc.createTextNode(before))
        const mark = doc.createElement('span')
        mark.className = 'comment-anchor'
        mark.dataset.commentId = annotation.id
        mark.appendChild(doc.createTextNode(match))
        frag.appendChild(mark)
        if (after) frag.appendChild(doc.createTextNode(after))

        node.parentNode.replaceChild(frag, node)
        wrapped = true
        used.add(annotation.id)
      }
    }

    return doc.body.innerHTML
  }, [])

  // ── Live annotation ──────────────────────────────────────────────────────
  const scheduleReAnnotate = useCallback(() => {
    if (skipAnnotationRef.current) return

    clearTimeout(reAnnotateTimer.current)

    reAnnotateTimer.current = setTimeout(() => {
      const el = ref.current

      if (!el) return

      // Replacing innerHTML while the author is typing destroys the native
      // browser selection and undo transaction. Entity decoration is applied
      // once the editor is idle/blurred instead of racing the keystrokes.
      if (document.activeElement === el) {
        scheduleReAnnotate()
        return
      }

      const offset = getCursorOffset()

      const stripped = sanitizeStoredHtml(getPersistentHtml(el))

      const annotated = annotateProse(stripped, {
        characters: charactersRef.current,
        terms: termsRef.current,
        entities: entitiesRef.current,
      })
      const withComments = annotateCommentAnchors(annotated)

      if (el.innerHTML !== withComments) {
        el.innerHTML = withComments
        setCursorOffset(offset)
      }

      requestAnimationFrame(() => {
        recalcRef.current?.()
      })
    }, 1800)
  }, [annotateCommentAnchors, getCursorOffset, getPersistentHtml, setCursorOffset])

  // Recognise a name at the caret without replacing the editor's innerHTML.
  // This keeps native undo and the cursor intact while making newly typed
  // characters, places, artefacts and factions interactive immediately.
  const annotateTypedMention = useCallback(() => {
    const editor = ref.current
    let selection = window.getSelection()
    if (!editor || !selection?.isCollapsed || !selection.rangeCount) return

    // contentEditable may inherit the annotation span after the caret moves
    // past a recognised name. An annotation is valid only while it contains
    // exactly that entity's name and no block markup. Unwrap anything that has
    // grown, preserving its children and the writer's character offset.
    const cursorOffset = getCursorOffset()
    let repaired = false
    editor.querySelectorAll<HTMLElement>('.hl-name, .hl-entity').forEach((mark) => {
      const character = mark.dataset.charId
        ? charactersRef.current.find((item) => item.id === mark.dataset.charId)
        : null
      const entity = mark.dataset.entityId
        ? entitiesRef.current.find((item) => item.id === mark.dataset.entityId)
        : null
      const expected = (character?.name || entity?.name || '').trim()
      const actual = mark.textContent || ''
      const containsStructure = !!mark.querySelector('p,div,br,h1,h2,h3,h4,blockquote,ul,ol,li')
      if (!expected || actual.localeCompare(expected, undefined, { sensitivity: 'accent' }) !== 0 || containsStructure) {
        mark.replaceWith(...mark.childNodes)
        repaired = true
      }
    })
    if (repaired) {
      setCursorOffset(cursorOffset)
      selection = window.getSelection()
      if (!selection?.isCollapsed || !selection.rangeCount) return
    }

    const range = selection.getRangeAt(0)
    const textNode = range.startContainer
    if (textNode.nodeType !== Node.TEXT_NODE || !editor.contains(textNode)) return
    if (textNode.parentElement?.closest('.hl-name, .hl-entity, .hl-term')) return

    const before = textNode.textContent.slice(0, range.startOffset)
    const mentions = [
      ...charactersRef.current.map((item) => ({ item, kind: 'character', name: item.name })),
      ...entitiesRef.current.map((item) => ({ item, kind: item.kind || 'entity', name: item.name })),
    ]
      .filter(({ name }) => name?.trim())
      .sort((a, b) => b.name.trim().length - a.name.trim().length)

    const match = mentions.find(({ name }) => {
      const value = name.trim()
      if (!before.toLocaleLowerCase().endsWith(value.toLocaleLowerCase())) return false
      const preceding = before.slice(0, -value.length).slice(-1)
      return !preceding || !/[\p{L}\p{N}]/u.test(preceding)
    })
    if (!match) return

    const value = match.name.trim()
    const mark = document.createElement('span')
    if (match.kind === 'character') {
      mark.className = 'hl-name'
      mark.dataset.charId = match.item.id
      mark.style.setProperty('--hl-color', match.item.color || '#D4A5A5')
    } else {
      mark.className = `hl-entity hl-entity-${match.kind}`
      mark.dataset.entityId = match.item.id
      mark.dataset.entityKind = match.kind
      if (match.item.color) mark.style.setProperty('--hl-color', match.item.color)
    }

    const mentionRange = document.createRange()
    mentionRange.setStart(textNode, range.startOffset - value.length)
    mentionRange.setEnd(textNode, range.startOffset)
    try {
      mentionRange.surroundContents(mark)
      const caret = document.createRange()
      caret.setStartAfter(mark)
      caret.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caret)
    } catch {
      // A browser composition boundary can make a range temporarily invalid.
    }
  }, [getCursorOffset, setCursorOffset])

  // ── Initial content ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = ref.current

    if (!el) return

    const annotated = annotateProse(sanitizeStoredHtml(initialHtml || ''), {
      characters: charactersRef.current,
      terms: termsRef.current,
      entities: entitiesRef.current,
    })
    const withComments = annotateCommentAnchors(annotated)

    if (el.innerHTML !== withComments) {
      el.innerHTML = withComments
    }

    requestAnimationFrame(() => {
      recalcRef.current?.()
    })

    // Intentionally mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Typewriter mode ───────────────────────────────────────────────────────
  const twTick = useCallback(() => {
    const el = ref.current
    const wrap = wrapRef.current

    if (!el || !wrap) return

    const sel = window.getSelection()

    if (!sel || !sel.rangeCount) return

    const node = sel.anchorNode

    const para =
      node?.nodeType === 3
        ? node.parentElement?.closest('p,h1,h2,h3,h4,blockquote')
        : node instanceof Element
          ? node.closest('p,h1,h2,h3,h4,blockquote')
          : null

    el.querySelectorAll('.tw-active').forEach((n) => {
      n.classList.remove('tw-active')
    })

    if (para && el.contains(para)) {
      para.classList.add('tw-active')

      const wrapRect = wrap.getBoundingClientRect()
      const paraRect = para.getBoundingClientRect()

      const target =
        wrap.scrollTop +
        paraRect.top -
        wrapRect.top -
        wrapRect.height / 2 +
        paraRect.height / 2

      wrap.scrollTo({
        top: target,
        behavior: 'smooth',
      })
    }
  }, [])

  useEffect(() => {
    if (!typewriterMode) {
      ref.current
        ?.querySelectorAll('.tw-active')
        .forEach((n) => n.classList.remove('tw-active'))

      return
    }

    const el = ref.current

    if (!el) return

    el.addEventListener('keyup', twTick)
    el.addEventListener('mouseup', twTick)

    return () => {
      el.removeEventListener('keyup', twTick)
      el.removeEventListener('mouseup', twTick)
    }
  }, [typewriterMode, twTick])

  // ── Pagination engine ────────────────────────────────────────────────────
  //
  // IMPORTANT:
  // The editor is intentionally kept as ONE contentEditable.
  //
  // We do not split the DOM into multiple editable page containers.
  // This prevents problems with:
  //
  // - undo / redo
  // - cursor position
  // - character annotations
  // - AI highlighting
  // - comments
  // - image insertion
  // - selections
  //
  // Pages are calculated visually from the rendered height of each block.
  //
  const recalcPages = useCallback(() => {
    const prose = ref.current as HTMLElement | null
    const shouldRestoreCursor = document.activeElement === prose
    const cursorOffset = shouldRestoreCursor ? getCursorOffset() : null

    const ps = pageSize === 'continuous'
      ? null
      : editorPageGeometry(pageSize, pageLayout?.pageMargin)

    if (!prose || !ps?.bodyHeightPx) {
      prose?.querySelectorAll('[data-auto-page-break="true"]')
        .forEach((node) => node.remove())
      setPageCount(1)
      if (cursorOffset !== null) requestAnimationFrame(() => setCursorOffset(cursorOffset))
      return
    }

    // Start from the manuscript only, then insert fresh in-flow gaps. Unlike
    // the former absolute overlays, these gaps reserve real space so text can
    // never be drawn underneath a page boundary.
    prose
      .querySelectorAll('[data-auto-page-break="true"]')
      .forEach((node) => node.remove())

    const proseRect = prose.getBoundingClientRect()

    // Use the canvas as a stable coordinate origin for page-boundary checks.
    const canvasEl = prose.closest('.editor-canvas-paged')
    const originRect = canvasEl ? canvasEl.getBoundingClientRect() : proseRect

    // Imported documents frequently wrap their paragraphs in one or more
    // container divs. Measuring only `prose.children` turns that wrapper into
    // one chapter-sized block and makes pagination impossible. Paginate the
    // actual leaf writing blocks instead, while still including explicit
    // page/scene breaks wherever they are nested.
    const blockSelector = 'p,h1,h2,h3,h4,blockquote,pre,ul,ol,figure,.scene-break,.pg-break,[data-page-break="true"]'
    const children = Array.from(prose.querySelectorAll(blockSelector)) as Element[]
    const leafChildren = children.filter((node) => {
      if (node.matches('.pg-auto-break,[data-auto-page-break="true"]')) return false
      return !node.querySelector(blockSelector)
    })

    // Plain-text contentEditable states can briefly have no block children.
    // In that case the prose itself is still a valid single page.
    if (!leafChildren.length && prose.textContent?.trim()) {
      setPageCount(1)
      return
    }

    if (!leafChildren.length) {
      setPageCount(1)
      return
    }

    // Track the physical sheet, not the amount of text currently on it. The
    // chapter heading consumes space inside page one, so calculating from the
    // prose start causes the bottom margin to drift and pagination to collapse.
    let pageTop = 0
    let currentPage = 1

    const tolerance = 2

    const getTop = (element) => {
      const rect = element.getBoundingClientRect()
      return rect.top - originRect.top
    }

    const getBottom = (element) => {
      const rect = element.getBoundingClientRect()
      return rect.bottom - originRect.top
    }

    const isManualBreak = (element) => {
      return element.classList?.contains('pg-break') || element.dataset?.pageBreak === 'true'
    }

    const isSceneBreak = (element) => {
      return element.classList?.contains('scene-break')
    }

    const isHeading = (element) => {
      return /^H[1-4]$/.test(element.tagName)
    }

    const addAutoBreak = (before, previousPage, page, pageBottom, breakTop) => {
      const marker = document.createElement('div')

      marker.className = 'pg-auto-break'
      marker.contentEditable = 'false'
      marker.tabIndex = -1
      marker.dataset.autoPageBreak = 'true'
      marker.setAttribute('aria-hidden', 'true')
      marker.style.setProperty(
        '--pg-fill-before',
        `${Math.max(0, Math.round(pageBottom - breakTop))}px`,
      )
      marker.dataset.previousPage = String(previousPage)
      marker.dataset.nextPage = String(page)
      marker.dataset.autoPageIndex = String(page)
      marker.dataset.autoPageSource = String(leafChildren.indexOf(before))
      marker.dataset.autoPageLayout = `${pageSize}:${pageLayout?.pageMargin || ''}:${ps.bodyHeightPx}`
      marker.dataset.autoPageGenerated = String(Date.now())

      before.before(marker)
      return marker
    }

    for (let i = 0; i < leafChildren.length; i++) {
      const child = leafChildren[i]

      if (isManualBreak(child)) {
        const next = leafChildren[i + 1]
        const breakTop = getTop(child)
        const pageBottom = pageTop + ps.heightPx - ps.marginBottomPx

        child.setAttribute('style', `${child.getAttribute('style') ?? ''}; --pg-fill-before: ${Math.max(0, Math.round(pageBottom - breakTop))}px;`)

        currentPage += 1
        pageTop = next
          ? getTop(next) - ps.marginTopPx
          : getBottom(child) - ps.marginTopPx

        continue
      }

      if (isSceneBreak(child)) {
        const bottom = getBottom(child)
        const pageBottom = pageTop + ps.heightPx - ps.marginBottomPx

        if (bottom > pageBottom + tolerance) {
          const top = getTop(child)

          if (top > pageTop + ps.marginTopPx + 4) {
            currentPage += 1

            addAutoBreak(
              child,
              currentPage - 1,
              currentPage,
              pageBottom,
              top,
            )

            const nextTop = getTop(child)

            pageTop = nextTop - ps.marginTopPx
          }
        }

        continue
      }

      const rect = child.getBoundingClientRect()

      if (!rect.height) continue

      // Both positions use the canvas origin, keeping page measurements stable.
      const top = rect.top - originRect.top
      const bottom = rect.bottom - originRect.top

      let pageBottom = pageTop + ps.heightPx - ps.marginBottomPx

      // ── Keep headings with their next block ──────────────────────────────
      if (isHeading(child)) {
        // Use the measured leaf sequence. `children` also contains wrapper
        // headings/blocks from imported HTML, so indexing into it can point at
        // the wrong node and is especially visible on compact A5 pages.
        const next = leafChildren[i + 1]

        if (
          next &&
          !isManualBreak(next) &&
          !isSceneBreak(next)
        ) {
          const nextBottom = getBottom(next)

          if (
            nextBottom > pageBottom + tolerance &&
            top > pageTop + ps.marginTopPx + 4
          ) {
            currentPage += 1

            addAutoBreak(
              child,
              currentPage - 1,
              currentPage,
              pageBottom,
              top,
            )

            const nextTop = getTop(child)

            pageTop = nextTop - ps.marginTopPx

            continue
          }
        }
      }

      pageBottom = pageTop + ps.heightPx - ps.marginBottomPx

      // ── Normal automatic page break ─────────────────────────────────────
      if (bottom > pageBottom + tolerance) {
        // Don't repeatedly break if the block itself is taller than a page.
        if (top > pageTop + ps.marginTopPx + 4) {
          currentPage += 1

          addAutoBreak(
            child,
            currentPage - 1,
            currentPage,
            pageBottom,
            top,
          )

          const nextTop = getTop(child)

          pageTop = nextTop - ps.marginTopPx
        }
      }
    }

    setPageCount(Math.max(1, currentPage))
    // Persist the generated boundaries after layout has settled so exports,
    // backups, and sync see the same paginated document the writer sees.
    const paginatedHtml = getPersistentHtml(prose)
    onReportRef.current?.(paginatedHtml, countWords(paginatedHtml))
    if (cursorOffset !== null) requestAnimationFrame(() => setCursorOffset(cursorOffset))
    // Inserting/removing sibling page markers preserves the browser's live
    // Range. Never restore a character offset on a later frame: the writer may
    // have typed again by then, and rewinding to that stale offset makes fresh
    // text appear to delete itself.
  }, [getCursorOffset, getPersistentHtml, pageSize, pageLayout?.pageMargin, setCursorOffset])

  recalcRef.current = recalcPages

  // ── Recalculate after layout changes ──────────────────────────────────────
  useEffect(() => {
    if (pageSize === 'continuous') {
      ref.current
        ?.querySelectorAll('[data-auto-page-break="true"]')
        .forEach((node) => node.remove())
      setPageCount(1)
      return
    }

    const timer = setTimeout(() => {
      recalcPages()
    }, 150)

    return () => clearTimeout(timer)
  }, [
    pageSize,
    lineSpacing,
    fontSize,
    fontFamily,
    recalcPages,
  ])

  // Recalculate when browser/window size changes.
  useEffect(() => {
    const handleResize = () => {
      recalcRef.current?.()
    }

    window.addEventListener('resize', handleResize)

    // Images load after the editor has rendered and change the height of the
    // manuscript. Reflow pagination after each image settles so A5, A4,
    // paperback and custom sizes all use the same live geometry.
    const prose = ref.current
    const onImageLoad = () => recalcRef.current?.()
    const images = Array.from(prose?.querySelectorAll<HTMLImageElement>('img') || [])
    images.forEach((image) => image.addEventListener('load', onImageLoad))
    const observer = typeof MutationObserver !== 'undefined' && prose
      ? new MutationObserver(() => {
          prose.querySelectorAll<HTMLImageElement>('img:not([data-page-listener])').forEach((image) => {
            image.setAttribute('data-page-listener', 'true')
            image.addEventListener('load', onImageLoad)
          })
        })
      : null
    observer?.observe(prose, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('resize', handleResize)
      images.forEach((image) => image.removeEventListener('load', onImageLoad))
      observer?.disconnect()
    }
  }, [])

  // ── Report changes ───────────────────────────────────────────────────────
  const report = useCallback(() => {
    const el = ref.current

    if (!el) return

    const clean = getPersistentHtml(el)

    onReportRef.current?.(
      clean,
      countWords(clean),
    )

    scheduleReAnnotate()
    requestAnimationFrame(annotateTypedMention)

    if (pageSize !== 'continuous') {
      // Throttle pagination instead of debouncing it. Debouncing meant every
      // keystroke cancelled the measurement, so a long uninterrupted passage
      // could remain on one visual page until Enter or a pause. Measuring at
      // most a few times per second keeps typing responsive while keeping all
      // page sizes in sync with the live content.
      if (!pgTimer.current) {
        pgTimer.current = setTimeout(() => {
          pgTimer.current = null
          recalcRef.current?.()
        }, 450)
      }
    }
  }, [
    getPersistentHtml,
    annotateTypedMention,
    pageSize,
    scheduleReAnnotate,
  ])

  const ensureCaretInTextBlock = useCallback((event) => {
    if (event?.inputType === 'insertParagraph' || event?.inputType === 'insertLineBreak') {
      if (pgTimer.current) {
        clearTimeout(pgTimer.current)
        pgTimer.current = null
      }
      requestAnimationFrame(() => recalcRef.current?.())
    }
    const el = ref.current
    const selection = window.getSelection()
    if (!el || !selection?.rangeCount) return
    const range = selection.getRangeAt(0)
    if (range.startContainer !== el) return
    const paragraph = document.createElement('p')
    paragraph.innerHTML = '<br>'
    const before = el.childNodes[range.startOffset] || null
    el.insertBefore(paragraph, before)
    const next = document.createRange()
    next.setStart(paragraph, 0)
    next.collapse(true)
    selection.removeAllRanges()
    selection.addRange(next)
  }, [])

  // ── Basic command helper ──────────────────────────────────────────────────
  const exec = useCallback((cmd, val = null) => {
    const el = ref.current

    if (!el) return

    el.focus()

    if (savedRange.current) {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }

    document.execCommand(
      cmd,
      false,
      val,
    )

    report()
  }, [report])

  // ── Undo / redo ──────────────────────────────────────────────────────────
  const execUndoRedo = useCallback((type) => {
    const el = ref.current

    if (!el) return

    el.focus()

    document.execCommand(
      type,
      false,
      null,
    )

    const clean = getPersistentHtml(el)

    onReportRef.current?.(
      clean,
      countWords(clean),
    )

    requestAnimationFrame(() => {
      recalcRef.current?.()
    })
  }, [getPersistentHtml])

  // ── Block formatting ──────────────────────────────────────────────────────
  const formatBlock = useCallback((tag) => {
    const el = ref.current

    if (!el) return

    el.focus()

    try {
      document.execCommand(
        'formatBlock',
        false,
        tag,
      )
    } catch {
      document.execCommand(
        'formatBlock',
        false,
        `<${tag}>`,
      )
    }

    report()
  }, [report])

  const toggleHeading = useCallback((tag) => {
    const el = ref.current

    if (!el) return

    const sel = window.getSelection()
    const node = sel?.anchorNode

    const block =
      node instanceof Element
        ? node.closest('h1,h2,h3,h4,p')
        : node?.nodeType === Node.TEXT_NODE
          ? node.parentElement?.closest('h1,h2,h3,h4,p')
          : null

    if (
      block &&
      block.tagName.toLowerCase() === tag
    ) {
      formatBlock('p')
    } else {
      formatBlock(tag)
    }
  }, [formatBlock])

  // ── Inline style ─────────────────────────────────────────────────────────
  const applyStyle = useCallback((prop, value) => {
    const el = ref.current

    if (!el) return

    el.focus()

    if (savedRange.current) {
      const sel = window.getSelection()

      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }

    const sel = window.getSelection()

    if (!sel || !sel.rangeCount) return

    const range = sel.getRangeAt(0)

    if (range.collapsed) {
      // Word/Docs-style behaviour: choosing a font with only a caret should
      // affect the next characters typed, not silently do nothing. Browser
      // editing engines still honour execCommand for pending inline typing
      // state, while our span wrapper remains the cleaner path for selections.
      try {
        document.execCommand('styleWithCSS', false, 'true')
        if (prop === 'fontFamily') {
          document.execCommand('fontName', false, String(value))
        } else if (prop === 'fontSize') {
          const marker = document.createElement('span')
          marker.style[prop] = value
          marker.appendChild(document.createTextNode('\u200b'))
          range.insertNode(marker)
          const next = document.createRange()
          next.setStart(marker.firstChild, 1)
          next.collapse(true)
          sel.removeAllRanges()
          sel.addRange(next)
          savedRange.current = next.cloneRange()
          report()
        }
      } catch {
        // If the browser rejects the pending style command, leave the caret
        // untouched rather than corrupting the manuscript.
      }
      return
    }

    // Browser range wrapping can create invalid markup when a whole paragraph
    // is selected (for example Ctrl/Cmd+A in the manuscript). Let the editing
    // engine apply highlights across block boundaries instead of wrapping <p>
    // elements in a span.
    if (prop === 'backgroundColor') {
      document.execCommand('backColor', false, String(value))
      savedRange.current = range.cloneRange()
      report()
      return
    }

    const span = document.createElement('span')

    span.style[prop] = value

    try {
      range.surroundContents(span)
    } catch {
      const frag = range.extractContents()

      span.appendChild(frag)
      range.insertNode(span)
    }

    sel.removeAllRanges()

    const r2 = document.createRange()

    r2.selectNodeContents(span)

    sel.addRange(r2)

    report()
  }, [report])

  const clearHighlight = useCallback(() => {
    const editor = ref.current

    if (!editor) return

    editor.focus()

    const selection = window.getSelection()

    if (!selection) return

    if (savedRange.current) {
      selection.removeAllRanges()
      selection.addRange(savedRange.current)
    }

    if (!selection.rangeCount) return

    const range = selection.getRangeAt(0)
    const elementFor = (node) =>
      node?.nodeType === Node.ELEMENT_NODE
        ? node
        : node?.parentElement
    const hasHighlight = (element) =>
      element instanceof HTMLElement &&
      Boolean(element.style.backgroundColor || element.style.background)
    const clearElementHighlight = (element) => {
      element.style.removeProperty('background-color')
      element.style.removeProperty('background')

      if (!element.getAttribute('style')) element.removeAttribute('style')
    }
    const outerHighlightFor = (node) => {
      let current = elementFor(node)
      let match = null

      while (current && current !== editor) {
        if (hasHighlight(current)) match = current
        current = current.parentElement
      }

      return match
    }

    if (range.collapsed) {
      const highlighted = outerHighlightFor(range.startContainer)

      if (!highlighted) return

      clearElementHighlight(highlighted)
      savedRange.current = range.cloneRange()
      report()
      return
    }

    const startHighlight = outerHighlightFor(range.startContainer)
    const endHighlight = outerHighlightFor(range.endContainer)

    // Split one highlighted run around the selection. This removes the actual
    // colour instead of layering a transparent span over the old highlight.
    if (startHighlight && startHighlight === endHighlight) {
      const beforeRange = document.createRange()
      const afterRange = document.createRange()

      beforeRange.selectNodeContents(startHighlight)
      beforeRange.setEnd(range.startContainer, range.startOffset)
      afterRange.selectNodeContents(startHighlight)
      afterRange.setStart(range.endContainer, range.endOffset)

      const before = beforeRange.cloneContents()
      const selected = range.cloneContents()
      const after = afterRange.cloneContents()
      const replacement = document.createDocumentFragment()
      const appendClone = (contents, highlighted) => {
        if (!contents.textContent && !contents.childNodes.length) return null

        const clone = startHighlight.cloneNode(false)

        clone.appendChild(contents)

        if (!highlighted) {
          clearElementHighlight(clone)
          clone.querySelectorAll('[style]').forEach((child) => {
            if (hasHighlight(child)) clearElementHighlight(child)
          })
        }

        replacement.appendChild(clone)
        return clone
      }

      appendClone(before, true)
      const plain = appendClone(selected, false)
      appendClone(after, true)
      startHighlight.replaceWith(replacement)

      if (plain) {
        const nextRange = document.createRange()

        nextRange.selectNodeContents(plain)
        selection.removeAllRanges()
        selection.addRange(nextRange)
        savedRange.current = nextRange.cloneRange()
      }

      report()
      return
    }

    // Also support selections spanning independently highlighted runs.
    editor.querySelectorAll('span[style]').forEach((span) => {
      if (hasHighlight(span) && range.intersectsNode(span)) {
        clearElementHighlight(span)
      }
    })

    savedRange.current = range.cloneRange()
    report()
  }, [report])

  const applyMarkdownShortcut = useCallback((e) => {
    if (e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey) return false
    const sel = window.getSelection()
    if (!sel?.isCollapsed || !sel.rangeCount) return false
    const node = sel.anchorNode
    const block = node instanceof Element
      ? node.closest('p')
      : node?.nodeType === Node.TEXT_NODE
        ? node.parentElement?.closest('p')
        : null
    if (!block || !ref.current?.contains(block)) return false
    const marker = block.textContent.trim()
    const commands = { '#': 'h1', '##': 'h2', '###': 'h3' }
    if (commands[marker]) {
      e.preventDefault()
      block.textContent = ''
      formatBlock(commands[marker])
      return true
    }
    if (marker === '>' || marker === '-' || marker === '*' || marker === '1.') {
      e.preventDefault()
      block.textContent = ''
      document.execCommand(marker === '1.' ? 'insertOrderedList' : marker === '>' ? 'formatBlock' : 'insertUnorderedList', false, marker === '>' ? 'blockquote' : null)
      report()
      return true
    }
    return false
  }, [formatBlock, report])

  // ── Manual page break ────────────────────────────────────────────────────
  //
  // This inserts a non-editable marker inside the ONE editor.
  // It does NOT create another contentEditable.
  //
  const insertPageBreak = useCallback(() => {
    const el = ref.current

    if (!el) return

    el.focus()

    const selection = window.getSelection()

    if (
      !selection ||
      !selection.rangeCount
    ) {
      return
    }

    const range = selection.getRangeAt(0)

    if (!el.contains(range.commonAncestorContainer)) {
      return
    }

    // Structural markers must never replace selected manuscript text.
    if (!range.collapsed) {
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer as Element
      : range.endContainer.parentElement
    const block = endElement?.closest('p,h1,h2,h3,blockquote')
    if (block && el.contains(block)) {
      range.setStartAfter(block)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    const marker = document.createElement('div')

    marker.className = 'pg-break'
    marker.contentEditable = 'false'
    marker.dataset.pageBreak = 'true'

    marker.innerHTML = `
      <span class="pg-break-line">
        <span class="pg-break-label">Page break</span>
      </span>
    `

    const paragraph = document.createElement('p')

    paragraph.innerHTML = '<br>'

    range.deleteContents()
    range.insertNode(marker)

    marker.after(paragraph)

    const newRange = document.createRange()

    newRange.setStart(paragraph, 0)
    newRange.collapse(true)

    selection.removeAllRanges()
    selection.addRange(newRange)

    report()

    requestAnimationFrame(() => {
      recalcRef.current?.()
    })
  }, [report])

  const recalculatePageBreaks = useCallback(() => {
    recalcRef.current?.()
  }, [])

  // ── Scene break ──────────────────────────────────────────────────────────
  const insertSceneBreak = useCallback(() => {
    const el = ref.current

    if (!el) return

    el.focus()

    const selection = window.getSelection()
    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0)
      if (el.contains(range.commonAncestorContainer) && !range.collapsed) {
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE
        ? range.endContainer as Element
        : range.endContainer.parentElement
      const block = endElement?.closest('p,h1,h2,h3,blockquote')
      if (block && el.contains(block)) {
        range.setStartAfter(block)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }

    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (!range || !el.contains(range.commonAncestorContainer)) return
    const marker = document.createElement('div')
    marker.className = 'scene-break'
    marker.contentEditable = 'false'
    marker.dataset.sceneBreak = 'true'
    marker.textContent = '❦'
    const paragraph = document.createElement('p')
    paragraph.innerHTML = '<br>'
    range.insertNode(marker)
    marker.after(paragraph)
    const caret = document.createRange()
    caret.setStart(paragraph, 0)
    caret.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(caret)

    report()
  }, [report])

  // ── Link ─────────────────────────────────────────────────────────────────
  const insertLink = useCallback(() => {
    const sel = window.getSelection()
    if (sel?.rangeCount && ref.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
    const selectedText = sel && !sel.isCollapsed ? sel.toString().trim() : ''
    const suggested = selectedText && /^https?:\/\//i.test(selectedText) ? selectedText : ''

    editingLinkRef.current = null
    setLinkDraft(suggested || 'https://')
    setLinkDialogOpen(true)
  }, [])

  const openSafeLink = useCallback((value) => {
    const url = normalizeSafeLinkUrl(value)
    if (!url) return
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (opened) opened.opener = null
  }, [])

  const handleEditorClick = useCallback((event) => {
    const target = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!target || target.tagName !== 'A') return
    // A normal click remains an editing gesture. Modifier-click is the explicit
    // navigation gesture, matching rich-text editors and avoiding lost drafts.
    if (!(event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      const rect = target.getBoundingClientRect()
      setLinkPopover({
        href: normalizeSafeLinkUrl(target.getAttribute('href')),
        text: target.textContent || target.getAttribute('href') || 'Link',
        node: target,
        top: rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 260),
      })
      return
    }
    event.preventDefault()
    openSafeLink(target.getAttribute('href'))
  }, [openSafeLink])

  useEffect(() => {
    if (!linkPopover) return undefined
    const close = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('.editor-link-popover, a[href]')) setLinkPopover(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [linkPopover])

  const removeLink = useCallback((node) => {
    if (!node?.parentNode) return
    node.replaceWith(...node.childNodes)
    setLinkPopover(null)
    report()
  }, [report])

  const applyLinkInsert = useCallback(() => {
    const url = normalizeSafeLinkUrl(linkDraft)
    if (!url) {
      setLinkDialogOpen(false)
      setLinkDraft('https://')
      return
    }

    const editor = ref.current
    if (!editor) {
      setLinkDialogOpen(false)
      setLinkDraft('https://')
      return
    }

    const editingLink = editingLinkRef.current
    if (editingLink && editor.contains(editingLink)) {
      editingLink.setAttribute('href', url)
      editingLink.setAttribute('target', '_blank')
      editingLink.setAttribute('rel', 'noopener noreferrer nofollow')
      editingLinkRef.current = null
      setLinkDialogOpen(false)
      setLinkDraft('https://')
      report()
      return
    }

    const selection = window.getSelection()
    const range = savedRange.current || (selection && selection.rangeCount ? selection.getRangeAt(0) : document.createRange())

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer nofollow'

    const fallbackText = range.toString().trim() || url
    anchor.textContent = fallbackText

    editor.focus()

    if (savedRange.current && selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }

    if (selection && selection.rangeCount && editor.contains(selection.anchorNode)) {
      if (!range.collapsed) {
        try {
          range.surroundContents(anchor)
        } catch {
          const fragment = range.extractContents()
          anchor.appendChild(fragment)
          range.insertNode(anchor)
        }
      } else {
        range.insertNode(anchor)
      }
    } else {
      const cursor = document.createRange()
      cursor.selectNodeContents(editor)
      cursor.collapse(false)
      cursor.insertNode(anchor)
    }

    if (selection) {
      const focus = document.createRange()
      focus.selectNodeContents(anchor)
      focus.collapse(false)
      selection.removeAllRanges()
      selection.addRange(focus)
    }

    setLinkDialogOpen(false)
    setLinkDraft('https://')
    savedRange.current = null
    report()
  }, [linkDraft, report])

  // ── Comments ─────────────────────────────────────────────────────────────
  const addComment = useCallback(() => {
    const el = ref.current
    const sel = window.getSelection?.()

    let quote = ''

    if (
      sel &&
      sel.rangeCount &&
      el &&
      el.contains(sel.anchorNode)
    ) {
      quote = sel
        .toString()
        .replace(/\s+/g, ' ')
        .trim()
    }

    onComment?.(quote)
  }, [onComment])

  const insertDictationText = useCallback((text) => {
    const editor = ref.current
    if (!editor || !text?.trim()) return

    editor.focus()

    if (savedRange.current) {
      const selection = window.getSelection?.()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(savedRange.current)
      }
    }

    const inserted = document.execCommand('insertText', false, text)

    if (!inserted) {
      const selection = window.getSelection?.()
      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0)
        const node = document.createTextNode(text)

        range.deleteContents()
        range.insertNode(node)
        range.setStartAfter(node)
        range.collapse(true)

        selection.removeAllRanges()
        selection.addRange(range)
        savedRange.current = range.cloneRange()
      } else {
        editor.appendChild(document.createTextNode(text))
      }
    }

    report()
    requestAnimationFrame(() => {
      recalcRef.current?.()
    })
  }, [report])

  const stopDictation = useCallback(() => {
    const recognition = dictationRef.current
    if (!recognition) {
      setDictating(false)
      return
    }

    try {
      recognition.stop()
    } catch {
      // Ignore races when the recognition session has already ended.
    }
  }, [])

  const toggleDictation = useCallback(() => {
    if (typeof window === 'undefined') return

    if (dictating) {
      stopDictation()
      return
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      toast('Voice dictation is not supported in this browser. Try Chrome or Edge over HTTPS.')
      return
    }
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      toast('Voice dictation needs a secure connection.')
      return
    }

    const recognition = new SpeechRecognition()

    dictationRef.current = recognition
    recognition.lang = navigator.language || 'en-AU'
    recognition.interimResults = false
    recognition.continuous = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => setDictating(true)
    recognition.onend = () => {
      setDictating(false)
      dictationRef.current = null
    }
    recognition.onerror = (event) => {
      const error = event?.error
      if (error === 'not-allowed' || error === 'service-not-allowed') toast('Microphone access was blocked. Allow microphone access and try again.')
      else if (error !== 'aborted' && error !== 'no-speech') toast('Voice dictation stopped. Try again.')
      setDictating(false)
      dictationRef.current = null
    }
    recognition.onresult = (event) => {
      const speechEvent = event as {
        results?: ArrayLike<{ isFinal?: boolean; [index: number]: { transcript?: string } }>
        resultIndex?: number
      }
      const results = Array.from(speechEvent.results || [])
      const transcript = results
        .slice(speechEvent.resultIndex || 0)
        .filter((result) => typeof result === 'object' && result !== null && 'isFinal' in result && Boolean((result as { isFinal?: boolean }).isFinal))
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim()

      if (!transcript) return

      insertDictationText(`${transcript} `)
    }

    try {
      recognition.start()
    } catch {
      setDictating(false)
      dictationRef.current = null
    }
  }, [dictating, insertDictationText, stopDictation, toast])

  // ── Image drop ───────────────────────────────────────────────────────────
  const handleImageDrop = useCallback((e) => {
    const droppedFiles = Array.from(e.dataTransfer?.files || []).filter((file): file is File => {
      const candidate = file as File & { type?: unknown }
      return typeof candidate.type === 'string' && candidate.type.startsWith('image/')
    })
    const files = droppedFiles.filter((file) => file.size <= MAX_EMBEDDED_IMAGE_BYTES)
    if (!droppedFiles.length) return
    if (!droppedFiles.length) return
    e.preventDefault()
    if (files.length !== droppedFiles.length) {
      toast('Images larger than 5 MB are not embedded in manuscripts. Resize the image and try again.')
    }
    if (!files.length) return

    const selection = window.getSelection()

    files.forEach((file) => {
      const safeFile = file as File
      const reader = new FileReader()

      reader.onload = () => {
        const img = document.createElement('img')
        const src = typeof reader.result === 'string' ? reader.result : ''

        img.src = src
        img.alt = typeof safeFile.name === 'string' ? safeFile.name : 'Manuscript image'
        img.style.maxWidth = '100%'
        img.style.height = 'auto'
        img.style.display = 'block'
        img.style.margin = '1.25rem auto'

        if (
          selection &&
          selection.rangeCount
        ) {
          const range = selection.getRangeAt(0)

          if (ref.current?.contains(range.commonAncestorContainer)) {
            range.deleteContents()
            range.insertNode(img)

            range.setStartAfter(img)
            range.collapse(true)

            selection.removeAllRanges()
            selection.addRange(range)
          } else {
            ref.current?.appendChild(img)
          }
        } else {
          ref.current?.appendChild(img)
        }

        report()
      }

      reader.onerror = () => {
        toast('MoonScribe could not read that image. Your manuscript was not changed.')
      }
      reader.readAsDataURL(safeFile)
    })
  }, [report, toast])

  const insertLibraryImage = useCallback((id) => {
    const item = libraryImages.find((tile) => tile.id === id)
    if (!item || !ref.current) return
    const img = document.createElement('img')
    img.src = item.image
    img.alt = item.text || 'Media Library image'
    img.style.maxWidth = '100%'
    img.style.height = 'auto'
    img.style.display = 'block'
    img.style.margin = '1.25rem auto'
    const selection = window.getSelection()
    if (selection?.rangeCount && ref.current.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      range.insertNode(img)
      range.setStartAfter(img)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    } else ref.current.appendChild(img)
    report()
  }, [libraryImages, report])

  const insertPageTemplate = useCallback((templateId) => {
    const template = PAGE_TEMPLATES.find((item) => item.id === templateId)
    if (!template || !ref.current) return
    const block = document.createElement('section')
    block.className = `ms-page-template ms-page-template-${template.id}`
    block.innerHTML = `<div class="ms-page-template-mark">${template.icon}</div><h2>${template.title}</h2><p>${template.description}</p><div class="ms-page-template-rule"></div><p class="ms-page-template-placeholder">Begin writing here…</p>`
    const selection = window.getSelection()
    if (selection?.rangeCount && ref.current.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      const range = selection.getRangeAt(0); range.deleteContents(); range.insertNode(block); range.setStartAfter(block); range.collapse(true); selection.removeAllRanges(); selection.addRange(range)
    } else ref.current.appendChild(block)
    report(); setPageTemplatesOpen(false); toast(`${template.title} inserted.`)
  }, [report, toast])

  const handleTemplateOrImageDrop = useCallback((event) => {
    const designId = event.dataTransfer?.getData('application/x-moonscribe-design')
    if (designId) { event.preventDefault(); onApplyDesign?.(designId); return }
    const templateId = event.dataTransfer?.getData(TEMPLATE_MIME)
    if (templateId) { event.preventDefault(); insertPageTemplate(templateId); return }
    handleImageDrop(event)
  }, [handleImageDrop, insertPageTemplate, onApplyDesign])

  // ── Selection toolbar state ──────────────────────────────────────────────
  useEffect(() => {
    const updateState = () => {
      const fam = document.queryCommandValue(
        'fontName',
      )

      if (fam) {
        const normalized = fam.toLowerCase().replace(/['"]/g, '').trim()
        const match = editorFontOptions.find((f) =>
          String(f.value)
            .toLowerCase()
            .replace(/['"]/g, '')
            .includes(normalized),
        )

        if (match) {
          setFontFamily(match.value)
        }
      }

      const sz = document.queryCommandValue(
        'fontSize',
      )

      if (
        sz &&
        Number(sz) >= 1 &&
        Number(sz) <= 7
      ) {
        const map = {
          1: '9',
          2: '10',
          3: '11',
          4: '13',
          5: '18',
          6: '24',
          7: '36',
        }

        setFontSize(
          map[sz] || '13',
        )
      }
    }

    const el = ref.current

    if (!el) return

    el.addEventListener(
      'keyup',
      updateState,
    )

    el.addEventListener(
      'mouseup',
      updateState,
    )

    return () => {
      el.removeEventListener(
        'keyup',
        updateState,
      )

      el.removeEventListener(
        'mouseup',
        updateState,
      )
    }
  }, [editorFontOptions])

  // ── Paste ────────────────────────────────────────────────────────────────
  const handlePaste = useCallback((e) => {
    const clipboardHtml = e.clipboardData?.getData('text/html') || ''
    const clipboardImageFiles = Array.from(e.clipboardData?.items || [])
      .filter((item) => {
        const candidate = item as DataTransferItem & { kind?: string; type?: string }
        return candidate.kind === 'file' && typeof candidate.type === 'string' && candidate.type.startsWith('image/')
      })
      .map((item) => (item as DataTransferItem).getAsFile())
      .filter((file): file is File => Boolean(file))
    const imageFiles = clipboardImageFiles.filter((file) => file.size <= MAX_EMBEDDED_IMAGE_BYTES)
    if (clipboardImageFiles.length !== imageFiles.length) {
      e.preventDefault()
      toast('Images larger than 5 MB are not embedded in manuscripts. Resize the image and try again.')
      if (!imageFiles.length) return
    }
    const htmlImageSources = imageFiles.length || !clipboardHtml
      ? []
      : Array.from(new DOMParser().parseFromString(clipboardHtml, 'text/html').querySelectorAll('img'))
        .map((img) => img.getAttribute('src') || '')
        .filter((src) => /^(?:data:image\/(?:png|jpe?g|gif|webp);base64,|blob:|https?:\/\/)/i.test(src))

    if (imageFiles.length || htmlImageSources.length) {
      e.preventDefault()
      const selection = window.getSelection()
      const savedRange = selection?.rangeCount && ref.current?.contains(selection.getRangeAt(0).commonAncestorContainer)
        ? selection.getRangeAt(0).cloneRange()
        : null

      Promise.all([
        ...imageFiles.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ src: reader.result, name: file.name })
        reader.onerror = reject
        reader.readAsDataURL(file)
        })),
        ...htmlImageSources.map((src) => Promise.resolve({ src, name: 'Pasted manuscript image' })),
      ]).then((images) => {
        const range = savedRange || document.createRange()
        if (!savedRange) {
          range.selectNodeContents(ref.current)
          range.collapse(false)
        }
        range.deleteContents()
        images.forEach(({ src, name }) => {
          const img = document.createElement('img')
          img.src = src
          img.alt = name || 'Pasted manuscript image'
          img.style.maxWidth = '100%'
          img.style.height = 'auto'
          img.style.display = 'block'
          img.style.margin = '1.25rem auto'
          range.insertNode(img)
          range.setStartAfter(img)
          range.collapse(true)
        })
        selection?.removeAllRanges()
        selection?.addRange(range)
        report()
      }).catch(() => {
        toast('MoonScribe could not read that image. Your manuscript was not changed.')
      })
      return
    }

    e.preventDefault()

    const html = clipboardHtml

    const text =
      e.clipboardData?.getData('text/plain')

    const cleaned = sanitizePaste(
      html && html.trim()
        ? html
        : text,
    )

    if (!cleaned) return

    document.execCommand(
      'insertHTML',
      false,
      cleaned,
    )

    report()
  }, [report, toast])

  // ── Remove scene break ──────────────────────────────────────────────────
  const removeSceneBreak = useCallback((node) => {
    const el = ref.current

    if (
      !el ||
      !node ||
      !el.contains(node)
    ) {
      return false
    }

    const prevP = node.previousElementSibling
    const nextP = node.nextElementSibling

    if (
      prevP &&
      prevP.tagName === 'P' &&
      !prevP.textContent.trim()
    ) {
      prevP.remove()
    }

    if (
      nextP &&
      nextP.tagName === 'P' &&
      !nextP.textContent.trim()
    ) {
      nextP.remove()
    }

    node.remove()

    const target =
      prevP &&
      prevP.tagName === 'P'
        ? prevP
        : nextP &&
          nextP.tagName === 'P'
          ? nextP
          : el

    const sel = window.getSelection()
    const range = document.createRange()

    if (target === el) {
      el.focus()

      range.selectNodeContents(el)
      range.collapse(false)
    } else {
      const focusNode =
        target.lastChild || target

      range.setStart(
        focusNode,
        focusNode.nodeType === Node.TEXT_NODE
          ? focusNode.textContent.length
          : 0,
      )

      range.collapse(true)
    }

    sel.removeAllRanges()
    sel.addRange(range)

    report()

    return true
  }, [report])

  // ── Scene break deletion ────────────────────────────────────────────────
  const handleSceneBreakDelete = useCallback((e) => {
    if (
      e.key !== 'Backspace' &&
      e.key !== 'Delete'
    ) {
      return false
    }

    const el = ref.current

    if (!el) return false

    const sel = window.getSelection()

    if (
      !sel ||
      !sel.rangeCount ||
      !sel.isCollapsed
    ) {
      return false
    }

    const anchor = sel.anchorNode

    let container =
      anchor?.nodeType === Node.TEXT_NODE
        ? anchor.parentElement
        : anchor

    if (!(container instanceof Element)) {
      container = el
    }

    const currentContainer = container instanceof Element ? container : el

    const previousBreak =
      currentContainer.previousElementSibling?.classList?.contains('scene-break')
        ? currentContainer.previousElementSibling
        : null

    const nextBreak =
      currentContainer.nextElementSibling?.classList?.contains('scene-break')
        ? currentContainer.nextElementSibling
        : null

    if (
      e.key === 'Backspace' &&
      previousBreak
    ) {
      e.preventDefault()

      return removeSceneBreak(
        previousBreak,
      )
    }

    if (
      e.key === 'Delete' &&
      nextBreak
    ) {
      e.preventDefault()

      return removeSceneBreak(
        nextBreak,
      )
    }

    const sceneBreak = container instanceof Element ? container.closest('.scene-break') : null

    if (sceneBreak) {
      e.preventDefault()

      return removeSceneBreak(sceneBreak)
    }

    return false
  }, [removeSceneBreak])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (handleSceneBreakDelete(e)) {
      return
    }

    if (e.key === 'Enter') {
      skipAnnotationRef.current = true

      clearTimeout(
        skipAnnotationTimer.current,
      )

      skipAnnotationTimer.current =
        setTimeout(() => {
          skipAnnotationRef.current = false
        }, 600)
    }

    if (applyMarkdownShortcut(e)) return

    const mod =
      e.ctrlKey ||
      e.metaKey

    if (!mod) return

    const k = e.key.toLowerCase()

    if (
      e.shiftKey &&
      k === 'e'
    ) {
      e.preventDefault()
      insertSceneBreak()
      return
    }

    if (
      k === 'enter' &&
      !e.shiftKey &&
      pageSize !== 'continuous'
    ) {
      e.preventDefault()
      insertPageBreak()
      return
    }

    switch (k) {
      case 'b':
        e.preventDefault()
        exec('bold')
        break

      case 'f':
        e.preventDefault()
        setFindOpen(true)
        break

      case 'i':
        e.preventDefault()
        exec('italic')
        break

      case 'u':
        e.preventDefault()
        exec('underline')
        break

      case '7':
        if (e.shiftKey) {
          e.preventDefault()
          exec('insertOrderedList')
        }
        break

      case '8':
        if (e.shiftKey) {
          e.preventDefault()
          exec('insertUnorderedList')
        }
        break

      case 'm':
        if (e.shiftKey) {
          e.preventDefault()
          formatBlock('blockquote')
        }
        break

      case 'h':
        if (e.shiftKey) {
          e.preventDefault()
          clearHighlight()
        }
        break

      case 'p':
        if (e.shiftKey && pageSize !== 'continuous') {
          e.preventDefault()
          insertPageBreak()
        }
        break

      case 'e':
        e.preventDefault()
        toggleHeading('h2')
        break

      case '1':
        e.preventDefault()
        toggleHeading('h2')
        break

      case '2':
        e.preventDefault()
        toggleHeading('h3')
        break

      case 'k':
        e.preventDefault()
        insertLink()
        break

      case 'd':
        if (e.shiftKey) {
          e.preventDefault()
          toggleDictation()
        }
        break

      case 's':
        e.preventDefault()
        onSave?.()
        break

      case 'z':
        e.preventDefault()
        execUndoRedo(
          e.shiftKey
            ? 'redo'
            : 'undo',
        )
        break

      case 'y':
        e.preventDefault()
        execUndoRedo('redo')
        break

      default:
        break
    }
  }, [
    exec,
    execUndoRedo,
    formatBlock,
    toggleHeading,
    insertSceneBreak,
    insertPageBreak,
    insertLink,
    toggleDictation,
    applyMarkdownShortcut,
    clearHighlight,
    onSave,
    handleSceneBreakDelete,
    pageSize,
  ])

  useEffect(() => () => {
    try {
      dictationRef.current?.stop?.()
    } catch {
      // Ignore shutdown races while unmounting the editor.
    }
  }, [])

  // ── Context menu ─────────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()

    const sel = window.getSelection()

    const sceneBreakTarget =
      e.target.closest?.(
        '.scene-break',
      )

    const hasSelection =
      sel &&
      !sel.isCollapsed &&
      ref.current?.contains(
        sel.anchorNode,
      )

    const selectedText =
      hasSelection
        ? sel
            .toString()
            .replace(/\s+/g, ' ')
            .trim()
        : ''

    const linkTarget = e.target instanceof Element ? e.target.closest('a[href]') : null
    const safeLink = linkTarget?.tagName === 'A'
      ? normalizeSafeLinkUrl(linkTarget.getAttribute('href'))
      : ''

    openContextMenu(e, [
      ...(safeLink
        ? [
            {
              label: 'Open link',
              icon: 'fa-solid fa-arrow-up-right-from-square',
              onClick: () => openSafeLink(safeLink),
            },
            {
              label: 'Copy link',
              icon: 'fa-regular fa-copy',
              onClick: () => navigator.clipboard?.writeText(safeLink),
            },
            {
              label: 'Edit link',
              icon: 'fa-solid fa-pen',
              onClick: () => {
                editingLinkRef.current = linkTarget
                setLinkDraft(safeLink)
                setLinkDialogOpen(true)
              },
            },
            {
              label: 'Remove link',
              icon: 'fa-solid fa-link-slash',
              onClick: () => {
                linkTarget.replaceWith(...linkTarget.childNodes)
                report()
              },
            },
            'divider',
          ]
        : []),
      ...(hasSelection
        ? [
            {
              label: 'Bold',
              icon: 'fa-solid fa-bold',
              onClick: () =>
                exec('bold'),
            },
            {
              label: 'Italic',
              icon: 'fa-solid fa-italic',
              onClick: () =>
                exec('italic'),
            },
            {
              label: 'Underline',
              icon: 'fa-solid fa-underline',
              onClick: () =>
                exec('underline'),
            },
            {
              label: 'Strikethrough',
              icon: 'fa-solid fa-strikethrough',
              onClick: () =>
                exec('strikeThrough'),
            },
            'divider',
          ]
        : []),

      {
        label: 'Heading 1',
        icon: 'fa-solid fa-heading',
        onClick: () =>
          toggleHeading('h2'),
      },

      {
        label: 'Heading 2',
        icon: 'fa-solid fa-heading',
        onClick: () =>
          toggleHeading('h3'),
      },

      {
        label: 'Normal text',
        icon: 'fa-solid fa-paragraph',
        onClick: () =>
          formatBlock('p'),
      },

      'divider',

      {
        label: 'Scene break',
        icon: 'fa-solid fa-minus',
        onClick: insertSceneBreak,
      },

      ...(sceneBreakTarget
        ? [
            {
              label: 'Remove scene break',
              icon: 'fa-solid fa-xmark',
              onClick: () =>
                removeSceneBreak(
                  sceneBreakTarget,
                ),
            },
          ]
        : []),

      ...(pageSize !== 'continuous'
        ? [
            {
              label: 'Insert page break',
              icon: 'fa-solid fa-file-circle-plus',
              onClick: insertPageBreak,
            },
          ]
        : []),

      ...(onComment &&
      hasSelection &&
      selectedText
        ? [
            'divider',
            {
              label: 'Add comment',
              icon: 'fa-regular fa-comment',
              onClick: addComment,
            },
          ]
        : []),

      'divider',

      {
        label: 'Copy',
        icon: 'fa-regular fa-copy',
        onClick: () =>
          exec('copy'),
        disabled: !hasSelection,
      },

      {
        label: 'Cut',
        icon: 'fa-solid fa-scissors',
        onClick: () =>
          exec('cut'),
        disabled: !hasSelection,
      },

      {
        label: 'Select all',
        icon: 'fa-solid fa-check-double',
        onClick: () =>
          exec('selectAll'),
      },

      'divider',

      {
        label: 'Undo',
        icon: 'fa-solid fa-rotate-left',
        onClick: () =>
          execUndoRedo('undo'),
      },

      {
        label: 'Redo',
        icon: 'fa-solid fa-rotate-right',
        onClick: () =>
          execUndoRedo('redo'),
      },
    ])
  }, [
    openContextMenu,
    exec,
    toggleHeading,
    formatBlock,
    insertSceneBreak,
    insertPageBreak,
    addComment,
    onComment,
    removeSceneBreak,
    pageSize,
    execUndoRedo,
    openSafeLink,
    report,
  ])

  // ── Toolbar handlers ─────────────────────────────────────────────────────
  const handleFontChange = useCallback((val) => {
    if (typographyTarget === 'title') {
      setTitleFontFamily(val)
      onTypographyChange({ chapterTitleStyle: { ...(typography?.chapterTitleStyle || {}), fontFamily: val } })
      return
    }
    setFontFamily(val)
    applyStyle('fontFamily', val)
    onTypographyChange({ bodyStyle: { ...(typography?.bodyStyle || {}), fontFamily: val } })
  }, [applyStyle, onTypographyChange, typography, typographyTarget])

  const handleSizeChange = useCallback((val) => {
    setFontSize(val)
    applyStyle(
      'fontSize',
      `${val}pt`,
    )
  }, [applyStyle])

  const handleTextColorChange = useCallback((value) => {
    if (typographyTarget === 'title') {
      const chapterTitleStyle = { ...(typography?.chapterTitleStyle || {}) }
      if (value) chapterTitleStyle.color = value
      else delete chapterTitleStyle.color
      onTypographyChange({ chapterTitleStyle })
      return
    }
    applyStyle('color', value)
  }, [applyStyle, onTypographyChange, typography, typographyTarget])

  const handleLineSpacingChange = useCallback((val) => {
    setLineSpacing(val)
    onLineSpacingChange?.(val)

    requestAnimationFrame(() => {
      recalcRef.current?.()
    })
  }, [onLineSpacingChange])

  // ── Save selection ───────────────────────────────────────────────────────
  const saveSelection = useCallback(() => {
    const sel = window.getSelection()

    if (
      sel &&
      sel.rangeCount
    ) {
      savedRange.current =
        sel.getRangeAt(0).cloneRange()
    }
  }, [])

  // ── Toolbar idle ─────────────────────────────────────────────────────────
  const resetToolbarActivity = useCallback(() => {
    setToolbarIdle(false)

    if (toolbarTimerRef.current) {
      clearTimeout(
        toolbarTimerRef.current,
      )
    }

    toolbarTimerRef.current =
      setTimeout(() => {
        setToolbarIdle(true)
      }, 2200)
  }, [])

  useEffect(() => {
    resetToolbarActivity()

    return () =>
      clearTimeout(
        toolbarTimerRef.current,
      )
  }, [resetToolbarActivity])

  // ── Toolbar button ───────────────────────────────────────────────────────
  const Btn = ({
    action,
    children,
    title: buttonTitle,
    ariaLabel,
    active = false,
    disabled = false,
  }: {
    action: () => void
    children: React.ReactNode
    title: string
    ariaLabel?: string
    active?: boolean
    disabled?: boolean
  }) => (
    <button
      className={`tb-btn${
        active
          ? ' tb-active'
          : ''
      }`}
      title={buttonTitle}
      aria-label={
        ariaLabel ||
        buttonTitle
      }
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) =>
        e.preventDefault()
      }
      onClick={disabled ? undefined : action}
    >
      {children}
    </button>
  )

  const pageOption = PAGE_SIZES.find((p) => p.id === pageSize) || PAGE_SIZES[0]
  const ps = pageSize === 'continuous'
    ? null
    : editorPageGeometry(pageSize, pageLayout?.pageMargin)

  return (
    <>
      <Modal open={linkDialogOpen} onClose={() => { setLinkDialogOpen(false); setLinkDraft('https://') }} title="Insert link" width={560} className="editor-link-modal">
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-[24px] border border-indigo-300/40 bg-[radial-gradient(circle_at_20%_20%,rgba(122,164,255,0.27),transparent_22%),radial-gradient(circle_at_80%_20%,rgba(170,130,255,0.25),transparent_18%),linear-gradient(135deg,#090d17_0%,#101a30_48%,#1a1b32_100%)] px-4 py-4 shadow-[0_24px_60px_rgba(72,78,180,0.22)]">
            <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.08)_50%,transparent_100%)] opacity-60" />
            <div className="relative flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-200/80 bg-[radial-gradient(circle_at_30%_30%,#dff4ff_0%,#8bc2ff_22%,#285ae8_55%,#0d173f_100%)] shadow-[0_0_28px_rgba(99,131,255,0.75)] animate-[pulse_3.2s_ease-in-out_infinite]">
                <span className="text-2xl text-white">◉</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.42em] text-indigo-200/80">moon import</div>
                <div className="mt-1 text-2xl font-black tracking-[-0.06em] text-white">Link import</div>
              </div>
            </div>
          </div>

          <label className="block text-left">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">Website URL</span>
            <input
              type="url"
              value={linkDraft}
              placeholder="https://example.com"
              onChange={(e) => setLinkDraft(e.target.value)}
              className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-base text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
              autoFocus
            />
          </label>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" className="rounded-full border border-slate-600/80 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800" onClick={() => { setLinkDialogOpen(false); setLinkDraft('https://') }}>
              Cancel
            </button>
            <button type="button" className="rounded-full bg-[linear-gradient(135deg,#9cc4ff_0%,#5f7efb_32%,#272369_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(90,102,255,0.45)] transition hover:translate-y-[-1px] hover:shadow-[0_14px_36px_rgba(90,102,255,0.5)]" onClick={applyLinkInsert}>
              Insert link
            </button>
          </div>
        </div>
      </Modal>
      {linkPopover && <div className="editor-link-popover" role="dialog" aria-label="Link actions" style={{ top: linkPopover.top, left: Math.max(8, linkPopover.left) }}>
        <div className="editor-link-popover-url"><Icon icon="fa-solid fa-link" /> <span title={linkPopover.href}>{linkPopover.text}</span></div>
        <div className="editor-link-popover-actions">
          <button type="button" onClick={() => openSafeLink(linkPopover.href)}><Icon icon="fa-solid fa-arrow-up-right-from-square" /> Open</button>
          <button type="button" onClick={() => { editingLinkRef.current = linkPopover.node; setLinkDraft(linkPopover.href); setLinkDialogOpen(true); setLinkPopover(null) }}><Icon icon="fa-solid fa-pen" /> Edit</button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(linkPopover.href)}><Icon icon="fa-regular fa-copy" /> Copy</button>
          <button type="button" onClick={() => removeLink(linkPopover.node)}><Icon icon="fa-solid fa-link-slash" /> Remove</button>
        </div>
      </div>}
    <div
      className="editor-shell"
      onMouseMove={
        resetToolbarActivity
      }
    >
      {findOpen && <div className="editor-find-bar" role="search" aria-label="Find and replace in chapter">
        <Icon icon="fa-solid fa-magnifying-glass" />
        <input autoFocus value={findQuery} onChange={(event) => { setFindQuery(event.target.value); findInChapter(event.target.value) }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); findInChapter(findQuery) } if (event.key === 'Escape') setFindOpen(false) }} placeholder="Find in this chapter…" aria-label="Find in this chapter" />
        <span className="editor-find-count">{findMatches ? `${findMatches} found` : findQuery ? 'Not found' : ''}</span>
        <input value={replaceQuery} onChange={(event) => setReplaceQuery(event.target.value)} placeholder="Replace with…" aria-label="Replace with" />
        <button type="button" className="button button-quiet" disabled={!currentFindRef.current || !findQuery.trim()} onClick={replaceCurrentMatch}>Replace</button>
        <button type="button" className="button button-quiet" disabled={!findQuery.trim() || !findMatches} onClick={replaceAllMatches}>Replace all</button>
        <button type="button" className="button button-quiet" onClick={() => { setFindOpen(false); setFindQuery(''); setFindMatches(0) }} aria-label="Close find"><Icon icon="fa-solid fa-xmark" /></button>
      </div>}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TOOLBAR                                                             */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      <div
        className={`editor-toolbar ${
          toolbarIdle
            ? 'is-idle'
            : ''
        }`}
        onMouseDown={(e) =>
          e.preventDefault()
        }
        onMouseMove={
          resetToolbarActivity
        }
      >
        {/* ── Row 1 ─────────────────────────────────────────────────────── */}
        <div className="tb-row">
          <Select
            value={String(typographyTarget === 'title' ? titleFontFamily : fontFamily)}
            onChange={(value) => handleFontChange(String(value))}
            ariaLabel="Font family"
            width={162}
            disabled={readOnly}
            onMouseDown={() => { saveSelection(); if (document.activeElement === titleRef.current) setTypographyTarget('title') }}
            renderLabel={(opt) => (
              <span
                style={{
                  fontFamily: String(opt?.value ?? ''),
                }}
              >
                {opt?.label ?? '—'}
              </span>
            )}
            options={editorFontOptions}
          />

          <Select
            value={fontSize}
            onChange={
              handleSizeChange
            }
            ariaLabel="Font size"
            width={62}
            disabled={readOnly}
            onMouseDown={
              saveSelection
            }
            options={FONT_SIZES.map(
              (s) => ({
                value: s,
                label: s,
              }),
            )}
          />

          <Select
            value={String(pageSize)}
            onChange={(v) => {
              const next = String(v)
              setPageSize(next)
              onPageLayoutChange?.({ pageSize: next })

              try {
                localStorage.setItem(
                  'moonscribe:pageSize',
                  next,
                )
              } catch {
                // Ignore storage failures.
              }

              requestAnimationFrame(
                () =>
                  recalcRef.current?.(),
              )
            }}
            ariaLabel="Page size"
            width={82}
            disabled={readOnly}
            options={PAGE_SIZES.map(
              (p) => ({
                value: p.id,
                label: p.label,
              }),
            )}
          />

          {ps && (
            <Select
              value={String(ps.marginMm)}
              onChange={(value) => {
                onPageLayoutChange?.({ pageMargin: Number(value) })
                requestAnimationFrame(() => recalcRef.current?.())
              }}
              ariaLabel="Page margins"
              width={104}
              disabled={readOnly}
              options={PAGE_MARGINS}
            />
          )}

          <Select
            value={lineSpacing}
            onChange={
              handleLineSpacingChange
            }
            ariaLabel="Line spacing"
            width={72}
            disabled={readOnly}
            options={LINE_SPACINGS.map(
              (s) => ({
                value: s.value,
                label: s.label,
              }),
            )}
          />

          <span className="tb-sep" />

          <Btn
            action={() =>
              exec('bold')
            }
            title="Bold (Ctrl+B)"
            ariaLabel="Bold"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-bold" />
          </Btn>

          <Btn
            action={() =>
              exec('italic')
            }
            title="Italic (Ctrl+I)"
            ariaLabel="Italic"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-italic" />
          </Btn>

          <Btn
            action={() =>
              exec('underline')
            }
            title="Underline (Ctrl+U)"
            ariaLabel="Underline"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-underline" />
          </Btn>

          <Btn
            action={() =>
              exec(
                'strikeThrough',
              )
            }
            title="Strikethrough"
            ariaLabel="Strikethrough"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-strikethrough" />
          </Btn>

          <Btn
            action={() =>
              exec('superscript')
            }
            title="Superscript"
            ariaLabel="Superscript"
            disabled={readOnly}
          >
            <span
              style={{
                fontSize:
                  '0.75em',
              }}
            >
              x²
            </span>
          </Btn>

          <Btn
            action={() =>
              exec('subscript')
            }
            title="Subscript"
            ariaLabel="Subscript"
            disabled={readOnly}
          >
            <span
              style={{
                fontSize:
                  '0.75em',
              }}
            >
              x₂
            </span>
          </Btn>

          <span className="tb-sep" />

          {/* Text colour */}
          <div
            className="tb-color-wrap"
            style={{
              position:
                'relative',
            }}
          >
          <button
              className="tb-btn tb-color-btn"
              title="Text colour"
              aria-label="Text colour"
              disabled={readOnly}
              onMouseDown={(e) => {
                e.preventDefault()
                saveSelection()
              }}
              onClick={() =>
                setColorPop(
                  (p) =>
                    p === 'text'
                      ? null
                      : 'text',
                )
              }
            >
              <Icon icon="fa-solid fa-font" />

              <span className="tb-color-stripe tb-color-stripe-text" />
            </button>

            {colorPop ===
              'text' && (
              <div className="tb-color-pop">
                <div className="tb-color-label">
                  Text colour
                </div>

                <div className="tb-color-swatches">
                  {TEXT_COLORS.map(
                    (c) => (
                      <button
                        key={c}
                        className="tb-swatch"
                        style={{
                          background:
                            c,
                          border:
                            c ===
                            '#ffffff'
                              ? '1px solid var(--border)'
                              : undefined,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          saveSelection()
                        }}
                        onClick={() => {
                          handleTextColorChange(c)

                          setColorPop(
                            null,
                          )
                        }}
                        disabled={readOnly}
                        aria-label={c}
                        title={c}
                      />
                    ),
                  )}
                </div>

                <button
                  className="tb-swatch-clear"
                  onMouseDown={(e) =>
                    e.preventDefault()
                  }
                  onClick={() => {
                    handleTextColorChange('')

                    setColorPop(
                      null,
                    )
                  }}
                  disabled={readOnly}
                >
                  Remove colour
                </button>
              </div>
            )}
          </div>

          {/* Highlight */}
          <div
            className="tb-color-wrap"
            style={{
              position:
                'relative',
            }}
          >
            <button
              className="tb-btn tb-color-btn"
              title="Highlight"
              aria-label="Highlight"
              disabled={readOnly}
              onMouseDown={(e) => {
                e.preventDefault()
                saveSelection()
              }}
              onClick={() =>
                setColorPop(
                  (p) =>
                    p ===
                    'highlight'
                      ? null
                      : 'highlight',
                )
              }
            >
              <Icon icon="fa-solid fa-highlighter" />

              <span className="tb-color-stripe tb-color-stripe-hl" />
            </button>

            {colorPop ===
              'highlight' && (
              <div className="tb-color-pop">
                <div className="tb-color-label">
                  Highlight
                </div>

                <div className="tb-color-swatches tb-color-swatches-lg">
                  {HIGHLIGHT_COLORS.map(
                    (c) => (
                      <button
                        key={c}
                        className="tb-swatch"
                        style={{
                          background:
                            c ===
                            'transparent'
                              ? 'repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 50% / 8px 8px'
                              : c,
                          border:
                            '1px solid var(--border)',
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          saveSelection()
                        }}
                        onClick={() => {
                          if (c === 'transparent') {
                            clearHighlight()
                          } else {
                            applyStyle('backgroundColor', c)
                          }

                          setColorPop(
                            null,
                          )
                        }}
                        disabled={readOnly}
                        title={
                          c ===
                          'transparent'
                            ? 'Remove highlight'
                            : c
                        }
                        aria-label={
                          c ===
                          'transparent'
                            ? 'Remove highlight'
                            : c
                        }
                      />
                    ),
                  )}
                </div>

                <div
                  style={{
                    display:
                      'flex',
                    alignItems:
                      'center',
                    gap: 6,
                    marginTop: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize:
                        '0.75rem',
                      color:
                        'var(--grey)',
                    }}
                  >
                    Custom
                  </span>

                  <input
                    type="color"
                    className="tb-custom-color"
                    defaultValue="#fff7a8"
                    onMouseDown={(e) =>
                      e.stopPropagation()
                    }
                    disabled={readOnly}
                    onChange={(e) =>
                      applyStyle(
                        'backgroundColor',
                        e.target
                          .value,
                      )
                    }
                  />

                  <button
                    className="tb-swatch-clear"
                    style={{
                      marginTop: 0,
                    }}
                    onMouseDown={(e) =>
                      e.preventDefault()
                    }
                    onClick={() => {
                      clearHighlight()

                      setColorPop(
                        null,
                      )
                    }}
                    disabled={readOnly}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          <span className="tb-sep" />

          <div
            className="tb-ai-wrap"
            style={{
              position:
                'relative',
            }}
          >
            <button
              className="tb-btn tb-btn-ai"
              title="AI actions for selected text"
              aria-label="AI actions"
              disabled={readOnly}
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() => {}}
            >
              AI
            </button>
          </div>

          {dictationSupported && (
            <Btn
              action={toggleDictation}
              title={dictating ? 'Stop dictation (Ctrl+Shift+D)' : 'Start dictation (Ctrl+Shift+D)'}
              ariaLabel={dictating ? 'Stop dictation' : 'Start dictation'}
              active={dictating}
              disabled={readOnly}
            >
              <Icon icon={dictating ? 'fa-solid fa-wave-square' : 'fa-solid fa-microphone'} />
            </Btn>
          )}

          <Btn
            action={() =>
              exec('removeFormat')
            }
            title="Clear formatting"
            ariaLabel="Clear formatting"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-text-slash" />
          </Btn>

          {onDesigns && (
            <>
              <span className="tb-sep" />

              <button
                className="tb-btn tb-btn-designs"
                title="Designs — premade styles for your manuscript"
                aria-label="Designs"
                disabled={readOnly}
                onMouseDown={(e) =>
                  e.preventDefault()
                }
                onClick={onDesigns}
              >
                <Icon icon="fa-solid fa-palette" />
                <span>
                  Designs
                </span>
              </button>
            </>
          )}
        </div>

        {/* ── Row 2 ─────────────────────────────────────────────────────── */}
        <div className="tb-row">
          <Btn
            action={() =>
              toggleHeading('h2')
            }
            title="Heading 1 (Ctrl+1)"
            ariaLabel="Heading 1"
            disabled={readOnly}
          >
            H1
          </Btn>

          <Btn
            action={() =>
              toggleHeading('h3')
            }
            title="Heading 2 (Ctrl+2)"
            ariaLabel="Heading 2"
            disabled={readOnly}
          >
            H2
          </Btn>

          <Btn
            action={() =>
              toggleHeading('h4')
            }
            title="Heading 3"
            ariaLabel="Heading 3"
            disabled={readOnly}
          >
            H3
          </Btn>

          <Btn
            action={() =>
              formatBlock('p')
            }
            title="Normal text"
            ariaLabel="Normal text"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-paragraph" />
          </Btn>

          <Btn
            action={() =>
              formatBlock(
                'blockquote',
              )
            }
            title="Block quote"
            ariaLabel="Block quote"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-quote-left" />
          </Btn>

          <span className="tb-sep" />

          <Btn
            action={() =>
              exec(
                'insertUnorderedList',
              )
            }
            title="Bullet list"
            ariaLabel="Bullet list"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-list-ul" />
          </Btn>

          <Btn
            action={() =>
              exec(
                'insertOrderedList',
              )
            }
            title="Numbered list"
            ariaLabel="Numbered list"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-list-ol" />
          </Btn>

          <Btn
            action={() =>
              exec('indent')
            }
            title="Indent"
            ariaLabel="Indent"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-indent" />
          </Btn>

          <Btn
            action={() =>
              exec('outdent')
            }
            title="Outdent"
            ariaLabel="Outdent"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-outdent" />
          </Btn>

          <span className="tb-sep" />

          <Btn
            action={() =>
              exec('justifyLeft')
            }
            title="Align left"
            ariaLabel="Align left"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-align-left" />
          </Btn>

          <Btn
            action={() =>
              exec('justifyCenter')
            }
            title="Align centre"
            ariaLabel="Align centre"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-align-center" />
          </Btn>

          <Btn
            action={() =>
              exec('justifyRight')
            }
            title="Align right"
            ariaLabel="Align right"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-align-right" />
          </Btn>

          <Btn
            action={() =>
              exec('justifyFull')
            }
            title="Justify"
            ariaLabel="Justify"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-align-justify" />
          </Btn>

          <span className="tb-sep" />

          <Btn
            action={insertLink}
            title="Insert link (Ctrl+K)"
            ariaLabel="Insert link"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-link" />
          </Btn>

          {libraryImages.length > 0 && <div className="editor-media-picker" title="Insert image from Media Library">
            <button type="button" className="editor-media-icon" aria-label="Open Media Library images" onClick={() => setMediaOpen((open) => !open)}><Icon icon="fa-regular fa-image" /></button>
            {mediaOpen && <div className="editor-media-popover"><strong>Media Library</strong><div>{libraryImages.map((item) => <button type="button" key={item.id} onClick={() => { insertLibraryImage(item.id); setMediaOpen(false) }}><img src={item.image} alt="" /><span>{item.text || 'Untitled image'}</span></button>)}</div></div>}
          </div>}

          <div className="editor-media-picker editor-template-picker" title="Page templates">
            <button type="button" className="editor-media-icon" aria-label="Open page templates" onClick={() => onDesigns?.()}><Icon icon="fa-solid fa-file-lines" /></button>
            {pageTemplatesOpen && <div className="editor-media-popover editor-page-template-popover"><strong>Page templates</strong><div>{PAGE_TEMPLATES.map((template) => <button type="button" key={template.id} draggable onDragStart={(event) => { event.dataTransfer.setData(TEMPLATE_MIME, template.id); event.dataTransfer.effectAllowed = 'copy' }} onClick={() => insertPageTemplate(template.id)}><span>{template.icon}</span><span><b>{template.title}</b><small>{template.description}</small></span></button>)}</div></div>}
          </div>

          <Btn
            action={insertSceneBreak}
            title="Scene break (Ctrl+Shift+E)"
            ariaLabel="Scene break"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-ellipsis" />
          </Btn>

          {pageSize !==
            'continuous' && (
            <>
              <Btn action={insertPageBreak} title="Manual page break (Ctrl+Enter)" ariaLabel="Insert manual page break" disabled={readOnly}>
                <Icon icon="fa-solid fa-file-circle-plus" />
              </Btn>
              <Btn action={recalculatePageBreaks} title="Recalculate automatic page breaks" ariaLabel="Recalculate automatic page breaks" disabled={readOnly}>
                <Icon icon="fa-solid fa-arrows-rotate" />
              </Btn>
            </>
          )}

          {onComment && (
            <>
              <span className="tb-sep" />

              <Btn
                action={addComment}
                title="Comment on selected text"
                ariaLabel="Add comment"
              >
                <Icon icon="fa-regular fa-comment-dots" />
              </Btn>
            </>
          )}

          <span className="tb-sep" />

          <Btn
            action={() =>
              execUndoRedo('undo')
            }
            title="Undo (Ctrl+Z)"
            ariaLabel="Undo"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-rotate-left" />
          </Btn>

          <Btn
            action={() =>
              execUndoRedo('redo')
            }
            title="Redo (Ctrl+Y)"
            ariaLabel="Redo"
            disabled={readOnly}
          >
            <Icon icon="fa-solid fa-rotate-right" />
          </Btn>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* EDITOR                                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      <div className="editor-wrap-outer">
        <div
          className="editor-wrap"
          ref={wrapRef}
        >
          <div className="editor-desk">
            <div
              className={`editor-canvas${
                ps
                  ? ' editor-canvas-paged'
                  : ''
              }`}
              style={{
                ...(ps
                  ? {
                      width: ps.widthPx,
                      minHeight:
                        ps.heightPx,
                      '--pg-width': `${ps.widthPx}px`,
                      '--pg-height': `${ps.heightPx}px`,
                      '--pg-body-h': `${ps.bodyHeightPx}px`,
                      '--page-margin-top': `${ps.marginTopPx}px`,
                      '--page-margin-right': `${ps.marginRightPx}px`,
                      '--page-margin-bottom': `${ps.marginBottomPx}px`,
                      '--page-margin-left': `${ps.marginLeftPx}px`,
                    }
                  : {}),
                '--editor-line-height': lineSpacing,
                '--editor-font-size': ps ? '12pt' : undefined,
              } as React.CSSProperties}
            >
              {/* ── Chapter title ─────────────────────────────────────── */}
              {title !==
                undefined && (
                <div className="editor-head">
                  <textarea
                    ref={titleRef}
                    className="chapter-edit-title"
                    style={{
                      fontFamily: titleFontFamily,
                      color: typography?.chapterTitleStyle?.color,
                    }}
                    value={title}
                    rows={1}
                    aria-label="Chapter title"
                    onChange={(e) => {
                      resizeChapterTitle()
                      onTitleChange?.(
                        e.target.value,
                      )
                    }}
                    onFocus={() => setTypographyTarget('title')}
                    onBlur={() =>
                      onTitleBlur?.()
                    }
                    placeholder="Chapter title…"
                    onContextMenu={(
                      e,
                    ) => {
                      e.preventDefault()
                      e.stopPropagation()

                      const inp =
                        e.currentTarget

                      const hasSel =
                        inp.selectionStart !==
                        inp.selectionEnd

                      openContextMenu(
                        e,
                        [
                          {
                            label: 'Cut',
                            icon: 'fa-solid fa-scissors',
                            onClick:
                              () => {
                                inp.focus()
                                document.execCommand(
                                  'cut',
                                )
                              },
                            disabled:
                              !hasSel,
                          },

                          {
                            label: 'Copy',
                            icon: 'fa-regular fa-copy',
                            onClick:
                              () => {
                                inp.focus()
                                document.execCommand(
                                  'copy',
                                )
                              },
                            disabled:
                              !hasSel,
                          },

                          {
                            label: 'Paste',
                            icon: 'fa-solid fa-paste',
                            onClick:
                              () => {
                                inp.focus()
                                document.execCommand(
                                  'paste',
                                )
                              },
                          },

                          'divider',

                          {
                            label: 'Select all',
                            icon: 'fa-solid fa-check-double',
                            onClick:
                              () => {
                                inp.focus()
                                inp.select()
                              },
                          },

                          'divider',

                          {
                            label: 'Undo',
                            icon: 'fa-solid fa-rotate-left',
                            onClick:
                              () =>
                                execUndoRedo(
                                  'undo',
                                ),
                          },

                          {
                            label: 'Redo',
                            icon: 'fa-solid fa-rotate-right',
                            onClick:
                              () =>
                                execUndoRedo(
                                  'redo',
                                ),
                          },
                        ],
                      )
                    }}
                  />
                </div>
              )}

              {/* ── One continuous editor ─────────────────────────────── */}
              <div
                ref={ref}
                className="prose"
                contentEditable={!readOnly}
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="Manuscript editor"
                aria-readonly={readOnly}
                spellCheck={!readOnly && spellCheck}
                autoCorrect={autoCorrect ? 'on' : 'off'}
                autoCapitalize="sentences"
                data-placeholder={
                  placeholder ||
                  'The first sentence is the hardest. Start anywhere.'
                }
                onInput={report}
                onFocus={() => { setTypographyTarget('body'); onEditorFocus() }}
                onClick={handleEditorClick}
                onBeforeInput={ensureCaretInTextBlock}
                onBlur={() => { report(); onEditorBlur() }}
                onPaste={handlePaste}
                onKeyDown={
                  handleKeyDown
                }
                onContextMenu={
                  handleContextMenu
                }
                onDragOver={(e) => {
                  if (
                    e.dataTransfer.types.includes(
                      'Files',
                    )
                  ) {
                    e.preventDefault()
                  }
                }}
                onDrop={
                  handleTemplateOrImageDrop
                }
                onMouseOver={(e) => {
                  const target = e.target instanceof Element ? e.target : null
                  const commentSpan = target?.closest('.comment-anchor') as HTMLElement | null

                  if (commentSpan) {
                    onCommentHover?.(
                      commentSpan.dataset.commentId || null,
                    )
                    setCharTip(null)
                    setEntityTip(null)
                    return
                  }

                  const nameSpan = target?.closest('.hl-name') as HTMLElement | null

                  if (nameSpan) {
                    setEntityTip(null)

                    const char = charactersRef.current.find((c) => c.id === nameSpan.dataset.charId)

                    if (char) {
                      const rect = nameSpan.getBoundingClientRect()

                      setCharTip({
                        char,
                        x: Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2)),
                        y: Math.max(150, rect.top),
                      })
                    }

                    return
                  }

                  const entitySpan = target?.closest('.hl-entity') as HTMLElement | null

                  if (entitySpan) {
                    setCharTip(null)

                    const entity = entitiesRef.current.find((en) => en.id === entitySpan.dataset.entityId)

                    if (entity) {
                      const rect = entitySpan.getBoundingClientRect()

                      setEntityTip({
                        entity,
                        x: Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2)),
                        y: Math.max(150, rect.top),
                      })
                    }

                    return
                  }

                  setCharTip(null)
                  setEntityTip(
                    null,
                  )
                }}
                onMouseOut={(e) => {
                  const target = e.target instanceof Element ? e.target : null
                  const related = e.relatedTarget instanceof Element ? e.relatedTarget : null

                  if (target?.closest('.comment-anchor')) {
                    onCommentHover?.(null)
                  }

                  if (!related?.closest('.char-tip')) {
                    setCharTip(null)
                  }

                  if (!related?.closest('.entity-tip')) {
                    setEntityTip(null)
                  }
                }}
              />

              {liveCollaborators.length > 0 && (
                <div className="editor-presence-layer" aria-hidden="true">
                  {liveCollaborators.map((person) => (
                    <div
                      key={person.id}
                      className={`editor-presence-marker ${person.activity === 'writing' ? 'is-writing' : 'is-viewing'}`}
                      style={{ '--presence-color': person.color, '--presence-top': `${person.topRatio * 100}%` } as React.CSSProperties}
                    >
                      <span className="editor-presence-stripe" />
                      <span className="editor-presence-bubble">{person.shortLabel}</span>
                      <span className="editor-presence-label">
                        <b>{person.username || 'Collaborator'}</b>
                        <small>{person.activity === 'writing' ? 'Writing' : 'Viewing'}{person.lineNumber ? ` · line ${person.lineNumber}` : ''}</small>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Page information ─────────────────────────────────── */}
              {pageSize !==
                'continuous' && (
                <div
                  className="editor-page-status"
                  aria-live="polite"
                >
                  <span>
                    {pageOption.label}
                  </span>

                  <span>
                    {pageCount}{' '}
                    {pageCount ===
                    1
                      ? 'page'
                      : 'pages'}
                  </span>
                  <span className="editor-page-status-auto">Automatic pagination</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <ScrollRail
          scrollElRef={
            wrapRef
          }
          markers={liveCollaborators}
        />
      </div>

      {/* ── Colour popover backdrop ─────────────────────────────────────── */}
      {colorPop && (
        <div
          style={{
            position:
              'fixed',
            inset: 0,
            zIndex: 998,
          }}
          onMouseDown={() =>
            setColorPop(null)
          }
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CHARACTER TOOLTIP                                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {charTip &&
        (() => {
          const c =
            charTip.char

          const initials = (
            c.name || '?'
          )
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(
              (w) => w[0],
            )
            .join('')
            .toUpperCase()

          const baseColor =
            c.color ||
            '#8a6a52'

          const stats = [
            c.age,
            c.gender,
            c.species,
          ].filter(Boolean)

          const hasDetails = Boolean(
            stats.length ||
            c.bio ||
            c.appearance ||
            c.motivation ||
            c.occupation,
          )
          const hasRole = Boolean(c.role)

          return (
            <div
              className={`char-tip ${hasDetails ? '' : 'compact'} ${hasRole ? '' : 'no-role'}`}
              style={{
                '--ctip-color': baseColor,
                left: charTip.x,
                top: charTip.y,
              } as React.CSSProperties}
              onMouseLeave={() =>
                setCharTip(null)
              }
            >
              <div className="char-tip-banner">
                <div
                  className="char-tip-banner-bg"
                  style={{
                    background: `linear-gradient(135deg, ${baseColor}cc 0%, ${baseColor}44 100%)`,
                  }}
                />

                <div className="char-tip-avatar-wrap">
                  {c.portrait ? (
                    <img
                      src={
                        c.portrait
                      }
                      alt={
                        c.name
                      }
                      className="char-tip-portrait"
                    />
                  ) : (
                    <div
                      className="char-tip-initials"
                      style={{
                        background:
                          baseColor,
                      }}
                    >
                      {
                        initials
                      }
                    </div>
                  )}
                </div>

                <div className="char-tip-header-text">
                  <div className="char-tip-name">
                    {c.name}
                  </div>

                  {c.role && (
                    <div className="char-tip-role">
                      {
                        c.role
                      }
                    </div>
                  )}
                </div>
              </div>

              {stats.length >
                0 && (
                <div className="char-tip-stats">
                  {stats.map(
                    (
                      s,
                      i,
                    ) => (
                      <span
                        key={i}
                        className="char-tip-chip"
                      >
                        {s}
                      </span>
                    ),
                  )}
                </div>
              )}

              {(c.bio ||
                c.appearance ||
                c.motivation) && (
                <div className="char-tip-excerpt">
                  {(
                    c.bio ||
                    c.appearance ||
                    c.motivation ||
                    ''
                  ).slice(
                    0,
                    120,
                  )}

                  {(
                    c.bio ||
                    c.appearance ||
                    c.motivation ||
                    ''
                  ).length >
                  120
                    ? '…'
                    : ''}
                </div>
              )}

              {c.occupation && (
                <div className="char-tip-occupation">
                  <i
                    className="fa-solid fa-briefcase"
                    style={{
                      fontSize:
                        '0.7rem',
                      opacity:
                        0.6,
                    }}
                  />

                  {
                    c.occupation
                  }
                </div>
              )}

              <div className="story-tip-foot">
                <span><i className="fa-solid fa-user" /> Character</span>
                <span>{hasDetails ? 'Story profile' : 'Profile details not added yet'}</span>
              </div>
            </div>
          )
        })()}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* ENTITY TOOLTIP                                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {entityTip &&
        (() => {
          const entity =
            entityTip.entity

          const KIND_ICONS = {
            faction:
              'fa-solid fa-shield-halved',
            artefact:
              'fa-solid fa-gem',
            place:
              'fa-solid fa-location-dot',
          }

          const KIND_LABELS = {
            faction:
              'Faction',
            artefact:
              'Artefact',
            place:
              'Place',
          }

          const color =
            entity.color ||
            '#7B9EBF'

          const meta = entity.kind === 'faction'
            ? entity.allegiance
            : entity.kind === 'artefact'
              ? entity.origin
              : entity.kind === 'place'
                ? entity.region
                : null

          return (
            <div
              className="entity-tip"
              style={{
                '--etip-color': color,
                left: entityTip.x,
                top: entityTip.y,
              } as React.CSSProperties}
              onMouseLeave={() =>
                setEntityTip(
                  null,
                )
              }
            >
              <div
                className="entity-tip-banner"
                style={{
                  background: `linear-gradient(135deg, ${color}cc 0%, ${color}44 100%)`,
                }}
              >
                <div
                  className="entity-tip-icon"
                  style={{
                    background:
                      color,
                  }}
                >
                  <i
                    className={
                      KIND_ICONS[
                        entity.kind
                      ] ||
                      'fa-solid fa-circle'
                    }
                  />
                </div>

                <div className="entity-tip-header-text">
                  <div className="entity-tip-name">
                    {
                      entity.name
                    }
                  </div>

                  <div className="entity-tip-kind">
                    {KIND_LABELS[
                      entity.kind
                    ] ||
                      entity.kind}
                  </div>
                </div>
              </div>

              {entity.notes && (
                <div className="entity-tip-excerpt">
                  {entity.notes.slice(
                    0,
                    140,
                  )}

                  {entity.notes
                    .length >
                  140
                    ? '…'
                    : ''}
                </div>
              )}

              {meta && <div className="entity-tip-meta"><i className={KIND_ICONS[entity.kind]} /> {meta}</div>}

              <div className="story-tip-foot">
                <span><i className={KIND_ICONS[entity.kind] || 'fa-solid fa-circle'} /> {KIND_LABELS[entity.kind] || 'Story entity'}</span>
                <span>{entity.notes || meta ? 'World profile' : 'Profile details not added yet'}</span>
              </div>
            </div>
          )
        })()}
    </div>
    </>
  )
}
