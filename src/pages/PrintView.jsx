import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getNovel, updateNovel } from '../db/novels'
import { listChapters } from '../db/chapters'
import { PAGE_PRESETS, pageSizeMm, pageMarginMm } from '../utils/pageSize'
import { computeNumbers, titleFor, isContainer } from '../utils/numbering'
import { sanitizeStoredHtml } from '../utils/formatHtml'
import '../styles/print.css'
import { designPrintTheme } from '../designs/registry'

const FONTS = {
  literata: "'Literata', Georgia, serif",
  cormorant: "'Cormorant Garamond', Georgia, serif",
  georgia: 'Georgia, serif'
}

export default function PrintView() {
  const { id } = useParams()
  const [novel, setNovel] = useState(null)
  const [chapters, setChapters] = useState([])
  const [layout, setLayout] = useState({})
  const [useDesignerTheme, setUseDesignerTheme] = useState(true)
  const [device, setDevice] = useState('print')

  useEffect(() => {
    ;(async () => {
      const n = await getNovel(id)
      setNovel(n)
      setChapters(await listChapters(id))
      let printOptions = {}
      try {
        printOptions = JSON.parse(sessionStorage.getItem(`moonscribe:print:${id}`) || '{}')
      } catch {
        // Ignore invalid stale print preferences.
      }
      setUseDesignerTheme(printOptions.useDesignerTheme !== false)
      setLayout({ ...(n.layout || {}), ...printOptions })
    })()
  }, [id])

  const fontFamily = FONTS[layout.bodyFont] || FONTS.literata
  const bodyPx = (layout.bodySize ?? 11.5) * 1.25
  const symbol = layout.sceneBreak || '❦'
  const sig = layout.signature || {}
  const numbers = computeNumbers(chapters)

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
  const devices = {
    print: { label: 'Printed page' },
    kindle: { label: 'Kindle Paperwhite', width: 420, height: 560 },
    iphone: { label: 'iPhone', width: 390, height: 700 },
    ipad: { label: 'iPad', width: 640, height: 820 },
    fire: { label: 'Amazon Fire', width: 600, height: 800 },
  }
  const activeDevice = devices[device]

  if (!novel) {
    return <div style={{ padding: 'var(--space-7)', textAlign: 'center', color: 'var(--grey)' }}>Setting the type…</div>
  }

  return (
    <div className="print-view">
      <style>{pageCss}</style>
      <div className="print-toolbar">
        <div className="print-controls">
          <label>Page size<select value={typeof layout.pageSize === 'string' ? layout.pageSize : 'trade-paperback'} onChange={(event) => updateGeometry({ pageSize: event.target.value })}>{PAGE_PRESETS.map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}</select></label>
          <label>Margins<input type="number" min="5" max="50" step="1" value={margin} onChange={(event) => updateGeometry({ pageMargin: Number(event.target.value) })} /><span>mm</span></label>
          <label className="print-theme-toggle"><input type="checkbox" checked={useDesignerTheme} onChange={(event) => setUseDesignerTheme(event.target.checked)} /> Designer theme</label>
          <label>Preview<select value={device} onChange={(event) => setDevice(event.target.value)}>{Object.entries(devices).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
          <span className="muted small">{Math.round(w)} × {Math.round(h)} mm{bleed ? ` · ${bleed} mm bleed` : ''}</span>
        </div>
        <div className="actions-row">
          <button className="button button-ghost" onClick={() => { window.location.hash = `#/novel/${id}/design` }}>← Back to designer</button>
          <button className="button button-primary" onClick={() => window.print()}>🖨 Print / Save as PDF</button>
        </div>
      </div>

      <div className={`device-preview device-${device}`} style={activeDevice.width ? { width: activeDevice.width, height: activeDevice.height } : undefined}>
      <div className={`book-view ${layout.dropCap ? 'dropcap' : ''}`} style={{ fontFamily: fontFamily, fontSize: device === 'print' ? `${bodyPx}px` : `${Math.max(13, bodyPx)}px`, '--print-paper': theme.paper, '--print-ink': theme.ink, '--print-accent': theme.accent, width: device === 'print' ? `${w}mm` : '100%', minHeight: device === 'print' ? `${h}mm` : '100%', padding: device === 'print' ? `${margin}mm` : device === 'iphone' ? '42px 28px' : '54px 44px' }}>
        {layout.includeFrontMatter !== false && <div className="title-page">
          <div className="t-title">{novel.title}</div>
          <div className="t-by">{coverByline(layout, novel)}</div>
          <div className="t-ornament">{layout.titleStyle === 'ornament' ? '✦  ❦  ✦' : symbol}</div>
          {sig.text && <div className={`t-signature signature-${sig.font || 'cormorant'}`}>{sig.text}</div>}
        </div>}

        {chapters.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>No chapters yet.</p>}

        {chapters.map((c, i) => (
          <div className="chapter-block" key={c.id}>
            {c.part && (i === 0 || chapters[i - 1].part !== c.part) && (
              <h2 className="t-chapter left" style={{ fontSize: '1.2em', marginTop: '2em' }}>{c.part}</h2>
            )}
            <div className={`t-chapter ${layout.chapterStyle === 'left' ? 'left' : ''} ${isContainer(c) ? 't-container' : ''}`}>
              {titleFor(c, numbers)}
            </div>
            <div className="chapter-body" dangerouslySetInnerHTML={{ __html: decorate(c.content || '', symbol) }} />
          </div>
        ))}
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
