import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getNovel, updateNovel } from '../db/novels'
import { listChapters } from '../db/chapters'
import { listFolders } from '../db/folders'
import { PAGE_PRESETS, pageSizeMm, pageMarginMm } from '../utils/pageSize'
import { computeNumbers, titleFor, isContainer } from '../utils/numbering'
import { sanitizeStoredHtml } from '../utils/formatHtml'
import '../styles/print.css'
import { designPrintTheme } from '../designs/registry'
import { buildBookPreview } from '../utils/bookPreview'

const FONTS = {
  literata: "'Literata', Georgia, serif",
  cormorant: "'Cormorant Garamond', Georgia, serif",
  georgia: 'Georgia, serif'
}

export default function PrintView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [novel, setNovel] = useState<any>(null)
  const [chapters, setChapters] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [layout, setLayout] = useState<Record<string, any>>({})
  const [useDesignerTheme, setUseDesignerTheme] = useState(true)
  const [device, setDevice] = useState('print')
  const [mode, setMode] = useState<'proof' | 'reader' | 'continuous'>('proof')
  const [zoom, setZoom] = useState(1)
  const [selectedPage, setSelectedPage] = useState(0)

  useEffect(() => {
    ;(async () => {
      const n = await getNovel(id)
      setNovel(n)
      setChapters(await listChapters(id))
      setFolders(await listFolders(id))
      let printOptions: Record<string, any> = {}
      try {
        printOptions = JSON.parse(sessionStorage.getItem(`moonscribe:print:${id}`) || '{}')
      } catch {
        // Ignore invalid stale print preferences.
      }
      setUseDesignerTheme(printOptions.useDesignerTheme !== false)
      setLayout({ ...(n.layout || {}), ...printOptions })
    })()
  }, [id])

  // Keep the print surface live when edits arrive from another tab/device.
  useEffect(() => {
    const refresh = (event: Event) => {
      const record = 'detail' in event ? (event as CustomEvent).detail : null
      if (String(record?.novelId || '') !== String(id)) return
      Promise.all([getNovel(id), listChapters(id), listFolders(id)]).then(([nextNovel, nextChapters, nextFolders]) => {
        if (nextNovel) setNovel(nextNovel)
        setChapters(nextChapters)
        setFolders(nextFolders)
      }).catch(() => {})
    }
    window.addEventListener('moonscribe:remote-record', refresh)
    return () => window.removeEventListener('moonscribe:remote-record', refresh)
  }, [id])

  const fontFamily = FONTS[layout.bodyFont] || FONTS.literata
  const bodyPx = (layout.bodySize ?? 11.5) * 1.25
  const symbol = layout.sceneBreak || '❦'
  const sig = layout.signature || {}
  const sortMode = novel?.layout?.chapterSort || 'order'
  const proofChapters = useMemo(() => {
    const next = [...chapters]
    if (sortMode === 'alpha') {
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
      return next.sort((a, b) => collator.compare(a.title || '', b.title || ''))
    }
    if (sortMode === 'number') {
      const numbersForSort = computeNumbers(next)
      return next.sort((a, b) => (numbersForSort.get(a.id)?.number || 0) - (numbersForSort.get(b.id)?.number || 0))
    }
    return next.sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [chapters, sortMode])
  const numbers = computeNumbers(proofChapters)
  const printableChapters = proofChapters.filter((chapter) => !isContainer(chapter))
  const folderIds = new Set(folders.map((folder) => folder.id))

  const { w, h } = pageSizeMm(layout.pageSize)
  const margin = pageMarginMm(layout.pageMargin)
  const bleed = Number(layout.bleed) || 0
  const pageCss = `@page { size: ${Math.round((w + 2 * bleed) * 100) / 100}mm ${Math.round((h + 2 * bleed) * 100) / 100}mm; margin: ${margin}mm; }`
  const theme = useDesignerTheme ? designPrintTheme(layout) : designPrintTheme({})
  const updateGeometry = (patch) => {
    const next = { ...layout, ...patch }
    setLayout(next)
    updateNovel(id, { layout: { ...(novel.layout || {}), ...patch } })
    setNovel((current) => ({ ...current, layout: { ...(current.layout || {}), ...patch } }))
  }
  const cycleChapterSort = () => {
    const value = sortMode === 'order' ? 'number' : sortMode === 'number' ? 'alpha' : 'order'
    updateGeometry({ chapterSort: value })
  }
  const devices = {
    print: { label: 'Printed page' },
    kindle: { label: 'Kindle Paperwhite', width: 420, height: 560 },
    kindleOasis: { label: 'Kindle Oasis', width: 480, height: 640 },
    iphone: { label: 'iPhone', width: 390, height: 700 },
    android: { label: 'Android phone', width: 412, height: 732 },
    ipad: { label: 'iPad', width: 640, height: 820 },
    tablet: { label: 'Android tablet', width: 800, height: 1100 },
    fire: { label: 'Amazon Fire', width: 600, height: 800 },
    a5: { label: 'A5 paperback', width: 559, height: 794 },
  }
  const activeDevice = devices[device]
  const preview = buildBookPreview(novel, printableChapters, layout)

  useEffect(() => {
    if (!preview.pages.length || typeof window.IntersectionObserver === 'undefined') return
    const observer = new window.IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      const index = visible ? preview.pages.findIndex((page) => `print-page-${page.id}` === (visible.target as HTMLElement).id) : -1
      if (index >= 0) setSelectedPage(index)
    }, { threshold: [0.2, 0.5, 0.8] })
    preview.pages.forEach((page) => { const element = document.getElementById(`print-page-${page.id}`); if (element) observer.observe(element) })
    return () => observer.disconnect()
  }, [preview.pages])

  const renderFolderProof = (folder: any, depth = 0): ReactNode => {
    const children = folders.filter((candidate) => (candidate.parentId || null) === folder.id)
    const contents = proofChapters.filter((chapter) => chapter.folderId === folder.id)
    return <div className="print-proof-group" key={folder.id} style={{ '--proof-depth': depth } as CSSProperties}>
      <div className="print-proof-group-title"><span aria-hidden="true">▾</span>{folder.name}</div>
      {children.map((child) => renderFolderProof(child, depth + 1))}
      {contents.map((chapter) => <button className={selectedPage === preview.pages.findIndex((page) => page.chapterId === chapter.id) ? 'active' : ''} key={chapter.id} onClick={() => { const index = preview.pages.findIndex((page) => page.chapterId === chapter.id); if (index >= 0) { setSelectedPage(index); document.getElementById(`print-page-${preview.pages[index].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } }}>{numbers.get(chapter.id)?.number || '—'} <span>{titleFor(chapter, numbers)}</span></button>)}
    </div>
  }

  if (!novel) {
    return <div style={{ padding: 'var(--space-7)', textAlign: 'center', color: 'var(--grey)' }}>Setting the type…</div>
  }

  return (
    <div className="print-view">
      <style>{pageCss}</style>
      <div className="print-toolbar">
        <div className="print-view-heading"><span>BOOK PROOF</span><strong>{novel.title}</strong><small>{preview.pageCount} pages · {Math.round(w)} × {Math.round(h)} mm</small></div>
        <div className="print-controls">
          <label>Mode<select value={mode} onChange={(event) => setMode(event.target.value as 'proof' | 'reader' | 'continuous')}><option value="proof">Print proof</option><option value="reader">Reader</option><option value="continuous">Continuous reader</option></select></label>
          <label>Page size<select value={typeof layout.pageSize === 'string' ? layout.pageSize : 'trade-paperback'} onChange={(event) => updateGeometry({ pageSize: event.target.value })}>{PAGE_PRESETS.map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}</select></label>
          <label>Margins<input type="number" min="5" max="50" step="1" value={margin} onChange={(event) => updateGeometry({ pageMargin: Number(event.target.value) })} /><span>mm</span></label>
          <label className="print-theme-toggle"><input type="checkbox" checked={useDesignerTheme} onChange={(event) => setUseDesignerTheme(event.target.checked)} /> Designer theme</label>
          <label>Preview<select value={device} onChange={(event) => setDevice(event.target.value)}>{Object.entries(devices).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
          {mode === 'proof' && <label>Zoom<select value={zoom} onChange={(event) => setZoom(Number(event.target.value))}><option value="0.75">Fit</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select></label>}
          <span className="muted small">{Math.round(w)} × {Math.round(h)} mm{bleed ? ` · ${bleed} mm bleed` : ''}</span>
        </div>
        <div className="actions-row">
          <button className="button button-ghost" onClick={() => navigate(`/novel/${id}/design`)}>← Back to designer</button>
          <button className="button button-primary" onClick={() => window.print()}>🖨 Print / Save as PDF</button>
        </div>
      </div>

      <div className={`print-proof-shell mode-${mode}`}>
      {mode === 'proof' && <aside className="print-proof-sidebar"><div className="print-proof-heading"><strong>Proofing</strong><button type="button" className="print-sort-button" onClick={cycleChapterSort} title={`Sort by ${sortMode === 'order' ? 'chapter number' : sortMode === 'number' ? 'title' : 'manuscript order'}`} aria-label={`Sort proof pages by ${sortMode === 'order' ? 'chapter number' : sortMode === 'number' ? 'title' : 'manuscript order'}`}>⇅ <span>Sort</span></button></div><span>{preview.pageCount} pages</span>{preview.diagnostics.map((item, index) => <div className={`proof-diagnostic ${item.severity}`} key={index}>{item.message}</div>)}<div className="proof-page-list">{folders.filter((folder) => !folder.parentId).map((folder) => renderFolderProof(folder))}{preview.pages.map((page, index) => page.chapterId && !folderIds.has(chapters.find((chapter) => chapter.id === page.chapterId)?.folderId) ? <button className={selectedPage === index ? 'active' : ''} key={page.id} onClick={() => { setSelectedPage(index); document.getElementById(`print-page-${page.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{page.pageNum || '—'} <span>{page.chapterTitle || page.type}</span></button> : null)}</div></aside>}
      <div className={`device-preview device-${device}`} style={activeDevice.width ? { width: activeDevice.width, height: activeDevice.height } : undefined}>
      <div className={`book-view ${layout.dropCap ? 'dropcap' : ''}`} style={{ transform: mode === 'proof' ? `scale(${zoom})` : undefined, transformOrigin: 'top center', fontFamily: fontFamily, fontSize: device === 'print' ? `${bodyPx}px` : `${Math.max(13, bodyPx)}px`, ['--print-paper' as any]: theme.paper, ['--print-ink' as any]: theme.ink, ['--print-accent' as any]: theme.accent, ['--drop-cap-color' as any]: layout.dropCapColor ?? theme.ink, width: device === 'print' ? `${w}mm` : '100%', minHeight: device === 'print' ? `${h}mm` : '100%', padding: device === 'print' ? `${margin}mm` : device === 'iphone' ? '42px 28px' : '54px 44px' } as CSSProperties}>
        {layout.includeFrontMatter !== false && <div className="title-page">
          <div className="t-title">{novel.title}</div>
          <div className="t-by">{coverByline(layout, novel)}</div>
          {layout.titleStyle === 'ornament' && <div className="t-ornament">✦  ❦  ✦</div>}
          {sig.text && <div className={`t-signature signature-${sig.font || 'cormorant'}`}>{sig.text}</div>}
        </div>}

        {preview.pages.map((page) => page.type !== 'title' && <div className={`chapter-block ${page.type}`} id={`print-page-${page.id}`} key={page.id}>
          {layout.showChapterTitles !== false && <div className={`t-chapter ${layout.chapterStyle === 'left' ? 'left' : ''} ${page.type === 'container' ? 't-container' : ''}`}>{page.chapterTitle}</div>}
          {page.html && <div className={`chapter-body${layout.dropCap && page.type !== 'container' && (!layout.dropCapChapterId || layout.dropCapChapterId === page.chapterId) ? ' dropcap' : ''}`} dangerouslySetInnerHTML={{ __html: decorate(page.html, symbol) }} />}
        </div>)}
      </div>
      </div>
      </div>
    </div>
  )
}

// Replace the editor's scene-break blocks with the designer's chosen symbol.
function decorate(html, symbol) {
  if (!html) return '<p>…</p>'
  const doc = new DOMParser().parseFromString(sanitizeStoredHtml(html), 'text/html')
  doc.querySelectorAll('.scene-break').forEach((el) => {
    el.textContent = symbol
  })
  return doc.body.innerHTML
}

function coverByline(layout, novel) {
  return layout.cover?.byline || novel?.byline || ''
}
