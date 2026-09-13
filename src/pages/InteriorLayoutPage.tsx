import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getNovel, updateNovel } from '../db/novels'
import { listChapters } from '../db/chapters'
import { PAGE_PRESETS, pageSizeMm } from '../utils/pageSize'
import { buildBookPreview } from '../utils/bookPreview'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import Select from '../components/Select'
import './interior-layout.css'

type InteriorLayoutConfig = {
  pageSize: string
  orientation: 'portrait' | 'landscape'
  margins: { top: number; bottom: number; inside: number; outside: number }
  gutter: number
  showHeaders: boolean
  showPageNumbers: boolean
  showMarginsGuide: boolean
  showGutterGuide: boolean
  spread: boolean
  bodyFont: string
  bodySize: number
  lineHeight: number
  paragraphStyle: 'justified' | 'left'
  firstLineIndent: number
  chapterFont: string
  chapterSize: number
  chapterCase: 'title' | 'upper' | 'sentence'
  chapterAlignment: 'center' | 'left'
  paragraphSpacing: number
  sceneBreak: string
  dropCaps: boolean
  dropCapsByChapter: Record<string, boolean>
  dropCapLines: number
  textColor: string
  headerLeft: string
  headerRight: string
  footer: string
  pageNumberPosition: string
}

const DEFAULT_CONFIG: InteriorLayoutConfig = {
  pageSize: 'a5', orientation: 'portrait', margins: { top: 20, bottom: 20, inside: 25, outside: 20 }, gutter: 12,
  showHeaders: true, showPageNumbers: true, showMarginsGuide: false, showGutterGuide: false, spread: true,
  bodyFont: 'Lora', bodySize: 11, lineHeight: 1.5, paragraphStyle: 'justified', firstLineIndent: 1.2,
  chapterFont: 'Cormorant Garamond', chapterSize: 24, chapterCase: 'title', paragraphSpacing: 0,
  chapterAlignment: 'center',
  sceneBreak: '❦', dropCaps: true, dropCapsByChapter: {}, dropCapLines: 3, textColor: '#1a1714', headerLeft: 'novel', headerRight: 'chapter', footer: 'page', pageNumberPosition: 'bottom-center'
}

const TABS = [
  ['layout', 'fa-regular fa-file-lines', 'Layout'], ['typography', 'fa-solid fa-font', 'Typography'], ['chapters', 'fa-solid fa-heading', 'Chapter Styles'],
  ['headers', 'fa-solid fa-arrows-left-right', 'Headers & Footers'], ['numbers', 'fa-solid fa-list-ol', 'Page Numbers'], ['ornaments', 'fa-solid fa-sparkles', 'Ornaments'], ['global', 'fa-solid fa-sliders', 'Global Styles']
]

function normalizeConfig(value: any): InteriorLayoutConfig {
  return { ...DEFAULT_CONFIG, ...(value || {}), dropCapsByChapter: { ...DEFAULT_CONFIG.dropCapsByChapter, ...(value?.dropCapsByChapter || {}) }, margins: { ...DEFAULT_CONFIG.margins, ...(value?.margins || {}) } }
}

function titleCase(value: string, mode: InteriorLayoutConfig['chapterCase']) {
  if (mode === 'upper') return value.toUpperCase()
  if (mode === 'sentence') return value ? `${value[0].toUpperCase()}${value.slice(1).toLowerCase()}` : value
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}

function chapterLabel(chapter: any, index: number) {
  return chapter?.title?.trim() || `Chapter ${index + 1}`
}

function paginate(novel: any, chapters: any[], config: InteriorLayoutConfig) {
  const printableChapters = chapters.filter((chapter) => !['book', 'part', 'act'].includes(chapter?.kind))
  const preview = buildBookPreview(novel, printableChapters, {
    ...(novel?.layout || {}), pageSize: config.pageSize, pageMargin: config.margins.top,
    bodySize: config.bodySize, lineSpacing: config.lineHeight, dropCap: config.dropCaps,
    sceneBreak: config.sceneBreak, includeFrontMatter: false,
  })
  const pages = preview.pages.map((page: any, index: number) => {
    const chapterIndex = Math.max(0, printableChapters.findIndex((chapter) => chapter.id === page.chapterId))
    const chapter = printableChapters[chapterIndex]
    const title = page.chapterTitle || chapterLabel(chapter, chapterIndex)
    const heading = page.type === 'chapter-open' ? `<div class="interior-chapter-opening ${config.chapterAlignment === 'left' ? 'is-left' : ''}"><span class="interior-chapter-kicker">Chapter ${chapterIndex + 1}</span><h2>${titleCase(title, config.chapterCase)}</h2></div>` : ''
    return { chapter, chapterIndex, title, html: `${heading}${page.html || '<p></p>'}`, number: page.pageNum || index + 1 }
  })
  return pages.length ? pages : [{ chapter: null, chapterIndex: 0, title: 'A new chapter', html: '<p>Your manuscript will appear here as you write.</p>', number: 1 }]
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="interior-field"><span>{label}</span>{children}</label> }
function Section({ title, children }: { title: string; children: React.ReactNode; open?: boolean }) { const ref = useRef<HTMLDetailsElement>(null); useEffect(() => { if (ref.current) ref.current.open = true }, []); return <details ref={ref} className="interior-section"><summary>{title}<Icon icon="fa-solid fa-chevron-down" /></summary><div className="interior-section-body">{children}</div></details> }

export default function InteriorLayoutPage({ novelId, embedded = false }: { novelId: string; embedded?: boolean }) {
  const { toast, systemFonts = [], customFonts = [] } = useApp() as any
  const [novel, setNovel] = useState<any>(null)
  const [chapters, setChapters] = useState<any[]>([])
  const [config, setConfig] = useState<InteriorLayoutConfig>(DEFAULT_CONFIG)
  const [tab, setTab] = useState('layout')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [pageIndex, setPageIndex] = useState(0)
  const [zoom, setZoom] = useState(78)
  const [saved, setSaved] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<'layout' | 'preview' | 'chapters' | 'more'>('preview')
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => { Promise.all([getNovel(novelId), listChapters(novelId)]).then(([nextNovel, nextChapters]) => { setNovel(nextNovel); setChapters(nextChapters); setConfig(normalizeConfig(nextNovel?.layout?.interiorLayout)) }) }, [novelId])
  useEffect(() => { if (config.spread && zoom > 60) setZoom(60) }, [config.spread, zoom])
  const pages = useMemo(() => paginate(novel, chapters, config), [novel, chapters, config])
  const current = pages[Math.min(pageIndex, pages.length - 1)]
  const second = config.spread && pageIndex + 1 < pages.length ? pages[pageIndex + 1] : null
  const dropCapsForPage = (page: any) => page?.chapter?.id ? (config.dropCapsByChapter[page.chapter.id] ?? config.dropCaps) : config.dropCaps
  const dims = useMemo(() => { const raw = pageSizeMm(config.pageSize); return config.orientation === 'landscape' ? { w: raw.h, h: raw.w } : raw }, [config.pageSize, config.orientation])
  const fonts = useMemo(() => Array.from(new Set(['Lora', 'Literata', 'Cormorant Garamond', ...systemFonts.map((font: any) => font.family || font.name), ...customFonts.map((font: any) => font.family || font.name)].filter(Boolean))), [systemFonts, customFonts])

  const patch = useCallback((next: Partial<InteriorLayoutConfig>) => { setConfig((value) => ({ ...value, ...next })); setSaved(false) }, [])
  const save = useCallback(async () => { if (!novel) return; const next = await updateNovel(novelId, { layout: { ...(novel.layout || {}), interiorLayout: config }, updatedAt: Date.now() }); setNovel(next); setSaved(true); toast?.('Interior layout saved.') }, [config, novel, novelId, toast])
  const resetDefaults = useCallback(() => { setConfig({ ...DEFAULT_CONFIG, margins: { ...DEFAULT_CONFIG.margins } }); setSaved(false); toast?.('Interior layout reset to defaults.') }, [toast])
  const applyToBook = useCallback(async () => { if (!novel) return; const next = await updateNovel(novelId, { layout: { ...(novel.layout || {}), interiorLayout: config }, updatedAt: Date.now() }); setNovel(next); setSaved(true); toast?.(`Interior layout applied to all ${chapters.length || 0} chapters.`) }, [chapters.length, config, novel, novelId, toast])
  useEffect(() => { const timer = window.setTimeout(() => { if (!saved && novel) void save() }, 900); return () => window.clearTimeout(timer) }, [config, novel, save, saved])

  const headerText = (page: any, side: 'left' | 'right') => {
    const setting = side === 'left' ? config.headerLeft : config.headerRight
    if (setting === 'none') return ''
    if (setting === 'chapter') return page.title
    if (setting === 'author') return novel?.author || novel?.authorName || 'Author'
    if (setting === 'custom') return novel?.title || ''
    return novel?.title || ''
  }
  const renderPage = (page: any, side: 'left' | 'right') => <article className={`interior-paper ${side}`} style={{ '--page-w': `${dims.w}mm`, '--page-h': `${dims.h}mm`, '--page-scale': zoom / 100, '--paper-font': config.bodyFont, '--paper-size': `${config.bodySize}pt`, '--paper-leading': config.lineHeight, '--paper-color': config.textColor, '--page-top': `${config.margins.top}mm`, '--page-bottom': `${config.margins.bottom}mm`, '--page-inside': `${config.margins.inside + config.gutter / 2}mm`, '--page-outside': `${config.margins.outside}mm`, '--chapter-font': config.chapterFont, '--chapter-size': `${config.chapterSize}pt`, '--paragraph-indent': `${config.firstLineIndent}em`, '--paragraph-gap': `${config.paragraphSpacing}em` } as React.CSSProperties}>
    {config.showHeaders && headerText(page, side) && <header className="interior-running-header"><span>{headerText(page, side)}</span></header>}
    <div className={`interior-paper-body ${config.paragraphStyle === 'left' ? 'is-left' : 'is-justified'} ${dropCapsForPage(page) ? 'has-drop-caps' : ''} ${config.showMarginsGuide ? 'show-guides' : ''} ${config.showGutterGuide ? 'show-gutter' : ''}`} dangerouslySetInnerHTML={{ __html: page.html }} />
    {config.showPageNumbers && <footer className={`interior-page-number ${config.pageNumberPosition}`}>{page.number}</footer>}
  </article>

  const leftPanel = <aside className="interior-panel interior-left-panel"><div className="interior-panel-heading"><div><span className="interior-eyebrow">Book setup</span><h2>Page Layout</h2></div><button className="interior-icon-button" onClick={() => { setTab('global'); setInspectorOpen(true) }} aria-label="Open global layout preferences"><Icon icon="fa-solid fa-sliders" /></button></div>
    <Section title="Preset"><Field label="Page size"><Select value={config.pageSize} onChange={(value) => patch({ pageSize: value })} options={PAGE_PRESETS.map((preset) => ({ value: preset.key, label: preset.label }))} ariaLabel="Page size" /></Field></Section>
    <Section title="Orientation"><div className="interior-segmented">{(['portrait', 'landscape'] as const).map((value) => <button key={value} className={config.orientation === value ? 'active' : ''} onClick={() => patch({ orientation: value })}><Icon icon={value === 'portrait' ? 'fa-regular fa-file' : 'fa-solid fa-arrows-left-right'} />{value[0].toUpperCase() + value.slice(1)}</button>)}</div></Section>
    <Section title="Margins (mm)"><div className="interior-grid-2">{(['top', 'bottom', 'inside', 'outside'] as const).map((key) => <Field key={key} label={key}><input type="number" min="5" max="60" value={config.margins[key]} onChange={(e) => patch({ margins: { ...config.margins, [key]: Number(e.target.value) } })} /></Field>)}</div><Field label="Gutter"><input type="number" min="0" max="30" value={config.gutter} onChange={(e) => patch({ gutter: Number(e.target.value) })} /></Field></Section>
    <Section title="Preview Elements"><div className="interior-checks">{[['showHeaders', 'Show headers'], ['showPageNumbers', 'Show page numbers'], ['showMarginsGuide', 'Show margins guide'], ['showGutterGuide', 'Show gutter guide']].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(config[key as keyof InteriorLayoutConfig])} onChange={(e) => patch({ [key]: e.target.checked } as any)} /><span>{label}</span></label>)}</div></Section>
    <div className="interior-apply-card"><strong>Apply to entire book</strong><span>Use these page settings for every chapter in this novel.</span><button onClick={applyToBook}>Apply to all chapters</button></div>
  </aside>

  const ornamentOptions = [{ value: '❦', label: '❦' }, { value: '⁂', label: '⁂' }, { value: '✦', label: '✦' }, { value: '◆', label: '◆' }, { value: '', label: 'None' }]
  const inspectorExtra = tab === 'headers' ? <div className="interior-extra-panel"><Section title="Running Headers"><Field label="Left page"><Select value={config.headerLeft} onChange={(value) => patch({ headerLeft: value })} options={[{ value: 'none', label: 'None' }, { value: 'novel', label: 'Novel title' }, { value: 'author', label: 'Author name' }, { value: 'custom', label: 'Custom text' }]} ariaLabel="Left page header" /></Field><Field label="Right page"><Select value={config.headerRight} onChange={(value) => patch({ headerRight: value })} options={[{ value: 'none', label: 'None' }, { value: 'novel', label: 'Novel title' }, { value: 'chapter', label: 'Chapter title' }, { value: 'custom', label: 'Custom text' }]} ariaLabel="Right page header" /></Field></Section><Section title="Footer"><Field label="Footer"><Select value={config.footer} onChange={(value) => patch({ footer: value })} options={[{ value: 'none', label: 'None' }, { value: 'page', label: 'Page number' }, { value: 'custom', label: 'Custom text' }]} ariaLabel="Footer" /></Field></Section></div>
    : tab === 'numbers' ? <div className="interior-extra-panel"><Section title="Page Numbers"><label className="interior-switch-row"><span>Show page numbers</span><input type="checkbox" checked={config.showPageNumbers} onChange={(e) => patch({ showPageNumbers: e.target.checked })} /></label><Field label="Position"><Select value={config.pageNumberPosition} onChange={(value) => patch({ pageNumberPosition: value })} options={[{ value: 'bottom-left', label: 'Bottom left' }, { value: 'bottom-center', label: 'Bottom center' }, { value: 'bottom-right', label: 'Bottom right' }]} ariaLabel="Page number position" /></Field></Section></div>
    : tab === 'ornaments' ? <div className="interior-extra-panel"><Section title="Scene Breaks"><Field label="Ornament"><Select value={config.sceneBreak} onChange={(value) => patch({ sceneBreak: value })} options={ornamentOptions} ariaLabel="Scene break ornament" /></Field></Section><Section title="Chapter Ornament"><Field label="Separator"><Select value={config.sceneBreak} onChange={(value) => patch({ sceneBreak: value })} options={ornamentOptions} ariaLabel="Chapter ornament" /></Field></Section></div>
    : tab === 'global' ? <div className="interior-extra-panel"><Section title="Global Styles"><p className="interior-extra-copy">These settings are stored with the novel and used by the live interior preview and print proof.</p><button className="interior-reset" onClick={resetDefaults}>Reset all interior styles</button></Section></div>
    : null

  const rightPanel = <aside className="interior-panel interior-right-panel" data-tab={tab}><div className="interior-panel-heading"><div><span className="interior-eyebrow">Book style</span><h2>{tab === 'chapters' ? 'Chapter Styles' : tab === 'headers' ? 'Headers & Footers' : tab === 'numbers' ? 'Page Numbers' : tab === 'ornaments' ? 'Ornaments' : tab === 'global' ? 'Global Styles' : 'Typography'}</h2></div><button className="interior-icon-button" onClick={() => setInspectorOpen(false)} aria-label="Close inspector"><Icon icon="fa-solid fa-xmark" /></button></div>
    {inspectorExtra}
    {tab === 'chapters' ? <><Section title="Chapter Headings"><Field label="Heading font"><Select value={config.chapterFont} onChange={(value) => patch({ chapterFont: value })} options={fonts.map((font) => ({ value: font, label: font }))} ariaLabel="Chapter heading font" /></Field><div className="interior-grid-2"><Field label="Size"><input type="number" value={config.chapterSize} onChange={(e) => patch({ chapterSize: Number(e.target.value) })} /></Field><Field label="Case"><Select value={config.chapterCase} onChange={(value) => patch({ chapterCase: value as InteriorLayoutConfig['chapterCase'] })} options={[{ value: 'title', label: 'Title Case' }, { value: 'upper', label: 'Uppercase' }, { value: 'sentence', label: 'Sentence case' }]} ariaLabel="Chapter heading case" /></Field></div></Section><Section title="Chapter Opening"><Field label="Alignment"><Select value={config.chapterAlignment} onChange={(value) => patch({ chapterAlignment: value as InteriorLayoutConfig['chapterAlignment'] })} options={[{ value: 'center', label: 'Centered' }, { value: 'left', label: 'Left' }]} ariaLabel="Chapter opening alignment" /></Field><Field label="Ornament"><Select value={config.sceneBreak} onChange={(value) => patch({ sceneBreak: value })} options={ornamentOptions} ariaLabel="Chapter opening ornament" /></Field></Section></> : <><Section title="Body"><Field label="Body font"><Select value={config.bodyFont} onChange={(value) => patch({ bodyFont: value })} options={fonts.map((font) => ({ value: font, label: font }))} ariaLabel="Body font" /></Field><div className="interior-grid-2"><Field label="Font size"><input type="number" step="0.5" value={config.bodySize} onChange={(e) => patch({ bodySize: Number(e.target.value) })} /><small>pt</small></Field><Field label="Line height"><input type="number" step="0.1" value={config.lineHeight} onChange={(e) => patch({ lineHeight: Number(e.target.value) })} /></Field></div><div className="interior-grid-2"><Field label="Paragraph style"><Select value={config.paragraphStyle} onChange={(value) => patch({ paragraphStyle: value as InteriorLayoutConfig['paragraphStyle'] })} options={[{ value: 'justified', label: 'Justified' }, { value: 'left', label: 'Left aligned' }]} ariaLabel="Paragraph style" /></Field><Field label="First line indent"><input type="number" step="0.1" value={config.firstLineIndent} onChange={(e) => patch({ firstLineIndent: Number(e.target.value) })} /></Field></div></Section><Section title="Chapter Headings"><Field label="Heading font"><Select value={config.chapterFont} onChange={(value) => patch({ chapterFont: value })} options={fonts.map((font) => ({ value: font, label: font }))} ariaLabel="Chapter heading font" /></Field><div className="interior-grid-2"><Field label="Size"><input type="number" value={config.chapterSize} onChange={(e) => patch({ chapterSize: Number(e.target.value) })} /></Field><Field label="Case"><Select value={config.chapterCase} onChange={(value) => patch({ chapterCase: value as InteriorLayoutConfig['chapterCase'] })} options={[{ value: 'title', label: 'Title Case' }, { value: 'upper', label: 'Uppercase' }, { value: 'sentence', label: 'Sentence case' }]} ariaLabel="Chapter heading case" /></Field></div></Section><Section title="Paragraph Spacing"><Field label="Spacing"><input type="number" step="0.1" value={config.paragraphSpacing} onChange={(e) => patch({ paragraphSpacing: Number(e.target.value) })} /></Field></Section><Section title="Drop Caps"><label className="interior-switch-row"><span>Enable drop caps for {current.title}</span><input type="checkbox" checked={dropCapsForPage(current)} onChange={(e) => patch({ dropCapsByChapter: { ...config.dropCapsByChapter, [current.chapter?.id || 'current']: e.target.checked } })} /></label><Field label="Lines"><input type="number" min="2" max="5" value={config.dropCapLines} onChange={(e) => patch({ dropCapLines: Number(e.target.value) })} /></Field></Section></>}
    <button className="interior-reset" onClick={resetDefaults}>Reset to defaults</button>
  </aside>

  if (!novel) return <div className="interior-layout-loading">Preparing your book interior…</div>
  return <div className={`interior-layout ${embedded ? 'embedded' : ''}`}>
    <header className="interior-page-header"><div><span className="interior-breadcrumb">{novel.title} <Icon icon="fa-solid fa-chevron-right" /> <strong>Interior Layout</strong></span><h1>Interior Layout</h1><p>Shape the reading experience, page by page.</p></div><div className="interior-header-actions"><span className="interior-save-state">{saved ? 'Saved' : 'Saving…'}</span><button className="interior-secondary-button" onClick={save}><Icon icon="fa-regular fa-floppy-disk" /> Save</button><button className="interior-secondary-button" onClick={() => setMobilePanel('preview')}><Icon icon="fa-regular fa-eye" /> Preview</button><button className="interior-primary-button" onClick={() => toast?.('Print-ready export will use these same interior settings.')}><Icon icon="fa-solid fa-file-export" /> Export Layout</button></div></header>
    <nav className="interior-tabs" aria-label="Interior layout tools">{TABS.map(([key, icon, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setInspectorOpen(key !== 'layout'); if (key !== 'layout') setMobilePanel('more') }}><Icon icon={icon} />{label}</button>)}</nav>
    <div className="interior-mobile-toolbar"><button className={mobilePanel === 'layout' ? 'active' : ''} onClick={() => setMobilePanel('layout')}><Icon icon="fa-regular fa-file-lines" />Layout</button><button className={mobilePanel === 'preview' ? 'active' : ''} onClick={() => setMobilePanel('preview')}><Icon icon="fa-regular fa-eye" />Preview</button><button className={mobilePanel === 'chapters' ? 'active' : ''} onClick={() => setMobilePanel('chapters')}><Icon icon="fa-solid fa-heading" />Chapters</button><button className={mobilePanel === 'more' ? 'active' : ''} onClick={() => setMobilePanel('more')}><Icon icon="fa-solid fa-ellipsis" />More</button></div>
    <div className={`interior-workspace ${inspectorOpen ? '' : 'inspector-closed'}`}>{leftPanel}<main className="interior-preview-column" ref={previewRef}><div className="interior-preview-toolbar"><span>Pages</span><button onClick={() => setPageIndex((i) => Math.max(0, i - (config.spread ? 2 : 1)))} aria-label="Previous pages"><Icon icon="fa-solid fa-chevron-left" /></button><button onClick={() => setPageIndex((i) => Math.min(Math.max(0, pages.length - 1), i + (config.spread ? 2 : 1)))} aria-label="Next pages"><Icon icon="fa-solid fa-chevron-right" /></button><strong>{current.number}{second ? ` – ${second.number}` : ''} / {pages.length}</strong><Select value={String(zoom)} onChange={(value) => setZoom(Number(value))} options={[{ value: '60', label: '60%' }, { value: '78', label: '78%' }, { value: '100', label: '100%' }]} ariaLabel="Preview zoom" width={64} className="interior-preview-select" /><button className="interior-tool-toggle" onClick={() => patch({ spread: !config.spread })}>{config.spread ? 'Two-page spread' : 'Single page'}</button>{!inspectorOpen && <button className="interior-tool-toggle" onClick={() => setInspectorOpen(true)}>Typography</button>}</div><div className={`interior-book-stage ${config.spread ? 'is-spread' : 'is-single'}`}><div className="interior-book-spread" style={{ '--page-scale': zoom / 100 } as React.CSSProperties}>{renderPage(current, 'left')}{second && renderPage(second, 'right')}</div></div><div className="interior-chapter-caption"><span>{current.title}</span><span>{saved ? 'All changes saved locally' : 'Updating preview…'}</span></div><div className="interior-thumbnails" aria-label="Page thumbnails">{pages.slice(Math.max(0, pageIndex - 3), Math.min(pages.length, pageIndex + 7)).map((page, i) => <button key={`${page.number}-${i}`} className={page.number === current.number ? 'active' : ''} onClick={() => setPageIndex(pages.findIndex((item) => item.number === page.number))}><span className="thumbnail-paper"><small>{page.number}</small><i /><i /><i /></span><em>{page.number}</em></button>)}</div></main>{inspectorOpen && rightPanel}</div>
    <div className="interior-mobile-panels">{mobilePanel === 'layout' && leftPanel}{mobilePanel === 'chapters' && rightPanel}{mobilePanel === 'more' && rightPanel}</div>
  </div>
}
