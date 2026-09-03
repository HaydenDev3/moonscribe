import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ComponentType } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { defaultLayout, getNovel, updateNovel } from '../db/novels'
import { listChapters } from '../db/chapters'
import { useApp } from '../context/AppContext'
import SubPageTopbar from '../components/SubPageTopbar'
import Select from '../components/Select'
import { designById, DESIGN_MIME } from '../designs/registry'
import { GALLERY, resolveCoverImageUrl } from '../designs/gallery'
import { htmlToText } from '../utils/htmlToText'
import { downloadBlob } from '../utils/download'
import { PAGE_PRESETS, pageSizeMm } from '../utils/pageSize'
import Icon from '../components/Icon'
import { sanitizeStoredHtml } from '../utils/formatHtml'
import { buildBookPreview } from '../utils/bookPreview'
import { fileToDataUrl } from '../db/moodboard'
import { coverGeometry } from '../utils/coverGeometry'
import { buildDesignerFontOptions } from '../utils/fonts'
import { useContextMenu } from '../components/ContextMenu'
import { clearPresence, subscribePresence, updatePresence } from '../sync/engine'
import { listMoodboard } from '../db/moodboard'
import { ASSET_MIME } from '../designs/assets'
import { PAGE_TEMPLATES } from '../designs/pageTemplates'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'

// ─── constants ────────────────────────────────────────────────────────────────

const SCENE_BREAKS = ['❦', '✦', '◆', '✧', '❧', '❋', '✴', '❖', '—', '*', ' ']
const BODY_SIZES   = ['10.5', '11.5', '12.5', '14']
const BOOK_ENVIRONMENTS = [
  { value: 'studio', label: 'Moonlit studio' },
  { value: 'library', label: 'Old library' },
  { value: 'window', label: 'Window light' },
  { value: 'forest', label: 'Forest dusk' },
  { value: 'night', label: 'Night table' },
  { value: 'atelier', label: 'Sunlit atelier' },
  { value: 'greenhouse', label: 'Glass greenhouse' },
  { value: 'observatory', label: 'Observatory' },
  { value: 'parlour', label: 'Velvet parlour' },
  { value: 'cabin', label: 'Writer’s cabin' },
]
const BOOK_SIZE_OPTIONS = PAGE_PRESETS.map((preset) => ({
  value: preset.key,
  label: preset.label,
}))

const ORNAMENT_LIBRARY = [
  { group: 'Floral',   items: ['❦', '❧', '❋', '✿', '❀', '✾'] },
  { group: 'Fantasy',  items: ['✦', '✧', '❖', '✴', '◈', '⬡'] },
  { group: 'Royal',    items: ['♕', '♛', '⚜', '♔', '♚', '⚝'] },
  { group: 'Mystical', items: ['☽', '☾', '⁂', '☆', '★', '✯'] },
  { group: 'Minimal',  items: ['·', '—', '•', '◆', '◇', '∗'] },
  { group: 'None',     items: [''] },
]

const CHAPTER_STYLES = [
  { id: 'centered',  label: 'Centered' },
  { id: 'left',      label: 'Left aligned' },
  { id: 'ornament',  label: 'With ornament' },
  { id: 'num-title', label: 'Number + Title' },
  { id: 'num-only',  label: 'Number only' },
  { id: 'title-only',label: 'Title only' },
  { id: 'roman',     label: 'Roman numerals' },
]

const ATMOSPHERES = [
  { id: 'classic-fantasy',  label: 'Classic Fantasy',  bodyFont: 'cormorant', chapterStyle: 'ornament', sceneBreak: '❦', dropCap: true, ornament: '❧', pageNumStyle: 'ornament', headerStyle: 'chapter' },
  { id: 'dark-fantasy',     label: 'Dark Fantasy',     bodyFont: 'literata',  chapterStyle: 'centered', sceneBreak: '◆', dropCap: true, ornament: '◆', pageNumStyle: 'plain',    headerStyle: 'title' },
  { id: 'high-fantasy',     label: 'High Fantasy',     bodyFont: 'cormorant', chapterStyle: 'num-title',sceneBreak: '✦', dropCap: true, ornament: '✦', pageNumStyle: 'ornament', headerStyle: 'chapter' },
  { id: 'fairy-tale',       label: 'Fairy Tale',       bodyFont: 'cormorant', chapterStyle: 'centered', sceneBreak: '✧', dropCap: true, ornament: '✧', pageNumStyle: 'ornament', headerStyle: 'title' },
  { id: 'gothic',           label: 'Gothic Fantasy',   bodyFont: 'literata',  chapterStyle: 'centered', sceneBreak: '✴', dropCap: true, ornament: '✴', pageNumStyle: 'plain',    headerStyle: 'title' },
  { id: 'romantic-fantasy', label: 'Romantic Fantasy', bodyFont: 'cormorant', chapterStyle: 'centered', sceneBreak: '❧', dropCap: true, ornament: '❧', pageNumStyle: 'ornament', headerStyle: 'title-author' },
  { id: 'whimsical',        label: 'Whimsical',        bodyFont: 'cormorant', chapterStyle: 'centered', sceneBreak: '✿', dropCap: false,ornament: '✿', pageNumStyle: 'plain',    headerStyle: 'title' },
  { id: 'ancient',          label: 'Ancient / Mythic', bodyFont: 'cormorant', chapterStyle: 'ornament', sceneBreak: '❋', dropCap: true, ornament: '❋', pageNumStyle: 'ornament', headerStyle: 'chapter' },
  { id: 'literary',         label: 'Literary',         bodyFont: 'georgia',   chapterStyle: 'left',     sceneBreak: '—', dropCap: false,ornament: '',  pageNumStyle: 'plain',    headerStyle: 'title-author' },
  { id: 'minimal',          label: 'Minimal',          bodyFont: 'literata',  chapterStyle: 'title-only',sceneBreak: '*',dropCap: false, ornament: '',  pageNumStyle: 'plain',    headerStyle: 'none' },
]

const LINE_SPACINGS_BODY = [
  { id: '1.3', label: '1.3×' },
  { id: '1.5', label: '1.5×' },
  { id: '1.6', label: '1.6×' },
  { id: '1.8', label: '1.8×' },
  { id: '2.0', label: 'Double' },
]

const TEXT_ALIGNS = [
  { id: 'left',    label: 'Left' },
  { id: 'justify', label: 'Justified' },
]

const FIRST_INDENTS = [
  { id: '0',      label: 'None' },
  { id: '1.5em',  label: '1.5 em' },
  { id: '2em',    label: '2 em' },
  { id: '2.5em',  label: '2.5 em' },
]

const HEADER_STYLES = [
  { id: 'none',         label: 'None' },
  { id: 'title',        label: 'Book title' },
  { id: 'author',       label: 'Author / byline' },
  { id: 'chapter',      label: 'Chapter title' },
  { id: 'title-author', label: 'Title · Author' },
]

const PAGE_NUMBER_STYLES = [
  { id: 'none',     label: 'None' },
  { id: 'plain',    label: 'Plain number' },
  { id: 'ornament', label: 'With ornaments' },
]

const PAGE_NUMBER_POS = [
  { id: 'bottom-center', label: 'Bottom centre' },
  { id: 'bottom-outer',  label: 'Bottom outer' },
  { id: 'top-outer',     label: 'Top outer' },
]

const DESIGN_WORKFLOWS = [
  { key: 'start', label: 'Start', icon: 'fa-solid fa-sparkles', description: 'Choose a visual direction' },
  { key: 'cover', label: 'Cover', icon: 'fa-solid fa-book', description: 'Design the full wrap' },
  { key: 'interior', label: 'Interior', icon: 'fa-solid fa-file-lines', description: 'Shape the reading experience' },
  { key: 'polish', label: 'Polish', icon: 'fa-solid fa-wand-magic-sparkles', description: 'Check consistency and print safety' },
  { key: 'export', label: 'Export', icon: 'fa-solid fa-box-archive', description: 'Prepare a publish-ready file' },
]

const PREVIEW_MODES = [
  { key: 'cover', label: '3D book', icon: 'fa-solid fa-cube' },
  { key: 'interior', label: 'Interior', icon: 'fa-solid fa-file-lines' },
  { key: 'flat-wrap', label: 'Flat wrap', icon: 'fa-solid fa-panorama' },
  { key: 'comparison', label: 'Compare', icon: 'fa-solid fa-code-compare' },
]

function preflightDesigner({ novel, layout, cover, chapters, measurements }) {
  const issues = []
  if (!novel?.title?.trim()) issues.push({ severity: 'blocking', label: 'Missing book title', detail: 'Add a title before exporting the cover.' })
  if (!cover.frontImage && !cover.frontColor) issues.push({ severity: 'attention', label: 'Front cover needs artwork', detail: 'Choose an image or a cover color for the front.' })
  if (!cover.backImage && !cover.backColor && !novel?.blurb?.trim()) issues.push({ severity: 'advisory', label: 'Back cover is empty', detail: 'Add a blurb or back-cover artwork for a complete wrap.' })
  if (!layout.bodyFont) issues.push({ severity: 'advisory', label: 'Interior font is using the default', detail: 'Review the body type before export.' })
  if (!chapters?.length) issues.push({ severity: 'attention', label: 'No chapters found', detail: 'Add at least one chapter to preview interior pagination.' })
  if (measurements?.pages > 0 && measurements.pages < 24) issues.push({ severity: 'advisory', label: 'Short print run', detail: 'This book is under 24 pages; check the spine and print requirements.' })
  return issues
}

type DesignerFontOption = {
  value: string
  label?: string
  style?: { fontFamily?: string }
}

type PageBlock = {
  tag: string
  html: string
  words: number
}

const SECTIONS = [
  { key: 'cover',     label: 'Cover text',    icon: 'fa-solid fa-book',                group: 'Cover' },
  { key: 'palette',   label: 'Palette',       icon: 'fa-solid fa-swatchbook',          group: 'Cover' },
  { key: 'effects',   label: 'Text effects',  icon: 'fa-solid fa-text-height',         group: 'Cover' },
  { key: 'image',     label: 'Cover image',   icon: 'fa-regular fa-image',             group: 'Cover' },
  { key: 'media',     label: 'Media library', icon: 'fa-regular fa-images',            group: 'Cover' },
  { key: 'shapes',    label: 'Ornaments',     icon: 'fa-solid fa-shapes',              group: 'Cover' },
  { key: 'atmosphere', label: 'Atmosphere',    icon: 'fa-solid fa-hat-wizard',          group: 'Pages' },
  { key: 'body',       label: 'Body text',     icon: 'fa-solid fa-font',               group: 'Pages' },
  { key: 'headers',    label: 'Headers & pages', icon: 'fa-solid fa-bookmark',        group: 'Pages' },
  { key: 'title',      label: 'Title page',    icon: 'fa-solid fa-heading',            group: 'Pages' },
  { key: 'signature',  label: 'Signature',     icon: 'fa-solid fa-signature',          group: 'Pages' },
  { key: 'print',      label: 'Print & trim',  icon: 'fa-solid fa-ruler',              group: 'Pages' },
  { key: 'templates',  label: 'Templates',     icon: 'fa-solid fa-file-lines',          group: 'Pages' },
]

const COLOR_PALETTES = [
  { id: 'moonstone', name: 'Moonstone', colors: ['#16151a', '#1d1c22'], text: '#ece7de', accent: '#d8ab5c' },
  { id: 'parchment', name: 'Parchment', colors: ['#f3f2f2', '#e5e0d8'], text: '#201f1d', accent: '#b68235' },
  { id: 'ember',     name: 'Ember',     colors: ['#1a0a00', '#3d1500'], text: '#ffd5a8', accent: '#e07030' },
  { id: 'forest',    name: 'Forest',    colors: ['#071211', '#0f2420'], text: '#c8e8c8', accent: '#5fa870' },
  { id: 'ocean',     name: 'Ocean',     colors: ['#050d1a', '#0d2040'], text: '#c0d8f0', accent: '#4080c8' },
  { id: 'blush',     name: 'Blush',     colors: ['#2a1020', '#4a2030'], text: '#f0c8d8', accent: '#d060a0' },
  { id: 'dusk',      name: 'Dusk',      colors: ['#1a1030', '#2a1a50'], text: '#d8c8f0', accent: '#9060d0' },
  { id: 'amber',     name: 'Amber',     colors: ['#1a1200', '#403000'], text: '#f8e8a0', accent: '#d0a030' },
  { id: 'slate',     name: 'Slate',     colors: ['#0e1420', '#1c2840'], text: '#c8d8e8', accent: '#6090b8' },
  { id: 'rose-gold', name: 'Rose Gold', colors: ['#1a0e10', '#382020'], text: '#f0d8c8', accent: '#c87060' },
  { id: 'midnight',  name: 'Midnight',  colors: ['#000510', '#000d20'], text: '#d0e8ff', accent: '#5090d0' },
  { id: 'crimson',   name: 'Crimson',   colors: ['#1a0008', '#300010'], text: '#ffd8e0', accent: '#d04060' },
  { id: 'sage',      name: 'Sage',      colors: ['#e8ede8', '#d4ddd4'], text: '#2a3a2a', accent: '#6a9a6a' },
  { id: 'bronze',    name: 'Bronze',    colors: ['#1a1008', '#302008'], text: '#f8e8c8', accent: '#c09040' },
  { id: 'violet',    name: 'Violet',    colors: ['#12081a', '#200a30'], text: '#e8d0ff', accent: '#a060e0' },
]

const TEXT_SHADOWS = [
  { id: 'none',   label: 'None',   value: 'none' },
  { id: 'soft',   label: 'Glow',   value: '0 0 20px rgba(255,255,255,0.4)' },
  { id: 'warm',   label: 'Warm',   value: '0 0 30px rgba(255,200,100,0.5), 0 2px 8px rgba(0,0,0,0.5)' },
  { id: 'sharp',  label: 'Sharp',  value: '2px 2px 0 rgba(0,0,0,0.8)' },
  { id: 'lifted', label: 'Lifted', value: '0 4px 16px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.1)' },
  { id: 'emboss', label: 'Emboss', value: '0 1px 0 rgba(255,255,255,0.2), 0 -1px 0 rgba(0,0,0,0.5)' },
]

const TITLE_SIZES = [
  { id: 'sm', label: 'S',  value: '2.5rem' },
  { id: 'md', label: 'M',  value: '3.2rem' },
  { id: 'lg', label: 'L',  value: '4.2rem' },
  { id: 'xl', label: 'XL', value: '5.2rem' },
]

const TITLE_WEIGHTS = [
  { id: '200', label: 'Thin' },
  { id: '300', label: 'Light' },
  { id: '400', label: 'Regular' },
  { id: '600', label: 'Semibold' },
  { id: '700', label: 'Bold' },
  { id: '800', label: 'Heavy' },
]

const TITLE_SPACING = [
  { id: '-0.02em', label: 'Tighter' },
  { id: '0',       label: 'Normal' },
  { id: '0.05em',  label: 'Wide' },
  { id: '0.12em',  label: 'Wider' },
  { id: '0.2em',   label: 'Spaced' },
]

const TITLE_TRANSFORMS = [
  { id: 'none',       label: 'As-is' },
  { id: 'uppercase',  label: 'CAPS' },
  { id: 'lowercase',  label: 'lower' },
  { id: 'capitalize', label: 'Title' },
]

const STYLE_PRESETS = [
  { id: 'hero',     label: 'Hero',     titleFont: 'cinzel',    titleSize: 'xl', titleWeight: '700', titleSpacing: '0.12em', titleShadow: 'lifted',  titleTransform: 'uppercase' },
  { id: 'literary', label: 'Literary', titleFont: 'cormorant', titleSize: 'lg', titleWeight: '300', titleSpacing: '0.02em', titleShadow: 'soft',    titleTransform: 'none' },
  { id: 'romance',  label: 'Romance',  titleFont: 'playfair',  titleSize: 'xl', titleWeight: '400', titleSpacing: '0.04em', titleShadow: 'warm',    titleTransform: 'none' },
  { id: 'thriller', label: 'Thriller', titleFont: 'spectral',  titleSize: 'lg', titleWeight: '700', titleSpacing: '0.1em',  titleShadow: 'sharp',   titleTransform: 'uppercase' },
  { id: 'fantasy',  label: 'Fantasy',  titleFont: 'garamond',  titleSize: 'xl', titleWeight: '600', titleSpacing: '0.06em', titleShadow: 'emboss',  titleTransform: 'none' },
  { id: 'minimal',  label: 'Minimal',  titleFont: 'lora',      titleSize: 'md', titleWeight: '400', titleSpacing: '0.2em',  titleShadow: 'none',    titleTransform: 'uppercase' },
]

const SIGNATURE_FONTS = [
  { key: 'cormorant', label: 'Cormorant' },
  { key: 'playfair',  label: 'Playfair' },
  { key: 'cinzel',    label: 'Cinzel' },
  { key: 'lora',      label: 'Lora' },
  { key: 'crimson',   label: 'Crimson' },
] satisfies import('../types/global').DesignerFontOption[]

if (typeof window !== 'undefined') {
  window.designerFontOptions = SIGNATURE_FONTS
}

// ─── main component ───────────────────────────────────────────────────────────

export default function BookDesigner({
  novelId,
  embedded,
}: {
  novelId?: string
  embedded?: boolean
}) {
  const { id: paramId } = useParams()
  const navigate = useNavigate()
  const id = novelId || paramId
  const { toast, customFonts, systemFonts } = useApp() as any
  const { openContextMenu } = useContextMenu()

  const [novel, setNovel] = useState<any>(null)
  const [chapters, setChapters] = useState<any[]>([])
  const [libraryImages, setLibraryImages] = useState<any[]>([])
  const [layout, setLayout] = useState<any>(null)
  const canEditDesigner = !novel?.sharedRole || novel.sharedRole === 'editor'

  const [section, setSection]       = useState('cover')
  const [workflow, setWorkflow]     = useState('cover')
  const [panelOpen, setPanelOpen]   = useState(false)
  const [stageView, setStageView]   = useState('cover')
  const [previewMode, setPreviewMode] = useState('cover')
  const [showGuides, setShowGuides] = useState(false)
  const [saveState, setSaveState]   = useState('saved')
  const [spinFrozen, setSpinFrozen] = useState(false)
  const [coverFocused, setCoverFocused] = useState(false)
  const [coverSurface, setCoverSurface] = useState('front')
  const [bookEnvironment, setBookEnvironment] = useState(() => window.localStorage?.getItem?.('moonscribe_book_environment') || 'studio')
  const [stageOver, setStageOver]   = useState(false)
  const [canUndo, setCanUndo]       = useState(false)
  const [canRedo, setCanRedo]       = useState(false)
  const overTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const layoutRef   = useRef<any>(null)
  const historyRef  = useRef<any[]>([])
  const futureRef   = useRef<any[]>([])
  const isUndoRedo  = useRef(false)
  const surfaceFileRef = useRef<HTMLInputElement | null>(null)
  const pendingSurfaceRef = useRef('front')
  const applyingRemoteRef = useRef(false)
  const designerDirtyRef = useRef(false)
  const presenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const presenceStateRef = useRef({ stageView: 'cover', coverSurface: 'front', section: 'cover', canEditDesigner: true, novelReady: false })
  const designerFontOptions = useMemo(() => buildDesignerFontOptions({ systemFonts, customFonts }), [customFonts, systemFonts])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement)?.isContentEditable) return
      if (event.key === 'g') { event.preventDefault(); setShowGuides((value) => !value) }
      if (event.key === 'f') { event.preventDefault(); setCoverFocused((value) => !value) }
      if (event.key === ' ') { event.preventDefault(); setSpinFrozen((value) => !value) }
      if (event.key === '1') setPreviewMode('cover')
      if (event.key === '2') setPreviewMode('interior')
      if (event.key === '3') setPreviewMode('flat-wrap')
      if (event.key === 'Escape' && coverFocused) setCoverFocused(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [coverFocused])

  useEffect(() => {
    ;(async () => {
      const n = await getNovel(id)
      setNovel(n)
      setChapters(await listChapters(id))
      setLibraryImages((await listMoodboard(id)).filter((tile) => tile.kind === 'image' && tile.image))
      // Merge new designer defaults into older books without replacing any
      // choices the author has already made.
      const savedLayout = { ...defaultLayout(), ...(n.layout || {}) }
      setLayout(savedLayout)
      layoutRef.current = savedLayout
    })()
  }, [id])

  useEffect(() => {
    let unsubscribe = () => {}
    const applyRemote = (event: CustomEvent | Event) => {
      const record = 'detail' in event ? (event.detail as any) : undefined
      if (String(record?.novelId || '') !== String(id)) return
      if (record?.store === 'novels' && record.payload) {
        applyingRemoteRef.current = true
        setNovel(record.payload)
        if (record.payload.layout) { setLayout(record.payload.layout); layoutRef.current = record.payload.layout }
      }
    }
    const refreshRemoteMedia = (event: CustomEvent | Event) => {
      const detail = 'detail' in event ? (event.detail as any) : undefined
      if (String(detail?.novelId || '') !== String(id)) return
      listMoodboard(id).then((tiles) => setLibraryImages(tiles.filter((tile) => tile.kind === 'image' && tile.image))).catch(() => {})
    }
    window.addEventListener('moonscribe:remote-record', applyRemote as EventListener)
    window.addEventListener('moonscribe:shared-media-refresh', refreshRemoteMedia as EventListener)
    if (!embedded) subscribePresence(id).then((cleanup) => { unsubscribe = cleanup }).catch(() => {})
    return () => { window.removeEventListener('moonscribe:remote-record', applyRemote as EventListener); window.removeEventListener('moonscribe:shared-media-refresh', refreshRemoteMedia as EventListener); unsubscribe() }
  }, [id, embedded])

  const pushPresence = useCallback(async () => {
    if (!id || !presenceStateRef.current.novelReady) return
    const {
      stageView: currentStageView = 'cover',
      coverSurface: currentCoverSurface = 'front',
      section: currentSection = 'cover',
      canEditDesigner: editable = true,
    } = presenceStateRef.current
    const surfaceLabel = currentCoverSurface ? currentCoverSurface[0].toUpperCase() + currentCoverSurface.slice(1) : 'Cover'
    const tabName = currentStageView === 'cover'
      ? `Designer · ${surfaceLabel} · ${currentSection || 'cover'}`
      : 'Designer · Print preview'
    try {
      await updatePresence(id, null, {
        status: document.hidden ? 'idle' : 'online',
        activity: editable ? 'writing' : 'viewing',
        workspace: 'designer',
        tabName,
      })
    } catch {
      // Presence is best-effort; the shared workspace still functions.
    }
  }, [id])

  useEffect(() => {
    presenceStateRef.current = {
      stageView,
      coverSurface,
      section,
      canEditDesigner,
      novelReady: !!novel,
    }
    if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current)
    if (!novel || !id) return
    presenceTimerRef.current = setTimeout(() => { pushPresence() }, 120)
  }, [novel, id, canEditDesigner, stageView, coverSurface, section, pushPresence])

  useEffect(() => {
    if (!novel || !id) return () => {}
    let alive = true
    const schedulePresence = () => {
      if (!alive) return
      if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current)
      presenceTimerRef.current = setTimeout(() => { pushPresence() }, 120)
    }
    const leave = () => {
      if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current)
      const currentSurface = presenceStateRef.current.coverSurface ?? 'front'
      const currentSection = presenceStateRef.current.section ?? 'cover'
      clearPresence(id, null, {
        workspace: 'designer',
        tabName: presenceStateRef.current.stageView === 'cover'
          ? `Designer · ${String(currentSurface)[0].toUpperCase() + String(currentSurface).slice(1)} · ${currentSection}`
          : 'Designer · Print preview',
      }).catch(() => {})
    }
    pushPresence()
    window.addEventListener('pagehide', leave, { passive: true })
    window.addEventListener('beforeunload', leave, { passive: true })
    window.addEventListener('focus', schedulePresence)
    window.addEventListener('click', schedulePresence, true)
    return () => {
      alive = false
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('beforeunload', leave)
      window.removeEventListener('focus', schedulePresence)
      window.removeEventListener('click', schedulePresence, true)
      leave()
    }
  }, [id, novel, pushPresence])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCoverFocused(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Debounced autosave — one local/cloud write after the user settles a change.
  useEffect(() => {
    layoutRef.current = layout
    if (!layout || !novel) return
    if (!canEditDesigner) return
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false
      return
    }
    if (!designerDirtyRef.current) return
    designerDirtyRef.current = false
    setSaveState('syncing')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateNovel(id, { layout }).then(() => setSaveState('saved')).catch(() => setSaveState('error'))
    }, 900)
  }, [layout, novel, id, canEditDesigner])

  // A reload or route change must not discard a large image while the normal
  // debounce is still waiting. IndexedDB accepts the data URL directly, so
  // flush the latest complete layout during teardown.
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (layoutRef.current) updateNovel(id, { layout: layoutRef.current })
  }, [id])

  const update = useCallback((patch) => {
    if (!canEditDesigner) return
    designerDirtyRef.current = true
    setLayout((p) => {
      if (!isUndoRedo.current) {
        historyRef.current = [...historyRef.current.slice(-49), p]
        futureRef.current  = []
        setCanUndo(true)
        setCanRedo(false)
      }
      return { ...p, ...patch }
    })
  }, [canEditDesigner])

  const updateCover = useCallback((patch) => {
    if (!canEditDesigner) return
    designerDirtyRef.current = true
    setLayout((p) => {
      const next = { ...p, cover: { ...(p.cover || {}), ...patch } }
      layoutRef.current = next
      if (!isUndoRedo.current) {
        historyRef.current = [...historyRef.current.slice(-49), p]
        futureRef.current  = []
        setCanUndo(true)
        setCanRedo(false)
      }
      return next
    })
  }, [canEditDesigner])

  const applySurfaceImage = useCallback(async (file, surface = coverSurface) => {
    if (!file?.type?.startsWith('image/')) return false
    const dataUrl = await fileToDataUrl(file, surface === 'spine' ? 1600 : 2400)
    updateCover({ [`${surface}Image`]: dataUrl, [`${surface}Crop`]: { zoom: 1, x: 50, y: 50 }, showImage: true })
    setCoverSurface(surface)
    setSection('image')
    setPanelOpen(true)
    toast(`Image placed on the ${surface}.`)
    return true
  }, [coverSurface, toast, updateCover])

  const chooseSurfaceImage = useCallback((surface) => {
    pendingSurfaceRef.current = surface
    setCoverSurface(surface)
    surfaceFileRef.current?.click()
  }, [])

  const pasteSurfaceImage = useCallback(async (surface) => {
    try {
      const entries = await navigator.clipboard?.read?.()
      for (const entry of entries || []) {
        const type = entry.types.find((value) => value.startsWith('image/'))
        if (type) return applySurfaceImage(await entry.getType(type), surface)
      }
      toast('Copy an image first, then try Paste image again.')
    } catch {
      toast('Clipboard image access was blocked. Use Upload image instead.')
    }
    return false
  }, [applySurfaceImage, toast])

  const undo = useCallback(() => {
    if (!historyRef.current.length) return
    const prev = historyRef.current[historyRef.current.length - 1]
    historyRef.current = historyRef.current.slice(0, -1)
    isUndoRedo.current = true
    setLayout((cur) => {
      futureRef.current = [cur, ...futureRef.current.slice(0, 49)]
      setCanUndo(historyRef.current.length > 0)
      setCanRedo(true)
      isUndoRedo.current = false
      return prev
    })
  }, [])

  const redo = useCallback(() => {
    if (!futureRef.current.length) return
    const next = futureRef.current[0]
    futureRef.current = futureRef.current.slice(1)
    isUndoRedo.current = true
    setLayout((cur) => {
      historyRef.current = [...historyRef.current.slice(-49), cur]
      setCanUndo(true)
      setCanRedo(futureRef.current.length > 0)
      isUndoRedo.current = false
      return next
    })
  }, [])

  useEffect(() => {
    const isTextInput = (target) => target instanceof HTMLElement && (
      target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    )

    const onDesignerKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey) || isTextInput(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (key === 'y') {
        event.preventDefault()
        redo()
      }
    }

    const onDesignerPaste = async (event) => {
      if (isTextInput(event.target) || stageView !== 'cover') return
      const image = [...(event.clipboardData?.items || [])]
        .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
        ?.getAsFile() || [...(event.clipboardData?.files || [])].find((file) => file.type.startsWith('image/'))
      if (!image) return

      event.preventDefault()
      try {
        await applySurfaceImage(image, coverSurface)
      } catch {
        toast('That clipboard image could not be added.')
      }
    }

    window.addEventListener('keydown', onDesignerKeyDown)
    window.addEventListener('paste', onDesignerPaste)
    return () => {
      window.removeEventListener('keydown', onDesignerKeyDown)
      window.removeEventListener('paste', onDesignerPaste)
    }
  }, [applySurfaceImage, coverSurface, redo, stageView, toast, undo])

  const applyCoverDesign = useCallback((did) => {
    const d = designById(did)
    if (!d) return
    update({ coverDesign: did })
    updateCover({ ...d.cover })
    toast(`${d.name} settled onto the cover.`)
  }, [toast, update, updateCover])

  const applyEditorDesign = useCallback((did) => {
    const d = designById(did)
    if (!d) return
    update({ editorDesign: did })
    toast(`${d.name} set across the pages.`)
  }, [toast, update])

  const openSection = (key) => {
    if (key === section && panelOpen) { setPanelOpen(false) }
    else { setSection(key); setPanelOpen(true) }
  }

  if (!novel || !layout) {
    return (
      <div className={embedded ? undefined : 'app'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grey)', fontStyle: 'italic' }}>
        Preparing the press…
      </div>
    )
  }

  const font        = designerFontOptions.find((f) => f.value === (layout.bodyFont || 'literata')) || designerFontOptions[0]
  const firstChapter = chapters[0]
  const cover       = layout.cover || {}
  const sig         = layout.signature || {}
  const activeCoverDesign  = layout.coverDesign
  const activeEditorDesign = layout.editorDesign
  const measurements = coverGeometry(chapters, layout)
  const preflightIssues = preflightDesigner({ novel, layout, cover, chapters, measurements })
  const blockingIssues = preflightIssues.filter((issue) => issue.severity === 'blocking')
  const workflowIndex = Math.max(0, DESIGN_WORKFLOWS.findIndex((item) => item.key === workflow))
  const setWorkflowStage = (next) => {
    setWorkflow(next)
    if (next === 'cover') { setPreviewMode('cover'); setStageView('cover') }
    if (next === 'interior') { setSection('body'); setPanelOpen(true) }
    if (next === 'polish') { setSection('print'); setPanelOpen(true) }
    if (next === 'export') { setStageView('page'); setPreviewMode('interior') }
  }

  const SECTION_GROUPS = ['Cover', 'Pages']

  return (
    <div className={embedded ? 'designer-embedded-shell' : 'app'} style={embedded ? { display: 'flex', flex: 1, minHeight: 0, height: '100%' } : undefined}>
      {!embedded && novel && <SubPageTopbar novel={novel} title="Designer" />}

      <div className={`cover-studio ds-layout ${coverFocused ? 'cover-studio-focus' : ''}`}>
        <input ref={surfaceFileRef} type="file" accept="image/*" hidden onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) await applySurfaceImage(file, pendingSurfaceRef.current) }} />

        <div className="designer-workflow-bar" aria-label="Designer workflow">
          <div className="designer-workflow-brand"><span className="designer-kicker">BOOK STUDIO</span><strong>Design your edition</strong></div>
          <nav className="designer-workflow-steps">
            {DESIGN_WORKFLOWS.map((item, index) => (
              <button key={item.key} type="button" className={`designer-workflow-step ${workflow === item.key ? 'active' : ''} ${index < workflowIndex ? 'complete' : ''}`} onClick={() => setWorkflowStage(item.key)}>
                <span className="designer-workflow-number">{index < workflowIndex ? '✓' : index + 1}</span>
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
              </button>
            ))}
          </nav>
          <div className={`designer-save-state ${saveState}`}><span className="designer-save-dot" />{saveState === 'syncing' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved'}</div>
        </div>

        {/* ── Icon strip ───────────────────────────────────────────────── */}
        <div className="ds-icons">
          {SECTION_GROUPS.map((group) => (
            <div key={group} className="ds-icon-group">
              <div className="ds-icon-group-label">{group}</div>
              {SECTIONS.filter((s) => s.group === group).map((s) => (
                <button
                  key={s.key}
                  className={`ds-icon-btn studio-rail-icon ${panelOpen && section === s.key ? 'active' : ''}`}
                  aria-label={s.label}
                  onClick={() => openSection(s.key)}
                  title={s.label}
                >
                  <Icon icon={s.icon} />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* ── Sliding panel ────────────────────────────────────────────── */}
        <div className={`ds-panel ${panelOpen ? 'open' : ''}`}>
          <div className="ds-panel-head studio-rail-head">
            <strong className="ds-panel-title">{SECTIONS.find((s) => s.key === section)?.label}</strong>
            <button className="ds-panel-close" onClick={() => setPanelOpen(false)} aria-label="Close panel">
              <Icon icon="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="ds-panel-body studio-rail-scroll" data-section={section}>
            {renderSection(section, { cover, novel, layout, sig, updateCover, update, applyCoverDesign, applyEditorDesign, activeCoverDesign, activeEditorDesign, toast, coverSurface, setCoverSurface, measurements, designerFontOptions, libraryImages, chapters })}
          </div>
        </div>

        {/* ── Stage ────────────────────────────────────────────────────── */}
        <div
          className={`ds-stage studio-hero ${stageOver ? 'drag-over' : ''} ${stageView === 'page' ? 'is-page' : ''}`}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
          onDragEnter={() => { clearTimeout(overTimer.current); setStageOver(true) }}
          onDragLeave={() => { overTimer.current = setTimeout(() => setStageOver(false), 120) }}
      onDrop={(e) => {
        e.preventDefault(); setStageOver(false)
        const assetRaw = e.dataTransfer.getData(ASSET_MIME)
        if (assetRaw && stageView === 'cover') {
          try {
            const asset = JSON.parse(assetRaw)
            const key = `${coverSurface}Components`
            const current = Array.isArray(cover[key]) ? cover[key] : []
            updateCover({ [key]: [...current, { ...asset, instanceId: `${asset.id}-${Date.now()}`, x: 50, y: 50, scale: 1 }] })
            toast(`${asset.title} added to the ${coverSurface} cover.`)
          } catch { toast('That design asset could not be placed.') }
          return
        }
        const mediaImage = e.dataTransfer.getData('application/x-moonscribe-media')
            if (mediaImage && stageView === 'cover') {
              const imageKey = `${coverSurface}Image`
              const cropKey = `${coverSurface}Crop`
              updateCover({ [imageKey]: mediaImage, [cropKey]: { zoom: 1, x: 50, y: 50 }, showImage: true })
              return
            }
            const d = designById(e.dataTransfer.getData(DESIGN_MIME))
            if (!d) return
            if (stageView === 'cover') applyCoverDesign(d.id)
            else applyEditorDesign(d.id)
          }}
        >
          {/* Top bar */}
          <div className="ds-stage-bar studio-bar">
            <div className="ds-stage-tabs studio-seg designer-stage-main">
              <TabsList className="designer-stage-tabs-list">{PREVIEW_MODES.map((mode) => (
                <TabsTrigger key={mode.key} className={`ds-stage-tab ${previewMode === mode.key ? 'active' : ''}`} onClick={() => {
                  setPreviewMode(mode.key)
                  if (mode.key === 'cover' || mode.key === 'flat-wrap') { setStageView('cover'); setCoverFocused(false) }
                  if (mode.key === 'interior') { setStageView('page'); window.location.hash = `#/novel/${id}/design/print`; navigate(`/novel/${id}/design/print`) }
                  if (mode.key === 'comparison') setStageView('page')
                }}>
                  <Icon icon={mode.icon} /> {mode.label}
                </TabsTrigger>
              ))}</TabsList>
            </div>

            <div className="ds-stage-actions designer-stage-tools">
              <button type="button" className="ds-action-btn designer-more-button" aria-label="More designer options" title="More options" onClick={(event) => openContextMenu(event, [
                { label: showGuides ? 'Hide guides' : 'Show guides', icon: 'fa-solid fa-ruler-combined', onClick: () => setShowGuides((value) => !value) },
                { label: 'Undo', icon: 'fa-solid fa-rotate-left', disabled: !canUndo, onClick: undo },
                { label: 'Redo', icon: 'fa-solid fa-rotate-right', disabled: !canRedo, onClick: redo },
                { label: 'Interior preview', icon: 'fa-solid fa-file-lines', onClick: () => { setPreviewMode('interior'); setStageView('page') } },
                { label: spinFrozen ? 'Resume spin' : 'Freeze spin', icon: spinFrozen ? 'fa-solid fa-play' : 'fa-solid fa-pause', onClick: () => setSpinFrozen((value) => !value) },
              ])}><Icon icon="fa-solid fa-ellipsis" /></button>
              <button className="ds-action-btn" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)"><Icon icon="fa-solid fa-rotate-left" /></button>
                <button className="ds-action-btn" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Y)"><Icon icon="fa-solid fa-rotate-right" /></button>
                <button type="button" className={`ds-action-btn ds-guides-action ${showGuides ? 'active' : ''}`} onClick={() => setShowGuides((value) => !value)} title="Toggle print guides" aria-pressed={showGuides}><Icon icon="fa-solid fa-ruler-combined" /><span>Guides</span></button>
            </div>

          {stageView === 'cover' && (
              <div className="ds-stage-actions designer-stage-settings">
                <Select value={bookEnvironment} options={BOOK_ENVIRONMENTS} width={142} ariaLabel="Book preview environment" className="ds-environment-select" onChange={(value) => { setBookEnvironment(value); window.localStorage?.setItem?.('moonscribe_book_environment', value) }} />
                <Select
                  value={typeof layout.pageSize === 'string' && PAGE_PRESETS.some((preset) => preset.key === layout.pageSize) ? layout.pageSize : 'trade-paperback'}
                  options={BOOK_SIZE_OPTIONS}
                  width={190}
                  ariaLabel="3D book trim size"
                  className="ds-book-size-select"
                  onChange={(value) => update({ pageSize: value })}
                />
                <div className="ds-surface-switch" aria-label="Book surface">
                  {['front', 'spine', 'back'].map((surface) => (
                    <button key={surface} className={coverSurface === surface ? 'active' : ''} onClick={() => { setCoverSurface(surface); setSpinFrozen(true); setSection('image'); setPanelOpen(true) }}>{surface}</button>
                  ))}
                </div>
                <button
                  className={`ds-action-btn ${spinFrozen ? 'active' : ''}`}
                  onClick={() => setSpinFrozen((v) => !v)}
                  title={spinFrozen ? 'Unfreeze spin' : 'Freeze spin'}
                >
                  <Icon icon={spinFrozen ? 'fa-solid fa-play' : 'fa-solid fa-pause'} />
                  {spinFrozen ? 'Spin' : 'Freeze'}
                </button>
                <button
                  className={`ds-action-btn ${coverFocused ? 'active' : ''}`}
                  onClick={() => setCoverFocused((v) => !v)}
                  title={coverFocused ? 'Exit full-screen cover preview (Esc)' : 'Open full-screen cover preview'}
                >
                  <Icon icon={coverFocused ? 'fa-solid fa-compress' : 'fa-solid fa-expand'} />
                  {coverFocused ? 'Exit focus' : 'Full screen'}
                </button>
                <button className="ds-action-btn" onClick={() => exportCoverPng(novel, cover, designerFontOptions)}>
                  <Icon icon="fa-solid fa-download" /> PNG
                </button>
              </div>
            )}
          </div>

          {/* Canvas */}
          <div className={`ds-canvas ${stageView === 'cover' ? `book-environment book-environment-${bookEnvironment}` : ''} ${showGuides ? 'show-print-guides' : ''}`} title={stageView === 'cover' ? `Paste an image onto the ${coverSurface} with Ctrl+V` : undefined}>
            {stageView === 'cover' && previewMode === 'cover' ? (
              <Cover3D novel={novel} cover={cover} autoSpin={!spinFrozen} immersive={coverFocused} surface={coverSurface} environment={bookEnvironment} measurements={measurements} designerFontOptions={designerFontOptions}
                onSurfaceSelect={(selected) => { setCoverSurface(selected); setSpinFrozen(true); setSection('image'); setPanelOpen(true) }}
                onSurfaceContext={(event, selected) => {
                  setCoverSurface(selected)
                  const hasImage = !!cover[`${selected}Image`]
                  openContextMenu(event, [
                    { label: `Paste image on ${selected}`, icon: 'fa-solid fa-paste', onClick: () => pasteSurfaceImage(selected) },
                    { label: `${hasImage ? 'Replace' : 'Upload'} ${selected} image`, icon: 'fa-solid fa-arrow-up-from-bracket', onClick: () => chooseSurfaceImage(selected) },
                    { label: `Edit ${selected} crop`, icon: 'fa-solid fa-crop-simple', onClick: () => { setSection('image'); setPanelOpen(true) } },
                    'divider',
                    { label: `Remove ${selected} image`, icon: 'fa-solid fa-trash', danger: true, disabled: !hasImage, onClick: () => updateCover({ [`${selected}Image`]: null }) }
                  ])
                }} />
            ) : stageView === 'cover' && previewMode === 'flat-wrap' ? (
              <FlatWrapPreview novel={novel} cover={cover} measurements={measurements} designerFontOptions={designerFontOptions} />
            ) : previewMode === 'comparison' ? (
              <div className="designer-comparison-preview"><div className="book-mini"><InteriorPreview novel={novel} cover={cover} layout={layout} chapters={chapters} font={font} sig={sig} activeEditorDesign={activeEditorDesign} /></div><div className="book-mini"><InteriorPreview novel={novel} cover={cover} layout={{ ...layout, lineSpacing: '1.5' }} chapters={chapters} font={font} sig={sig} activeEditorDesign={activeEditorDesign} /></div></div>
            ) : (
              <div className="book-mini">
                <InteriorPreview novel={novel} cover={cover} layout={layout} chapters={chapters} font={font} sig={sig} activeEditorDesign={activeEditorDesign} />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

function PageTemplatesTab({ activeEditorDesign, applyEditorDesign, toast }) {
  const designId = (template) => `page-${template.id.replace('chapter-opening', 'chapter').replace('map-notes', 'map')}`
  return <div className="ds-page-templates"><p className="ds-hint">Apply a complete page design to your manuscript. These templates use the same Designs system as the Editor.</p><div className="ds-template-grid">{PAGE_TEMPLATES.map((template) => { const id = designId(template); return <button type="button" key={template.id} className={`ds-template-card ${activeEditorDesign === id ? 'active' : ''}`} onClick={() => { applyEditorDesign(id); toast(`${template.title} applied.`) }}><span className="ds-template-glyph">{template.icon}</span><strong>{template.title}</strong><small>{template.description}</small><em>Apply design</em></button> })}</div></div>
}

// ─── section renderer ─────────────────────────────────────────────────────────

function renderSection(section, { cover, novel, layout, sig, updateCover, update, applyCoverDesign, applyEditorDesign, activeCoverDesign, activeEditorDesign, toast, coverSurface, setCoverSurface, measurements, designerFontOptions, libraryImages, chapters }) {
  switch (section) {
    case 'cover':     return <CoverTab cover={cover} updateCover={updateCover} />
    case 'palette':   return <PaletteTab cover={cover} updateCover={updateCover} />
    case 'effects':   return <EffectsTab cover={cover} updateCover={updateCover} designerFontOptions={designerFontOptions} />
    case 'image':     return <ImageTab novel={novel} cover={cover} updateCover={updateCover} surface={coverSurface} setSurface={setCoverSurface} />
    case 'media':     return <MediaDesignerTab images={libraryImages} cover={cover} updateCover={updateCover} surface={coverSurface} setSurface={setCoverSurface} />
    case 'shapes':    return <ShapesTab cover={cover} layout={layout} updateCover={updateCover} update={update} />
    case 'atmosphere': return <AtmosphereTab layout={layout} update={update} toast={toast} />
    case 'body':      return <BodyTab layout={layout} update={update} designerFontOptions={designerFontOptions} chapters={chapters} />
    case 'headers':   return <HeadersTab layout={layout} update={update} />
    case 'title':     return <TitleTab layout={layout} update={update} />
    case 'signature': return <SignatureTab sig={sig} update={update} />
    case 'print':     return <PrintTab layout={layout} update={update} measurements={measurements} />
    case 'templates': return <PageTemplatesTab activeEditorDesign={activeEditorDesign} applyEditorDesign={applyEditorDesign} toast={toast} />
    default:          return null
  }
}

// ─── section panels ───────────────────────────────────────────────────────────

function CoverTab({ cover, updateCover }) {
  const TITLE_COLORS = ['#ffffff', '#FFF9E8', '#FBE3E3', '#3d3a36', '#D4A5A5', '#bfd8e8', '#d4c5e8', '#c5e8d4', '#f0ddb0', '#e8c5c5']
  return (
    <>
      <Field label="Subtitle"><input value={cover.subtitle || ''} onChange={(e) => updateCover({ subtitle: e.target.value })} placeholder="A novel" /></Field>
      <Field label="Byline"><input value={cover.byline || ''} onChange={(e) => updateCover({ byline: e.target.value })} placeholder="for Storm Tattersall" /></Field>
      <Field label="Title colour">
        <div className="ds-swatch-row">
          {TITLE_COLORS.map((c) => (
            <button key={c} className={`ds-swatch-color ${(cover.titleColor || '#ffffff') === c ? 'active' : ''}`} style={{ background: c }} onClick={() => updateCover({ titleColor: c })} aria-label={c} />
          ))}
        </div>
        <div className="ds-color-custom">
          <input type="color" className="ds-color-wheel" value={cover.titleColor || '#ffffff'} onChange={(e) => updateCover({ titleColor: e.target.value })} />
          <span className="ds-color-custom-label">Custom</span>
        </div>
      </Field>
    </>
  )
}

function PaletteTab({ cover, updateCover }) {
  return (
    <>
      <p className="ds-hint">Sets the gradient, title colour, and accent all at once.</p>
      <div className="ds-palette-grid">
        {COLOR_PALETTES.map((p) => (
          <button
            key={p.id}
            className={`ds-palette-chip ${cover.paletteId === p.id ? 'active' : ''}`}
            onClick={() => updateCover({ paletteId: p.id, gradient: `linear-gradient(160deg, ${p.colors[0]}, ${p.colors[1]})`, gradFrom: p.colors[0], gradTo: p.colors[1], titleColor: p.text, ornamentColor: p.accent })}
            title={p.name}
          >
            <span className="ds-palette-swatch" style={{ background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})` }}>
              <span style={{ color: p.text, fontSize: '0.55rem', fontWeight: 700 }}>Aa</span>
            </span>
            <span className="ds-palette-name">{p.name}</span>
          </button>
        ))}
      </div>

      <SectionDivider>Custom gradient</SectionDivider>
      <div className="ds-gradient-row">
        <div className="ds-gradient-cell">
          <label>From</label>
          <input type="color" className="ds-color-wheel ds-color-wheel-lg" value={cover.gradFrom || '#16151a'} onChange={(e) => updateCover({ gradFrom: e.target.value, paletteId: null, gradient: `linear-gradient(160deg, ${e.target.value}, ${cover.gradTo || '#1d1c22'})` })} />
        </div>
        <span className="ds-gradient-arrow">→</span>
        <div className="ds-gradient-cell">
          <label>To</label>
          <input type="color" className="ds-color-wheel ds-color-wheel-lg" value={cover.gradTo || '#1d1c22'} onChange={(e) => updateCover({ gradTo: e.target.value, paletteId: null, gradient: `linear-gradient(160deg, ${cover.gradFrom || '#16151a'}, ${e.target.value})` })} />
        </div>
        <div className="ds-gradient-cell">
          <label>Title</label>
          <input type="color" className="ds-color-wheel ds-color-wheel-lg" value={cover.titleColor || '#ffffff'} onChange={(e) => updateCover({ titleColor: e.target.value })} />
        </div>
      </div>
    </>
  )
}

function EffectsTab({ cover, updateCover, designerFontOptions = [] }) {
  const availableFonts = designerFontOptions.length ? designerFontOptions : buildDesignerFontOptions({})
  return (
    <>
      <SectionDivider>Quick presets</SectionDivider>
      <div className="ds-preset-grid">
        {STYLE_PRESETS.map((p) => (
          <button key={p.id} className="ds-preset-chip" onClick={() => updateCover({ ...p })}>{p.label}</button>
        ))}
      </div>

      <SectionDivider>Font</SectionDivider>
      <div className="ds-font-grid">
        {availableFonts.map((f) => (
          <button
            key={f.value}
            className={`ds-font-chip ${(cover.titleFont || 'cormorant') === f.value ? 'active' : ''}`}
            style={f.style}
            onClick={() => updateCover({ titleFont: f.value })}
          >
            <span className="ds-font-sample">Ag</span>
            <span className="ds-font-name">{f.label}</span>
          </button>
        ))}
      </div>

      <SectionDivider>Size</SectionDivider>
      <div className="ds-pill-row">
        {TITLE_SIZES.map((s) => (
          <button key={s.id} className={`ds-pill ${(cover.titleSize || 'md') === s.id ? 'active' : ''}`} onClick={() => updateCover({ titleSize: s.id })}>{s.label}</button>
        ))}
      </div>

      <SectionDivider>Weight</SectionDivider>
      <div className="ds-weight-grid">
        {TITLE_WEIGHTS.map((w) => (
          <button key={w.id} className={`ds-weight-chip ${(cover.titleWeight || '600') === w.id ? 'active' : ''}`} onClick={() => updateCover({ titleWeight: w.id })}>
            <span className="ds-weight-sample" style={{ fontWeight: Number(w.id), fontFamily: 'var(--font-heading)' }}>Ag</span>
            <span className="ds-weight-label">{w.label}</span>
          </button>
        ))}
      </div>

      <SectionDivider>Letter spacing</SectionDivider>
      <div className="ds-pill-row" style={{ flexWrap: 'wrap' }}>
        {TITLE_SPACING.map((s) => (
          <button key={s.id} className={`ds-pill ${(cover.titleSpacing || '0') === s.id ? 'active' : ''}`} onClick={() => updateCover({ titleSpacing: s.id })}>{s.label}</button>
        ))}
      </div>

      <SectionDivider>Case</SectionDivider>
      <div className="ds-pill-row">
        {TITLE_TRANSFORMS.map((t) => (
          <button key={t.id} className={`ds-pill ${(cover.titleTransform || 'none') === t.id ? 'active' : ''}`} style={{ textTransform: t.id === 'none' ? 'none' : t.id }} onClick={() => updateCover({ titleTransform: t.id })}>{t.label}</button>
        ))}
      </div>

      <SectionDivider>Shadow</SectionDivider>
      <div className="ds-shadow-grid">
        {TEXT_SHADOWS.map((s) => (
          <button key={s.id} className={`ds-shadow-chip ${(cover.titleShadow || 'none') === s.id ? 'active' : ''}`} onClick={() => updateCover({ titleShadow: s.id })}>
            <span className="ds-shadow-sample" style={{ textShadow: s.value, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>Aa</span>
            <span className="ds-shadow-label">{s.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function ImageTab({ novel, cover, updateCover, surface, setSurface }) {
  const imageInputRef = useRef(null)
  const imageKey = `${surface}Image`
  const cropKey = `${surface}Crop`
  const crop = cover[cropKey] || { zoom: 1, x: 50, y: 50 }
  const image = cover[imageKey]

  const uploadSurface = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    const dataUrl = await fileToDataUrl(file, surface === 'spine' ? 1600 : 2400)
    updateCover({ [imageKey]: dataUrl, [cropKey]: { zoom: 1, x: 50, y: 50 }, showImage: true })
  }
  const updateCrop = (patch) => updateCover({ [cropKey]: { ...crop, ...patch } })

  return (
    <>
      <p className="ds-hint">Upload and crop artwork independently for every physical surface.</p>
      <div className="ds-surface-tabs">
        {['front', 'spine', 'back'].map((item) => <button key={item} className={surface === item ? 'active' : ''} onClick={() => setSurface(item)}>{item}</button>)}
      </div>
      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadSurface} />
      <button type="button" className="ds-upload-cover" onClick={() => imageInputRef.current?.click()}>
        <Icon icon="fa-solid fa-arrow-up-from-bracket" /> {image ? `Replace ${surface} image` : `Upload ${surface} image`}
      </button>

      {image ? (
        <>
          <div className={`ds-crop-preview is-${surface}`}>
            <img src={image} alt={`${surface} cover crop`} style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})` }} />
            <span>{surface} crop</span>
          </div>
          <CropSlider label="Zoom" min="1" max="3" step="0.05" value={crop.zoom} onChange={(zoom) => updateCrop({ zoom })} />
          <CropSlider label="Horizontal" min="0" max="100" step="1" value={crop.x} onChange={(x) => updateCrop({ x })} />
          <CropSlider label="Vertical" min="0" max="100" step="1" value={crop.y} onChange={(y) => updateCrop({ y })} />
          <button type="button" className="button button-ghost ds-remove-surface" onClick={() => updateCover({ [imageKey]: null })}>Remove {surface} image</button>
        </>
      ) : surface === 'front' ? (
        <>
          <SectionDivider>Built-in front artwork</SectionDivider>
          <div className="ds-cover-grid cover-pick-grid">
            {GALLERY.map((gallery) => (
              <button type="button" key={gallery.id} className={`ds-cover-pick cover-pick ${cover.imageSource === `gallery:${gallery.id}` ? 'active selected' : ''}`} onClick={() => updateCover({ imageSource: `gallery:${gallery.id}`, showImage: true })}>
                <img src={gallery.dataUrl} alt="" /><span>{gallery.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : <div className="ds-surface-empty"><Icon icon="fa-regular fa-image" /> No custom {surface} artwork</div>}

      {surface === 'front' && <label className="ds-toggle-row"><span>Show title on front cover</span><input type="checkbox" checked={cover.showFrontText !== false} onChange={(event) => updateCover({ showFrontText: event.target.checked })} /></label>}
      {surface === 'spine' && <label className="ds-toggle-row"><span>Show title on spine only</span><input type="checkbox" checked={cover.showSpineText !== false} onChange={(event) => updateCover({ showSpineText: event.target.checked })} /></label>}
      {surface === 'back' && <label className="ds-toggle-row"><span>Show blurb on back</span><input type="checkbox" checked={cover.showBackText !== false} onChange={(event) => updateCover({ showBackText: event.target.checked })} /></label>}
    </>
  )
}

function MediaDesignerTab({ images = [], cover, updateCover, surface, setSurface }) {
  const imageKey = `${surface}Image`
  const cropKey = `${surface}Crop`
  const choose = (image) => updateCover({ [imageKey]: image, [cropKey]: { zoom: 1, x: 50, y: 50 }, showImage: true })
  return <>
    <p className="ds-hint">Choose an image from this novel’s Media Library for the {surface} cover.</p>
    <div className="ds-surface-tabs" role="tablist" aria-label="Cover surface"><span className="ds-surface-tabs-label">Place on</span>{['front', 'spine', 'back'].map((item) => <button type="button" role="tab" aria-selected={surface === item} key={item} className={surface === item ? 'active' : ''} onClick={() => setSurface?.(item)}>{item}</button>)}</div>
    {images.length ? <div className="ds-media-grid">{images.map((item) => <button type="button" draggable key={item.id} className={`ds-media-pick ${cover[imageKey] === item.image ? 'active' : ''}`} onDragStart={(event) => { event.dataTransfer.setData('application/x-moonscribe-media', item.image); event.dataTransfer.effectAllowed = 'copy' }} onClick={() => choose(item.image)}><img src={item.image} alt={item.text || 'Media Library image'} /><strong>{item.text || 'Untitled image'}</strong></button>)}</div> : <div className="ds-surface-empty"><Icon icon="fa-regular fa-images" /> No images in Media Library yet.</div>}
  </>
}

function CropSlider({ label, min, max, step, value, onChange }) {
  return <label className="ds-crop-control"><span>{label}<b>{Math.round(Number(value) * (label === 'Zoom' ? 100 : 1))}{label === 'Zoom' ? '%' : ''}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function ShapesTab({ cover, layout, updateCover, update }) {
  const currentOrnament = 'ornament' in (cover || {}) ? cover.ornament : '❦'
  const currentBreak    = layout.sceneBreak ?? '❦'
  return (
    <>
      <SectionDivider>Cover ornament</SectionDivider>
      {ORNAMENT_LIBRARY.map((cat) => (
        <div key={cat.group} className="ds-ornament-category">
          <div className="ds-ornament-cat-label">{cat.group}</div>
          <div className="ds-ornament-row">
            {cat.items.map((s) => (
              <button
                key={s || 'none'}
                className={`ds-ornament-btn swatch ${currentOrnament === s ? 'active selected' : ''}`}
                onClick={() => updateCover({ ornament: s })}
                title={s || 'None'}
              >
                {s ? <span style={{ fontSize: '1.1rem' }}>{s}</span> : <span style={{ fontSize: '0.62rem', color: 'var(--grey)' }}>None</span>}
              </button>
            ))}
          </div>
        </div>
      ))}

      <SectionDivider>Scene-break mark</SectionDivider>
      <div className="ds-ornament-row" style={{ flexWrap: 'wrap' }}>
        {SCENE_BREAKS.map((s) => (
          <button key={s} className={`ds-ornament-btn ${currentBreak === s ? 'active' : ''}`} onClick={() => update({ sceneBreak: s })}>
            <span style={{ fontSize: '1.1rem' }}>{s === ' ' ? '—' : s}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function AtmosphereTab({ layout, update, toast }) {
  return (
    <>
      <p className="ds-hint">One click sets fonts, ornaments, chapter style, and page layout to match a mood.</p>
      <div className="ds-atmosphere-grid">
        {ATMOSPHERES.map((a) => (
          <button
            key={a.id}
            className={`ds-atmosphere-chip ${layout.atmosphere === a.id ? 'active' : ''}`}
            onClick={() => {
              const { id: _id, label: _label, ...patch } = a
              update({ atmosphere: a.id, ...patch })
              toast(`${a.label} atmosphere applied.`)
            }}
          >
            <span className="ds-atm-label">{a.label}</span>
            <span className="ds-atm-preview">{a.ornament || a.sceneBreak || '·'}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function BodyTab({ layout, update, designerFontOptions = buildDesignerFontOptions({}), chapters = [] }) {
  return (
    <>
      <Field label="Font">
        <Select ariaLabel="Body font" width="100%" value={layout.bodyFont || 'literata'} onChange={(v) => update({ bodyFont: v })} options={designerFontOptions} />
      </Field>
      <Field label="Size">
        <Select ariaLabel="Body size" width="100%" value={String(layout.bodySize ?? '11.5')} onChange={(v) => update({ bodySize: Number(v) })} options={BODY_SIZES.map((s) => ({ value: String(s), label: `${s} pt` }))} />
      </Field>
      <Field label="Line spacing">
        <Select ariaLabel="Line spacing" width="100%" value={layout.bodyLineSpacing || '1.5'} onChange={(v) => update({ bodyLineSpacing: v })} options={LINE_SPACINGS_BODY.map((s) => ({ value: s.id, label: s.label }))} />
      </Field>
      <Field label="Alignment">
        <Select ariaLabel="Text alignment" width="100%" value={layout.textAlign || 'left'} onChange={(v) => update({ textAlign: v })} options={TEXT_ALIGNS.map((s) => ({ value: s.id, label: s.label }))} />
      </Field>
      <Field label="First-line indent">
        <Select ariaLabel="First-line indent" width="100%" value={layout.firstIndent || '0'} onChange={(v) => update({ firstIndent: v })} options={FIRST_INDENTS.map((s) => ({ value: s.id, label: s.label }))} />
      </Field>
      <SectionDivider>Drop cap</SectionDivider>
      <div className="ds-switch-row">
        <span>Drop cap on chapter openers</span>
        <label className="switch"><input type="checkbox" checked={!!layout.dropCap} onChange={(e) => update({ dropCap: e.target.checked })} /><span className="track" /></label>
      </div>
      <Field label="Drop cap starts on">
        <Select ariaLabel="Drop cap chapter" width="100%" value={layout.dropCapChapterId || 'all'} onChange={(value) => update({ dropCapChapterId: value === 'all' ? '' : value })} options={[{ value: 'all', label: 'Every chapter' }, ...chapters.filter((chapter) => !['book', 'part', 'act'].includes(chapter.kind)).map((chapter) => ({ value: chapter.id, label: chapter.title || 'Untitled chapter' }))]} />
      </Field>
      <Field label="Drop cap colour">
        <div className="ds-color-custom">
          <input type="color" className="ds-color-wheel" value={layout.dropCapColor ?? '#2a2520'} onChange={(e) => update({ dropCapColor: e.target.value })} aria-label="Drop cap colour" />
          <span className="ds-color-custom-label">Used for the first letter</span>
        </div>
      </Field>
    </>
  )
}

function TitleTab({ layout, update }) {
  return (
    <>
      <Field label="Title page style">
        <Select ariaLabel="Title page style" width="100%" value={layout.titleStyle || 'centered'} onChange={(v) => update({ titleStyle: v })} options={[{ value: 'centered', label: 'Quiet & centered' }, { value: 'ornament', label: 'With ornament' }]} />
      </Field>
      <Field label="Chapter heading style">
        <Select ariaLabel="Chapter heading style" width="100%" value={layout.chapterStyle || 'centered'} onChange={(v) => update({ chapterStyle: v })} options={CHAPTER_STYLES.map((s) => ({ value: s.id, label: s.label }))} />
      </Field>
      <div className="ds-toggle-row">
        <span>Include chapter titles in exports</span>
        <label className="switch"><input type="checkbox" checked={layout.showChapterTitles !== false} onChange={(event) => update({ showChapterTitles: event.target.checked })} /><span className="track" /></label>
      </div>
      <SectionDivider>Dedication</SectionDivider>
      <Field label="Text">
        <textarea value={layout.dedication || ''} onChange={(e) => update({ dedication: e.target.value })} placeholder={'for Storm Tattersall,\nwith every word.'} rows={3} style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '0.9rem', resize: 'vertical' }} />
      </Field>
      <Field label="Position">
        <Select ariaLabel="Dedication position" width="100%" value={layout.dedicationPos || 'recto'} onChange={(v) => update({ dedicationPos: v })} options={[{ value: 'recto', label: 'Right page (recto)' }, { value: 'verso', label: 'Left page (verso)' }, { value: 'none', label: 'Hide' }]} />
      </Field>
    </>
  )
}

function SignatureTab({ sig, update }: { sig: any; update: (next: any) => void }) {
  return (
    <>
      <p className="ds-hint">Sign the title page like a real copy.</p>
        <Field label="Your name"><input value={sig.text || ''} onChange={(e) => update({ signature: { ...sig, text: e.target.value } })} placeholder="e.g. Storm Tattersall" /></Field>
      <Field label="Hand">
        <div className="ds-sig-choices">
          {SIGNATURE_FONTS.map((f) => (
            <button key={f.key} className={`ds-sig-choice ${(sig.font || 'cormorant') === f.key ? 'active' : ''}`} onClick={() => update({ signature: { ...sig, font: f.key } })}>
              <span className={`signature signature-${f.key}`}>{sig.text || 'Your name'}</span>
            </button>
          ))}
        </div>
      </Field>
    </>
  )
}

function HeadersTab({ layout, update }: { layout: any; update: (next: any) => void }) {
  return (
    <>
      <p className="ds-hint">Running headers and page numbers appear on every body page.</p>
      <Field label="Running header">
        <Select ariaLabel="Running header style" width="100%" value={layout.headerStyle || 'none'} onChange={(v) => update({ headerStyle: v })} options={HEADER_STYLES.map((s) => ({ value: s.id, label: s.label }))} />
      </Field>
      <Field label="Header position">
        <Select ariaLabel="Header position" width="100%" value={layout.headerPos || 'top-center'} onChange={(v) => update({ headerPos: v })} options={[{ value: 'top-center', label: 'Top centre' }, { value: 'top-outer', label: 'Top outer' }, { value: 'top-inner', label: 'Top inner' }]} />
      </Field>
      <SectionDivider>Page numbers</SectionDivider>
      <Field label="Style">
        <Select ariaLabel="Page number style" width="100%" value={layout.pageNumStyle || 'plain'} onChange={(v) => update({ pageNumStyle: v })} options={PAGE_NUMBER_STYLES.map((s) => ({ value: s.id, label: s.label }))} />
      </Field>
      <Field label="Position">
        <Select ariaLabel="Page number position" width="100%" value={layout.pageNumPos || 'bottom-center'} onChange={(v) => update({ pageNumPos: v })} options={PAGE_NUMBER_POS.map((s) => ({ value: s.id, label: s.label }))} />
      </Field>
    </>
  )
}

function PrintTab({ layout, update, measurements }: { layout: any; update: (next: any) => void; measurements: any }) {
  return (
    <>
      <Field label="Trim size">
        <Select ariaLabel="Trim size" width="100%" value={typeof layout.pageSize === 'string' ? layout.pageSize : 'custom'} onChange={(v) => update({ pageSize: v === 'custom' ? { ...pageSizeMm(layout.pageSize) } : v })} options={[...PAGE_PRESETS.map((p) => ({ value: p.key, label: p.label })), { value: 'custom', label: 'Custom…' }]} />
      </Field>
      {typeof layout.pageSize === 'object' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <input type="number" min="50" max="400" step="0.1" value={layout.pageSize.w} onChange={(e) => update({ pageSize: { ...layout.pageSize, w: Number(e.target.value) } })} style={{ width: 80 }} aria-label="Width mm" />
          <span className="ds-hint" style={{ margin: 0 }}>×</span>
          <input type="number" min="50" max="600" step="0.1" value={layout.pageSize.h} onChange={(e) => update({ pageSize: { ...layout.pageSize, h: Number(e.target.value) } })} style={{ width: 80 }} aria-label="Height mm" />
          <span className="ds-hint" style={{ margin: 0 }}>mm</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12 }}>
        <Field label="Margin (mm)" style={{ flex: 1 }}>
          <input type="number" min="5" max="50" step="0.5" value={layout.pageMargin ?? 20} onChange={(e) => update({ pageMargin: Number(e.target.value) })} />
        </Field>
        <Field label="Bleed (mm)" style={{ flex: 1 }}>
          <input type="number" min="0" max="25" step="0.5" value={layout.bleed ?? 3} onChange={(e) => update({ bleed: Number(e.target.value) })} />
        </Field>
      </div>
      <p className="ds-hint">
        Final trim ≈ {Math.round(pageSizeMm(layout.pageSize).w)} × {Math.round(pageSizeMm(layout.pageSize).h)} mm · {layout.pageMargin ?? 20} mm margins.
      </p>
      <div className="ds-measure-card">
        <div><span>Estimated pages</span><b>{measurements.pages}</b></div>
        <div><span>Calculated spine</span><b>{measurements.spineMm.toFixed(1)} mm</b></div>
        <div><span>Full wrap</span><b>{measurements.wrapWidthMm.toFixed(1)} × {measurements.wrapHeightMm.toFixed(1)} mm</b></div>
      </div>
      <Field label="Paper thickness (mm per page)">
        <input type="number" min="0.04" max="0.14" step="0.001" value={layout.paperThicknessMm ?? 0.0572} onChange={(event) => update({ paperThicknessMm: Number(event.target.value) })} />
      </Field>
    </>
  )
}

// ─── interior preview ──────────────────────────────────────────────────────────

function parseBlocks(html: string): PageBlock[] {
  if (!html || typeof document === 'undefined') return []
  const div = document.createElement('div')
  div.innerHTML = sanitizeStoredHtml(html)
  const blocks: PageBlock[] = []
  div.childNodes.forEach((node) => {
    if (node.nodeType === 1) {
      const element = node as HTMLElement
      const tag = element.tagName.toLowerCase()
      const wc = (element.textContent ?? '').split(/\s+/).filter(Boolean).length
      blocks.push({ tag, html: element.outerHTML, words: wc })
    } else if (node.nodeType === 3) {
      const text = node.textContent ?? ''
      if (text.trim()) {
        blocks.push({ tag: 'p', html: `<p>${text}</p>`, words: text.split(/\s+/).filter(Boolean).length })
      }
    }
  })
  return blocks
}

function paginateBlocks(blocks: PageBlock[], wordsPerPage: number): PageBlock[][] {
  const pages: PageBlock[][] = []
  let cur: PageBlock[] = []
  let count = 0
  for (const b of blocks) {
    if (count + b.words > wordsPerPage && cur.length > 0) {
      pages.push(cur)
      cur = [b]
      count = b.words
    } else {
      cur.push(b)
      count += b.words
    }
  }
  if (cur.length) pages.push(cur)
  return pages
}

function InteriorPreview({ novel, cover, layout, chapters, font, sig, activeEditorDesign }: { novel: any; cover: any; layout: any; chapters: any[]; font: any; sig: any; activeEditorDesign: string | null }) {
  const headerStyle  = layout.headerStyle  || 'none'
  const headerPos    = layout.headerPos    || 'top-center'
  const pageNumStyle = layout.pageNumStyle || 'plain'
  const pageNumPos   = layout.pageNumPos   || 'bottom-center'
  const bodySize     = layout.bodySize     ?? 11.5
  const dropCap      = !!layout.dropCap
  const dropCapColor = layout.dropCapColor ?? '#2a2520'
  const textAlign    = layout.textAlign    || 'left'
  const firstIndent  = layout.firstIndent  || '0'

  const sharedPreview = buildBookPreview(novel, chapters, layout)
  const pages: Array<{ type: string; chapterTitle?: string; blocks?: PageBlock[]; pageNum?: number }> = []
  sharedPreview.pages.forEach((page) => pages.push({ type: page.type, chapterTitle: page.chapterTitle, blocks: page.html ? parseBlocks(page.html) : [], pageNum: page.pageNum }))
  if (pages.length === 0) pages.push({ type: 'chapter-open', chapterTitle: 'Chapter One', blocks: [{ tag: 'p', html: '<p>The ink is still drying — add chapters to see the interior.</p>', words: 10 }], pageNum: 1 })

  const getHeaderText = (page) => {
    if (headerStyle === 'none' || page.type === 'title' || page.type === 'dedication') return ''
    if (headerStyle === 'title') return novel.title
    if (headerStyle === 'author') return cover.byline || 'Author'
    if (headerStyle === 'chapter') return page.chapterTitle || novel.title
    if (headerStyle === 'title-author') return `${novel.title} · ${cover.byline || 'Author'}`
    return ''
  }

  const renderPageNum = (n: number | string) => {
    if (pageNumStyle === 'none') return null
    if (pageNumStyle === 'ornament') return `❦ ${n} ❦`
    return String(n)
  }

  return (
    <div className={`interior-preview ${activeEditorDesign ? `design-${activeEditorDesign}` : ''}`}>
      <div className="interior-pages">
        {pages.map((page, idx) => {
          const hText    = getHeaderText(page)
          const pNum     = page.pageNum != null ? renderPageNum(page.pageNum) : null
          const isTopOut = headerPos === 'top-outer'
          const isNumTop = pageNumPos.startsWith('top')
          const isNumOut = pageNumPos.includes('outer')
          const isLeft   = idx % 2 === 0

          return (
            <div key={idx} className="interior-page">
              {/* Running header */}
              {hText && (
                <div className={`running-header rh-${headerPos} ${isLeft ? 'rh-left' : 'rh-right'}`}>
                  {isNumTop && isNumOut && isLeft ? <span className="page-num">{pNum}</span> : null}
                  <span className="rh-text">{hText}</span>
                  {isNumTop && isNumOut && !isLeft ? <span className="page-num">{pNum}</span> : null}
                  {isNumTop && !isNumOut ? <span className="page-num">{pNum}</span> : null}
                </div>
              )}
              {!hText && isNumTop && pNum && (
                <div className={`running-header rh-${headerPos}`}>
                  <span className="page-num">{pNum}</span>
                </div>
              )}

              {/* Page content */}
              <div className="page-content">
                {page.type === 'title' && (
                  <div className="chapter-open" style={{ justifyContent: 'center' }}>
                    <div className="chapter-open-title" style={{ fontFamily: font.style?.fontFamily, fontSize: '1.4rem', fontWeight: 600, marginBottom: 8 }}>{novel.title}</div>
                    {cover.subtitle && <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: 6, fontFamily: font.style?.fontFamily }}>{cover.subtitle}</div>}
                    <div style={{ fontSize: '0.9rem', opacity: 0.5, margin: '8px 0' }}>{'ornament' in (cover || {}) ? cover.ornament : '❦'}</div>
                    <div style={{ fontSize: '0.65rem', fontStyle: 'italic', fontFamily: font.style?.fontFamily }}>{cover.byline || ''}</div>
                    {sig.text && <div className={`signature signature-${sig.font || 'cormorant'}`} style={{ marginTop: 24, fontSize: '0.8rem' }}>{sig.text}</div>}
                  </div>
                )}
                {page.type === 'dedication' && (
                  <div className="chapter-open" style={{ justifyContent: 'center' }}>
                    <div style={{ fontFamily: font.style?.fontFamily, fontStyle: 'italic', fontSize: '0.7rem', whiteSpace: 'pre-line', opacity: 0.8, textAlign: 'center' }}>{layout.dedication}</div>
                  </div>
                )}
                {(page.type === 'chapter-open' || page.type === 'body') && (
                  <>
                    {page.type === 'chapter-open' && (
                      <div className="chapter-open">
                        {layout.titleStyle === 'ornament' && <div style={{ fontSize: '0.9rem', marginBottom: 6, opacity: 0.6 }}>✦  ❦  ✦</div>}
                        <div className={`chapter-open-title ${(layout.chapterStyle === 'left' || layout.chapterStyle === 'num-title') ? 'text-left' : ''}`} style={{ fontFamily: font.style?.fontFamily }}>
                          {layout.chapterStyle === 'num-only' || layout.chapterStyle === 'roman' ? '' : page.chapterTitle}
                        </div>
                      </div>
                    )}
                    {page.blocks && page.blocks.length > 0 && (
                      <div
                        className={`page-body${page.type === 'chapter-open' && dropCap ? ' dropcap' : ''}`}
                        style={{
                          fontFamily: font.style?.fontFamily,
                          fontSize: `${bodySize * 1.1}px`,
                          textAlign,
                          ...( { ['--first-indent' as any]: firstIndent } as CSSProperties ),
                          ...( { ['--drop-cap-color' as any]: dropCapColor } as CSSProperties ),
                        }}
                        dangerouslySetInnerHTML={{ __html: page.blocks.map((b: PageBlock) => b.html).join('') }}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Page number bottom */}
              {!isNumTop && pNum && (
                <div className={`page-number pn-${pageNumPos} ${isLeft ? 'pn-left' : 'pn-right'} ${pageNumStyle === 'ornament' ? 'pn-ornament' : ''}`}>
                  {pNum}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── small UI helpers ─────────────────────────────────────────────────────────

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div className="ds-field" style={style}>
      <label className="ds-label">{label}</label>
      {children}
    </div>
  )
}

function SectionDivider({ children }: { children: React.ReactNode }) {
  return <div className="ds-divider">{children}</div>
}

// ─── cover previews ───────────────────────────────────────────────────────────

function FlatWrapPreview({ novel, cover, measurements, designerFontOptions = [] }: { novel: any; cover: any; measurements: any; designerFontOptions?: DesignerFontOption[] }) {
  const fonts = designerFontOptions.length ? designerFontOptions : buildDesignerFontOptions({})
  const titleFont = fonts.find((item) => item.value === (cover.titleFont || 'cormorant'))?.style?.fontFamily || 'var(--font-heading)'
  const titleColor = cover.titleColor || '#ffffff'
  const style = cover.coverStyle || 'moonstone'
  const panel = (surface: string, label: string) => {
    const image = cover[`${surface}Image`]
    return <div className={`flat-wrap-panel flat-wrap-${surface}`} style={{ background: image ? `linear-gradient(rgba(0,0,0,.18),rgba(0,0,0,.3)), url(${image}) center / cover` : undefined }}>
      {!image && <div className={`flat-wrap-color cover-${style}`} />}
      <span className="flat-wrap-label">{label}</span>
      {surface === 'front' && <div className="flat-wrap-front-copy"><strong style={{ color: titleColor, fontFamily: titleFont }}>{novel.title || 'Untitled'}</strong>{novel.author && <small style={{ color: titleColor }}>{novel.author}</small>}</div>}
      {surface === 'back' && novel.blurb && <p style={{ color: titleColor }}>{novel.blurb}</p>}
    </div>
  }
  return <div className="flat-wrap-preview" aria-label="Flat wrap cover preview"><div className="flat-wrap-spread">{panel('back', 'Back')}{panel('spine', 'Spine')}{panel('front', 'Front')}</div><small className="flat-wrap-measurement">{measurements.trimWidthMm.toFixed(1)} × {measurements.trimHeightMm.toFixed(1)} mm wrap · {measurements.spineMm.toFixed(1)} mm spine</small></div>
}

function Cover3D({ novel, cover, autoSpin, immersive, surface, environment, measurements, designerFontOptions = [], onSurfaceSelect, onSurfaceContext }: { novel: any; cover: any; autoSpin?: boolean; immersive?: boolean; surface?: string; environment?: string; measurements: any; designerFontOptions?: DesignerFontOption[]; onSurfaceSelect?: (surface: string) => void; onSurfaceContext?: (event: any, surface?: string) => void }) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [Comp, setComp] = useState<ComponentType<any> | null>(null)
  const [rendererStatus, setRendererStatus] = useState('loading')
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [retryToken, setRetryToken] = useState(0)
  useEffect(() => {
    if (cover.frontImage) { setCoverUrl(cover.frontImage); return }
    const gallery = resolveCoverImageUrl(novel, cover)
    if (gallery) { setCoverUrl(gallery); return }
    if (!novel.cover) { setCoverUrl(null); return }
    if (typeof novel.cover === 'string') {
      setCoverUrl(/^(data:|blob:|https?:\/\/)/i.test(novel.cover) ? novel.cover : null)
      return
    }
    if (!(novel.cover instanceof Blob)) { setCoverUrl(null); return }
    const u = URL.createObjectURL(novel.cover)
    setCoverUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [novel, cover])
  useEffect(() => { import('./CoverMockup3D').then((m) => setComp(() => m.default)) }, [retryToken])

  if (!Comp) return <div className="cover-mockup-3d ds-loading">setting the scene…</div>
  if (rendererStatus === 'fallback' || rendererStatus === 'context-lost' || rendererStatus === 'error') {
    return <div className="cover-renderer-fallback">
      <FlatWrapPreview novel={novel} cover={cover} measurements={measurements} designerFontOptions={designerFontOptions} />
      <div className="cover-renderer-notice"><strong>3D preview is unavailable on this device.</strong><span>Your cover is safe and fully editable.</span><div><button type="button" className="button button-ghost" onClick={() => { setRendererStatus('loading'); setRetryToken((value) => value + 1) }}>Retry 3D</button><button type="button" className="button button-ghost" onClick={() => setRendererStatus('fallback')}>Continue in 2D</button>{diagnostics && <button type="button" className="button button-ghost" onClick={() => navigator.clipboard?.writeText(JSON.stringify(diagnostics, null, 2))}>Copy diagnostics</button>}</div></div>
    </div>
  }

  const availableFonts = designerFontOptions.length ? designerFontOptions : buildDesignerFontOptions({})
  const titleFont = availableFonts.find((f) => f.value === (cover.titleFont || 'cormorant')) || availableFonts[0]
  const titleShadow = TEXT_SHADOWS.find((s) => s.id === cover.titleShadow)?.value || 'none'

  return (
    <div className="cover-renderer-shell">
      <div className="cover-renderer-status"><span className="designer-save-dot" />3D preview · {window.localStorage?.getItem?.('moonscribe_3d_quality') || 'crisp'}</div>
    <Comp
      title={novel.title}
      subtitle={cover.subtitle || ''}
      byline={cover.byline || novel.byline || ''}
      coverStyle={novel.coverStyle || 'moonstone'}
      gradient={cover.gradient || null}
      coverImage={coverUrl && cover.showImage !== false ? coverUrl : null}
      frontCrop={cover.frontCrop}
      backImage={cover.backImage || null}
      backCrop={cover.backCrop}
      spineImage={cover.spineImage || null}
      spineCrop={cover.spineCrop}
      ornament={'ornament' in (cover || {}) ? cover.ornament : '❦'}
      titleColor={cover.titleColor || '#ffffff'}
      titleShadow={cover.titleShadow || 'none'}
      titleFont={titleFont.value}
      titleFontFamily={titleFont.style?.fontFamily}
      titleSize={cover.titleSize || 'md'}
      titleWeight={cover.titleWeight || '600'}
      titleSpacing={cover.titleSpacing || '0'}
      titleTransform={cover.titleTransform || 'none'}
      autoSpin={autoSpin !== false}
      immersive={immersive}
      showText={cover.showFrontText !== false}
      showBackText={cover.showBackText !== false}
      showSpineText={cover.showSpineText !== false}
      backCopy={novel.blurb || ''}
      frontComponents={cover.frontComponents || []}
      backComponents={cover.backComponents || []}
      spineComponents={cover.spineComponents || []}
      activeSurface={surface}
      environment={environment}
      onSurfaceSelect={onSurfaceSelect}
      onSurfaceContext={onSurfaceContext}
      trimWidthMm={measurements.trimWidthMm}
      trimHeightMm={measurements.trimHeightMm}
      spineMm={measurements.spineMm}
      quality={window.localStorage?.getItem?.('moonscribe_3d_quality') || 'crisp'}
      reducedMotion={window.matchMedia?.('(prefers-reduced-motion: reduce)').matches}
      onStatusChange={(status, info) => { setRendererStatus(status); if (info) setDiagnostics(info) }}
    />
    </div>
  )
}

// ─── PNG export ───────────────────────────────────────────────────────────────

function exportCoverPng(novel: any, cover: any, designerFontOptions: DesignerFontOption[] = buildDesignerFontOptions({})) {
  const W = 600, H = 900
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (cover.gradient) {
    const g = ctx.createLinearGradient(0, 0, W * 0.9, H)
    g.addColorStop(0, cover.gradFrom || '#16151a'); g.addColorStop(1, cover.gradTo || '#1d1c22')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  } else {
    const bg = { moonstone: ['#8fb2d4', '#7ba3c9', '#a6c2dd'], rose: ['#e0b9b9', '#d4a5a5', '#e3c2c2'], sage: ['#b8d0b8', '#a8c5a8', '#c3d8c3'], sand: ['#e3cfa9', '#d8b48f', '#e8d7b8'], twilight: ['#5f82a4', '#4a6b8a', '#6f90ae'] }[novel.coverStyle || 'moonstone'] || ['#16151a', '#1d1c22', '#16151a']
    const g = ctx.createLinearGradient(0, 0, W * 0.9, H)
    g.addColorStop(0, bg[0]); g.addColorStop(0.55, bg[1]); g.addColorStop(1, bg[2])
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  }

  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.9)
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,40,55,0.28)')
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H)

  const finish = () => {
    const availableFonts = designerFontOptions.length ? designerFontOptions : buildDesignerFontOptions({})
    const titleFontObj = availableFonts.find((f) => f.value === (cover.titleFont || 'cormorant')) || availableFonts[0]
    const titleSizeVal = TITLE_SIZES.find((s) => s.id === (cover.titleSize || 'md'))?.value || '3.2rem'
    const titlePx = Math.min(W * 0.09, parseFloat(titleSizeVal) * 10)
    const titleWeight = cover.titleWeight || '600'
    const titleSpacing = cover.titleSpacing || '0'
    const titleTransform = cover.titleTransform || 'none'
    const titleShadowId = cover.titleShadow || 'none'
    const shadowVal = TEXT_SHADOWS.find((s) => s.id === titleShadowId)?.value || 'none'
    const fontFamily = titleFontObj?.style?.fontFamily || "'Cormorant Garamond', Georgia, serif"
    let titleText = novel.title || ''
    if (titleTransform === 'uppercase') titleText = titleText.toUpperCase()
    if (titleTransform === 'lowercase') titleText = titleText.toLowerCase()
    if (titleTransform === 'capitalize') titleText = titleText.replace(/\b\w/g, (c: string) => c.toUpperCase())

    ctx.textAlign = 'center'; ctx.fillStyle = cover.titleColor || '#ffffff'
    if (shadowVal !== 'none') {
      const sm = shadowVal.match(/(\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px\s+(rgba?\([^)]+\))/)
      if (sm) { ctx.shadowOffsetX = Number(sm[1]); ctx.shadowOffsetY = Number(sm[2]); ctx.shadowBlur = Number(sm[3]); ctx.shadowColor = sm[4] }
      else { ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 14 }
    }
    ctx.letterSpacing = titleSpacing
    ctx.font = `${titleWeight} ${titlePx}px ${fontFamily}`
    const words = titleText.split(' '); let line = ''; const lines: string[] = []
    for (const w of words) { if (ctx.measureText(line + ' ' + w).width > W * 0.82 && line) { lines.push(line); line = w } else { line = (line + ' ' + w).trim() } }
    if (line) lines.push(line)
    const lineH = titlePx * 1.25
    let y = H * 0.38 - ((lines.length - 1) * lineH) / 2
    for (const l of lines) { ctx.fillText(l, W / 2, y); y += lineH }
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.letterSpacing = '0px'
    ctx.font = `${W * 0.05}px ${fontFamily}`
    ctx.fillText('ornament' in (cover || {}) ? cover.ornament || '' : '❦', W / 2, y + 40)
    ctx.font = `italic ${W * 0.036}px ${fontFamily}`
    ctx.fillText(cover.byline || 'for Storm Tattersall', W / 2, H * 0.78)
    canvas.toBlob((blob) => {
      if (!blob) return
      const name = (novel.title || 'cover').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, '_').slice(0, 40) || 'cover'
      downloadBlob(blob, `${name}-cover.png`)
    }, 'image/png')
  }

  const drawImg = (img: HTMLImageElement) => { ctx.globalAlpha = 0.55; const sc = Math.max(W / img.width, H / img.height); ctx.drawImage(img, (W - img.width * sc) / 2, (H - img.height * sc) / 2, img.width * sc, img.height * sc); ctx.globalAlpha = 1 }
  const gUrl = resolveCoverImageUrl(novel, cover)
  if (gUrl) { const i = new Image(); i.onload = () => { drawImg(i); finish() }; i.src = gUrl }
  else if (novel.cover && cover.showImage && novel.cover instanceof Blob) { const u = URL.createObjectURL(novel.cover); const i = new Image(); i.onload = () => { drawImg(i); URL.revokeObjectURL(u); finish() }; i.src = u }
  else if (typeof novel.cover === 'string' && cover.showImage && /^(data:|blob:|https?:\/\/)/i.test(novel.cover)) { const i = new Image(); i.onload = () => { drawImg(i); finish() }; i.onerror = finish; i.src = novel.cover }
  else finish()
}

function excerpt(html, symbol) {
  if (!html) return '<p class="muted">…</p>'
  const text = htmlToText(html)
  const words = text.split(/\s+/).filter(Boolean).slice(0, 70).join(' ')
  return `<p>${words.replace(/❦/g, `</p><div class="scene-break">${symbol}</div><p>`)}…</p>`
}
