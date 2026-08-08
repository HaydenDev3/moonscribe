import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getNovel, updateNovel } from '../db/novels'
import { listChapters } from '../db/chapters'
import { useApp } from '../context/AppContext'
import SubPageTopbar from '../components/SubPageTopbar'
import DesignPalette from '../components/DesignPalette'
import { designById, DESIGN_MIME } from '../designs/registry'
import { GALLERY, resolveCoverImageUrl } from '../designs/gallery'
import { htmlToText } from '../utils/htmlToText'
import { downloadBlob } from '../utils/download'
import { PAGE_PRESETS, pageSizeMm } from '../utils/pageSize'
import Icon from '../components/Icon'

const FONTS = [
  { key: 'literata', label: 'Literata', family: "'Literata', Georgia, serif" },
  { key: 'cormorant', label: 'Cormorant Garamond', family: "'Cormorant Garamond', Georgia, serif" },
  { key: 'georgia', label: 'Georgia', family: 'Georgia, serif' }
]
const SCENE_BREAKS = ['❦', '✦', '◆', '*', ' ']
const ORNAMENTS = ['❦', '✦', '◆', '✧']
const BODY_SIZES = [10.5, 11.5, 12.5, 14]
const TITLE_COLORS = ['#ffffff', '#FFF9E8', '#FBE3E3', '#3d3a36', '#D4A5A5']
const SIGNATURE_FONTS = [
  { key: 'cormorant', label: 'Cormorant italic' },
  { key: 'literata', label: 'Literata italic' },
  { key: 'cursive', label: 'Handwritten' }
]
const TABS = [
  ['cover', 'Cover', 'fa-solid fa-book'],
  ['body', 'Body text', 'fa-solid fa-font'],
  ['title', 'Title page', 'fa-solid fa-heading'],
  ['signature', 'Signature', 'fa-solid fa-signature'],
  ['print', 'Print & trim', 'fa-solid fa-ruler']
]
const ASSET_SLIDES = [
  { id: 'templates', label: 'Templates', icon: 'fa-solid fa-wand-magic-sparkles' },
  { id: 'cover', label: 'Cover image', icon: 'fa-regular fa-image' },
  { id: 'shapes', label: 'Shapes', icon: 'fa-solid fa-shapes' }
]

export default function BookDesigner({ novelId, embedded }) {
  const { id: paramId } = useParams()
  const id = novelId || paramId
  const { toast } = useApp()
  const [novel, setNovel] = useState(null)
  const [chapters, setChapters] = useState([])
  const [layout, setLayout] = useState(null)
  const [tab, setTab] = useState('cover')
  const [assetsOpen, setAssetsOpen] = useState(true)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [assetSlide, setAssetSlide] = useState(0)
  const [show3d, setShow3d] = useState(true)
  const [coverOver, setCoverOver] = useState(false)
  const [pageOver, setPageOver] = useState(false)
  const coverOverTimer = useRef(null)
  const pageOverTimer = useRef(null)

  useEffect(() => {
    ;(async () => {
      const n = await getNovel(id)
      setNovel(n)
      setChapters(await listChapters(id))
      setLayout(n.layout || {})
    })()
  }, [id])

  // Persist layout whenever it changes.
  useEffect(() => {
    if (layout && novel) updateNovel(id, { layout })
  }, [layout, novel, id])

  const update = useCallback((patch) => {
    setLayout((prev) => ({ ...prev, ...patch }))
  }, [])

  const updateCover = useCallback((patch) => {
    setLayout((prev) => ({ ...prev, cover: { ...(prev.cover || {}), ...patch } }))
  }, [])

  const applyCoverDesign = useCallback((id) => {
    const d = designById(id)
    if (!d) return
    update({ coverDesign: id })
    updateCover({ ...d.cover })
    toast(`${d.name} settled onto the cover.`)
  }, [toast, update, updateCover])

  const applyEditorDesign = useCallback((id) => {
    const d = designById(id)
    if (!d) return
    update({ editorDesign: id })
    toast(`${d.name} set across the pages.`)
  }, [toast, update])

  const onDropDesign = useCallback((e, kind) => {
    e.preventDefault()
    if (kind === 'cover') setCoverOver(false)
    else setPageOver(false)
    const d = designById(e.dataTransfer.getData(DESIGN_MIME))
    if (!d) return
    if (kind === 'cover') applyCoverDesign(d.id)
    else applyEditorDesign(d.id)
  }, [applyCoverDesign, applyEditorDesign])

  const dragEnter = (kind) => {
    clearTimeout(kind === 'cover' ? coverOverTimer.current : pageOverTimer.current)
    if (kind === 'cover') setCoverOver(true)
    else setPageOver(true)
  }
  const dragLeave = (kind) => {
    const t = setTimeout(() => {
      if (kind === 'cover') setCoverOver(false)
      else setPageOver(false)
    }, 120)
    if (kind === 'cover') coverOverTimer.current = t
    else pageOverTimer.current = t
  }

  if (!novel || !layout) {
    return <div className="app" style={{ padding: 'var(--space-7)', textAlign: 'center', color: 'var(--grey)' }}>Preparing the press…</div>
  }

  const font = FONTS.find((f) => f.key === layout.bodyFont) || FONTS[0]
  const firstChapter = chapters[0]
  const cover = layout.cover || {}
  const sig = layout.signature || {}
  const activeCoverDesign = layout.coverDesign
  const activeEditorDesign = layout.editorDesign

  return (
    <div className={embedded ? undefined : 'app'}>
      {!embedded && novel && <SubPageTopbar novel={novel} title="Designer" />}
      <div className="designer-workspace">
        <button
          className={`designer-controls-toggle ${controlsOpen ? 'open' : ''}`}
          onClick={() => setControlsOpen((o) => !o)}
          title={controlsOpen ? 'Hide designer settings' : 'Show designer settings'}
          aria-label="Toggle designer settings"
          aria-expanded={controlsOpen}
        >
          <Icon icon={controlsOpen ? 'fa-solid fa-angles-left' : 'fa-solid fa-angles-right'} />
          <span className="designer-assets-toggle-label">Design</span>
        </button>

        <aside className={`designer-controls ${controlsOpen ? 'open' : ''}`}>
          <div className="designer-controls-head">
            <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem' }}>Designer</strong>
            <button className="button button-quiet" onClick={() => setControlsOpen(false)} aria-label="Close designer settings">
              <Icon icon="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="designer-tabs" role="tablist" aria-label="Designer settings">
            {TABS.map(([key, label, icon]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={`designer-tab ${tab === key ? 'active' : ''}`}
                onClick={() => setTab(key)}
              >
                <Icon icon={icon} style={{ marginRight: 6 }} />
                {label}
              </button>
            ))}
          </div>
          <div className="designer-controls-scroll">
            {tab === 'cover' && <CoverTab cover={cover} novel={novel} updateCover={updateCover} />}
            {tab === 'body' && <BodyTab layout={layout} update={update} />}
            {tab === 'title' && <TitleTab layout={layout} update={update} />}
            {tab === 'signature' && <SignatureTab sig={sig} layout={layout} update={update} />}
            {tab === 'print' && <PrintTab layout={layout} update={update} />}
          </div>
        </aside>

        <div className="designer-preview">
          <div className="designer-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <h3 style={{ margin: 0 }}>Cover preview</h3>
              <div className="actions-row">
                <button className="button button-ghost" onClick={() => exportCoverPng(novel, cover)} title="Download the cover as a PNG">⬇ PNG</button>
                <button className="button button-ghost" onClick={() => setShow3d((v) => !v)}>
                  {show3d ? '2D view' : '3D preview ✦'}
                </button>
              </div>
            </div>
            {show3d ? (
              <Cover3D novel={novel} cover={cover} />
            ) : (
              <div
                className={`design-dropzone ${coverOver ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                onDragEnter={(e) => { e.preventDefault(); dragEnter('cover') }}
                onDragLeave={() => dragLeave('cover')}
                onDrop={(e) => onDropDesign(e, 'cover')}
              >
                <CoverPreview novel={novel} cover={cover} />
              </div>
            )}
          </div>

          <div
            className={`book-mini design-dropzone ${activeEditorDesign ? `design-${activeEditorDesign}` : ''} ${pageOver ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
            onDragEnter={(e) => { e.preventDefault(); dragEnter('page') }}
            onDragLeave={() => dragLeave('page')}
            onDrop={(e) => onDropDesign(e, 'page')}
          >
            <div className="book-title">{novel.title}</div>
            <div className="book-by">{cover.byline || 'for Storm'}</div>
            {layout.titleStyle === 'ornament' ? (
              <div className="ornament">{'✦  ❦  ✦'}</div>
            ) : (
              <div className="ornament">{layout.sceneBreak || '❦'}</div>
            )}
            {firstChapter ? (
              <>
                <div className="book-chapter">{firstChapter.title || 'Chapter One'}</div>
                <div
                  className={`book-body ${layout.dropCap ? 'dropcap' : ''}`}
                  style={{ fontFamily: font.family, fontSize: `${(layout.bodySize ?? 11.5) * 1.2}px`, lineHeight: 1.85 }}
                  dangerouslySetInnerHTML={{ __html: excerpt(firstChapter.content, layout.sceneBreak || '❦') }}
                />
              </>
            ) : (
              <p className="muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>No chapters yet — the ink is drying.</p>
            )}
            {sig.text && <div className={`signature signature-${sig.font || 'cormorant'}`}>{sig.text}</div>}
          </div>

          <div className="designer-footer">
            <p className="small muted" style={{ margin: 0 }}>
              Everything saves itself as you go.
            </p>
            <button className="button button-primary" onClick={() => (window.location.hash = `#/novel/${id}/design/print`)}>
              Open print view →
            </button>
          </div>
        </div>

        <button
          className={`designer-assets-toggle ${assetsOpen ? 'open' : ''}`}
          onClick={() => setAssetsOpen((o) => !o)}
          title={assetsOpen ? 'Hide design assets' : 'Show design assets'}
          aria-label="Toggle design assets"
          aria-expanded={assetsOpen}
        >
          <Icon icon={assetsOpen ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left'} />
          <span className="designer-assets-toggle-label">Assets</span>
        </button>

        <aside className={`designer-assets ${assetsOpen ? 'open' : ''}`} aria-label="Design assets">
          <div className="designer-assets-head">
            <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem' }}>Assets</strong>
            <button className="button button-quiet" onClick={() => setAssetsOpen(false)} aria-label="Close design assets">
              <Icon icon="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="assets-slides-wrap">
            <div className="assets-slides" style={{ transform: `translateX(-${assetSlide * 100}%)` }}>
              <section className="assets-slide">
                <h4 className="assets-heading"><Icon icon="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 6 }} /> Templates</h4>
                <p className="small muted" style={{ marginTop: 0 }}>
                  Drag a design onto the cover or the page — or just click it. It becomes part of the book.
                </p>
                <DesignPalette compact activeId={activeCoverDesign || activeEditorDesign} onPick={(id) => {
                  applyCoverDesign(id)
                  applyEditorDesign(id)
                }} />
              </section>

              <section className="assets-slide">
                <h4 className="assets-heading"><Icon icon="fa-regular fa-image" style={{ marginRight: 6 }} /> Cover image</h4>
                <p className="small muted" style={{ marginTop: 0 }}>
                  Your uploaded picture or one of these quiet backdrops sits behind the title.
                </p>
                <CoverImagePicker novel={novel} cover={cover} updateCover={updateCover} />
                {!novel.cover && (
                  <p className="small muted" style={{ marginBottom: 0 }}>Upload a picture on the dashboard’s novel menu first.</p>
                )}
              </section>

              <section className="assets-slide">
                <h4 className="assets-heading"><Icon icon="fa-solid fa-shapes" style={{ marginRight: 6 }} /> Shapes</h4>
                <div className="field">
                  <label>Cover ornament</label>
                  <div className="swatch-row">
                    {ORNAMENTS.map((s) => (
                      <button key={s} className={`swatch ${(cover.ornament || '❦') === s ? 'selected' : ''}`} style={{ fontSize: '1.1rem', lineHeight: 1 }} onClick={() => updateCover({ ornament: s })}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Scene-break mark</label>
                  <div className="swatch-row">
                    {SCENE_BREAKS.map((s) => (
                      <button key={s} className={`swatch ${(layout.sceneBreak ?? '❦') === s ? 'selected' : ''}`} style={{ fontSize: '1.1rem', lineHeight: 1 }} onClick={() => update({ sceneBreak: s })}>
                        {s === ' ' ? '—' : s}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>
          <div className="assets-nav">
            <button
              className="assets-nav-btn"
              onClick={() => setAssetSlide((s) => Math.max(0, s - 1))}
              disabled={assetSlide === 0}
              aria-label="Previous design options"
            >
              <Icon icon="fa-solid fa-arrow-left" />
            </button>
            <span className="assets-nav-dots" role="tablist" aria-label="Design option pages">
              {ASSET_SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={assetSlide === i}
                  aria-label={s.label}
                  title={s.label}
                  className={`assets-nav-dot ${assetSlide === i ? 'active' : ''}`}
                  onClick={() => setAssetSlide(i)}
                />
              ))}
            </span>
            <button
              className="assets-nav-btn"
              onClick={() => setAssetSlide((s) => Math.min(ASSET_SLIDES.length - 1, s + 1))}
              disabled={assetSlide === ASSET_SLIDES.length - 1}
              aria-label="Next design options"
            >
              <Icon icon="fa-solid fa-arrow-right" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ---------------- control tabs ----------------

function CoverTab({ cover, novel, updateCover }) {
  return (
    <>
      <div className="field">
        <label>Subtitle <span className="hint">(optional)</span></label>
        <input value={cover.subtitle || ''} onChange={(e) => updateCover({ subtitle: e.target.value })} placeholder="A novel" />
      </div>
      <div className="field">
        <label>Byline</label>
        <input value={cover.byline || ''} onChange={(e) => updateCover({ byline: e.target.value })} placeholder="for Storm" />
      </div>
      <div className="field">
        <label>Title colour</label>
        <div className="swatch-row">
          {TITLE_COLORS.map((c) => (
            <button key={c} className={`swatch ${(cover.titleColor || '#ffffff') === c ? 'selected' : ''}`} style={{ background: c, border: c === '#ffffff' ? '1px solid var(--border)' : undefined }} onClick={() => updateCover({ titleColor: c })} aria-label={c} />
          ))}
        </div>
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>
        The cover image and ornaments live on the Assets panel to the right.
      </p>
    </>
  )
}

function BodyTab({ layout, update }) {
  return (
    <>
      <div className="field">
        <label>Font</label>
        <select value={layout.bodyFont || 'literata'} onChange={(e) => update({ bodyFont: e.target.value })}>
          {FONTS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Size</label>
        <select value={layout.bodySize ?? 11.5} onChange={(e) => update({ bodySize: Number(e.target.value) })}>
          {BODY_SIZES.map((s) => (
            <option key={s} value={s}>{s} pt</option>
          ))}
        </select>
      </div>
      <div className="switch-row" style={{ marginTop: 8 }}>
        <span className="small">Drop cap on first paragraph</span>
        <label className="switch">
          <input type="checkbox" checked={!!layout.dropCap} onChange={(e) => update({ dropCap: e.target.checked })} />
          <span className="track" />
        </label>
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>
        The scene-break mark lives on the Assets panel to the right.
      </p>
    </>
  )
}

function TitleTab({ layout, update }) {
  return (
    <>
      <div className="field">
        <label>Style</label>
        <select value={layout.titleStyle || 'centered'} onChange={(e) => update({ titleStyle: e.target.value })}>
          <option value="centered">Quiet &amp; centered</option>
          <option value="ornament">With ornament</option>
        </select>
      </div>
      <div className="field">
        <label>Chapter headings</label>
        <select value={layout.chapterStyle || 'centered'} onChange={(e) => update({ chapterStyle: e.target.value })}>
          <option value="centered">Centered</option>
          <option value="left">Left</option>
        </select>
      </div>
    </>
  )
}

function SignatureTab({ sig, layout, update }) {
  return (
    <>
      <p className="small muted" style={{ marginTop: 0 }}>
        Sign the title page like a real copy. Written by hand, kept forever.
      </p>
      <div className="field">
        <label>Your name</label>
        <input value={sig.text || ''} onChange={(e) => update({ signature: { ...sig, text: e.target.value } })} placeholder="e.g. Storm Delacroix" />
      </div>
      <div className="field">
        <label>Hand</label>
        <div className="signature-choices">
          {SIGNATURE_FONTS.map((f) => (
            <button
              key={f.key}
              className={`signature-choice ${(sig.font || 'cormorant') === f.key ? 'selected' : ''}`}
              title={f.label}
              onClick={() => update({ signature: { ...sig, font: f.key } })}
            >
              <span className={`signature signature-${f.key}`}>{sig.text || 'Your name'}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function PrintTab({ layout, update }) {
  return (
    <>
      <div className="field">
        <label>Trim size</label>
        <select value={typeof layout.pageSize === 'string' ? layout.pageSize : 'custom'} onChange={(e) => update({ pageSize: e.target.value })}>
          {PAGE_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
          <option value="custom">Custom…</option>
        </select>
      </div>
      {typeof layout.pageSize === 'object' && (
        <div className="actions-row" style={{ gap: 8 }}>
          <input type="number" min="50" max="400" step="0.1" value={layout.pageSize.w} onChange={(e) => update({ pageSize: { ...layout.pageSize, w: Number(e.target.value) } })} aria-label="Page width mm" style={{ width: 90 }} />
          <span className="muted small">×</span>
          <input type="number" min="50" max="600" step="0.1" value={layout.pageSize.h} onChange={(e) => update({ pageSize: { ...layout.pageSize, h: Number(e.target.value) } })} aria-label="Page height mm" style={{ width: 90 }} />
          <span className="muted small">mm</span>
        </div>
      )}
      <div className="actions-row" style={{ gap: 8 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Margin <span className="hint">mm</span></label>
          <input type="number" min="5" max="50" step="0.5" value={layout.pageMargin ?? 20} onChange={(e) => update({ pageMargin: Number(e.target.value) })} style={{ width: 90 }} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Bleed <span className="hint">mm</span></label>
          <input type="number" min="0" max="25" step="0.5" value={layout.bleed ?? 3} onChange={(e) => update({ bleed: Number(e.target.value) })} style={{ width: 90 }} />
        </div>
      </div>
      <p className="small muted" style={{ margin: '10px 0 0' }}>
        Final trim ≈ {Math.round(pageSizeMm(layout.pageSize).w)} × {Math.round(pageSizeMm(layout.pageSize).h)} mm · {layout.pageMargin ?? 20} mm margins.
        These drive the print view’s page and the Word export’s paper size.
      </p>
    </>
  )
}

// ---------------- assets panel ----------------

function CoverImagePicker({ novel, cover, updateCover }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!novel.cover) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(novel.cover)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [novel.cover])

  const galleryOn = cover.imageSource && cover.imageSource.startsWith('gallery:')
  const uploadedOn = !galleryOn && cover.showImage

  const clearImage = () => updateCover({ showImage: false, imageSource: null })

  return (
    <div className="cover-pick-grid">
      <button
        type="button"
        className={`cover-pick ${uploadedOn ? 'selected' : ''}`}
        disabled={!novel.cover}
        onClick={() => updateCover({ imageSource: 'uploaded', showImage: true })}
        title="Use your uploaded picture"
      >
        {url ? <img src={url} alt="" /> : <span className="cover-pick-empty"><Icon icon="fa-regular fa-image" /></span>}
        <span className="cover-pick-name">My picture</span>
      </button>
      {GALLERY.map((g) => (
        <button
          type="button"
          key={g.id}
          className={`cover-pick ${cover.imageSource === `gallery:${g.id}` ? 'selected' : ''}`}
          onClick={() => updateCover({ imageSource: `gallery:${g.id}`, showImage: true })}
          title={g.name}
        >
          <img src={g.dataUrl} alt="" />
          <span className="cover-pick-name">{g.name}</span>
        </button>
      ))}
      <button
        type="button"
        className={`cover-pick ${!cover.showImage ? 'selected' : ''}`}
        onClick={clearImage}
        title="No picture behind the title"
      >
        <span className="cover-pick-empty"><Icon icon="fa-regular fa-rectangle-xmark" /></span>
        <span className="cover-pick-name">Plain cover</span>
      </button>
    </div>
  )
}

// ---------------- previews ----------------

// Live 2D cover.
function CoverPreview({ novel, cover }) {
  const [coverUrl, setCoverUrl] = useState(null)
  const style = novel.coverStyle || 'moonstone'

  useEffect(() => {
    const gallery = resolveCoverImageUrl(novel, cover)
    if (gallery) {
      setCoverUrl(gallery)
      return
    }
    if (!novel.cover) {
      setCoverUrl(null)
      return
    }
    const u = URL.createObjectURL(novel.cover)
    setCoverUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [novel, cover])

  return (
    <div className={`cover-preview cover-${style}`}>
      {coverUrl && cover.showImage && (
        <div className="cover-preview-img"><img src={coverUrl} alt="" /></div>
      )}
      <div className="cover-preview-inner">
        <div className="cp-title" style={{ color: cover.titleColor || '#ffffff' }}>{novel.title}</div>
        {cover.subtitle && <div className="cp-subtitle" style={{ color: cover.titleColor || '#ffffff' }}>{cover.subtitle}</div>}
        <div className="cp-ornament" style={{ color: cover.titleColor || '#ffffff' }}>{cover.ornament || '❦'}</div>
        <div className="cp-byline" style={{ color: cover.titleColor || '#ffffff' }}>{cover.byline || 'for Storm'}</div>
      </div>
    </div>
  )
}

// Lazy 3D mockup (pulls in three.js on first use). Reads the app's theme
// tokens itself, so it matches the writing page in every theme.
function Cover3D({ novel, cover }) {
  const [coverUrl, setCoverUrl] = useState(null)
  const [Comp, setComp] = useState(null)

  useEffect(() => {
    const gallery = resolveCoverImageUrl(novel, cover)
    if (gallery) {
      setCoverUrl(gallery)
      return
    }
    if (!novel.cover) {
      setCoverUrl(null)
      return
    }
    const u = URL.createObjectURL(novel.cover)
    setCoverUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [novel, cover])

  useEffect(() => {
    import('./CoverMockup3D').then((m) => setComp(() => m.default))
  }, [])

  if (!Comp) {
    return <div className="cover-mockup-3d" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grey)', fontStyle: 'italic' }}>setting the scene…</div>
  }

  return (
    <Comp
      title={novel.title}
      byline={cover.byline || 'for Storm'}
      coverStyle={novel.coverStyle || 'moonstone'}
      coverImage={coverUrl && cover.showImage ? coverUrl : null}
      ornament={cover.ornament || '❦'}
      titleColor={cover.titleColor || '#ffffff'}
    />
  )
}

function exportCoverPng(novel, cover) {
  const W = 600
  const H = 900
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const bg = {
    moonstone: ['#8fb2d4', '#7ba3c9', '#a6c2dd'],
    rose: ['#e0b9b9', '#d4a5a5', '#e3c2c2'],
    sage: ['#b8d0b8', '#a8c5a8', '#c3d8c3'],
    sand: ['#e3cfa9', '#d8b48f', '#e8d7b8'],
    twilight: ['#5f82a4', '#4a6b8a', '#6f90ae']
  }[novel.coverStyle || 'moonstone']

  const g = ctx.createLinearGradient(0, 0, W * 0.9, H)
  g.addColorStop(0, bg[0])
  g.addColorStop(0.55, bg[1])
  g.addColorStop(1, bg[2])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.9)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(30,40,55,0.28)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, W, H)

  const finish = () => {
    ctx.textAlign = 'center'
    ctx.fillStyle = cover.titleColor || '#ffffff'
    ctx.shadowColor = 'rgba(0,0,0,0.25)'
    ctx.shadowBlur = 14

    ctx.font = `600 ${Math.min(W * 0.078, 64)}px 'Cormorant Garamond', Georgia, serif`
    const words = String(novel.title || 'Untitled').split(' ')
    let line = ''
    const lines = []
    for (const w of words) {
      if (ctx.measureText(line + ' ' + w).width > W * 0.82 && line) {
        lines.push(line)
        line = w
      } else {
        line = (line + ' ' + w).trim()
      }
    }
    if (line) lines.push(line)

    let y = H * 0.38 - ((lines.length - 1) * Math.min(W * 0.055, 44)) / 2
    for (const l of lines) {
      ctx.fillText(l, W / 2, y)
      y += Math.min(W * 0.055, 44)
    }
    ctx.shadowBlur = 0
    ctx.font = `${W * 0.05}px 'Cormorant Garamond', Georgia, serif`
    ctx.fillText(cover.ornament || '❦', W / 2, y + Math.min(W * 0.05, 40))
    ctx.font = `italic ${W * 0.036}px 'Cormorant Garamond', Georgia, serif`
    ctx.fillText(cover.byline || 'for Storm', W / 2, H * 0.78)

    canvas.toBlob((blob) => {
      if (!blob) return
      const name = (novel.title || 'cover').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, '_').slice(0, 40) || 'cover'
      downloadBlob(blob, `${name}-cover.png`)
    }, 'image/png')
  }

  const drawImage = (img) => {
    ctx.globalAlpha = 0.55
    const scale = Math.max(W / img.width, H / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
    ctx.globalAlpha = 1
  }

  const galleryUrl = resolveCoverImageUrl(novel, cover)
  if (galleryUrl) {
    const img = new Image()
    img.onload = () => {
      drawImage(img)
      finish()
    }
    img.src = galleryUrl
  } else if (novel.cover && cover.showImage) {
    const url = URL.createObjectURL(novel.cover)
    const img = new Image()
    img.onload = () => {
      drawImage(img)
      URL.revokeObjectURL(url)
      finish()
    }
    img.src = url
  } else {
    finish()
  }
}

function excerpt(html, symbol) {
  if (!html) return '<p class="muted">…</p>'
  const text = htmlToText(html)
  const words = text.split(/\s+/).filter(Boolean).slice(0, 70).join(' ')
  return `<p>${words.replace(/❦/g, `</p><div class="scene-break">${symbol}</div><p>`)}…</p>`
}
