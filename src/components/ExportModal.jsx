import { useMemo, useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import { htmlToMarkdown } from '../utils/htmlToMarkdown'
import { htmlToText } from '../utils/htmlToText'
import { downloadText } from '../utils/download'
import {
  buildStyledHtml,
  EXPORT_FORMATS,
  filterSceneBreaks,
  prepareExport,
} from '../utils/exportDocument'
import { designPrintTheme } from '../designs/registry'
import { buildPrintFontOptions } from '../utils/fonts'
import { useApp } from '../context/AppContext'

const EXTENSIONS = { epub: 'epub', docx: 'docx', markdown: 'md', txt: 'txt', html: 'html', json: 'json' }

export default function ExportModal({ open, onClose, novel, chapters, toast, importMdRef, importRtfRef }) {
  const { customFonts, systemFonts } = useApp()
  const [format, setFormat] = useState('pdf')
  const [includeFrontMatter, setIncludeFrontMatter] = useState(true)
  const [includeChapterNumbers, setIncludeChapterNumbers] = useState(true)
  const [includeSceneBreaks, setIncludeSceneBreaks] = useState(true)
  const [includePartHeadings, setIncludePartHeadings] = useState(true)
  const [includeWordStats, setIncludeWordStats] = useState(false)
  const [useDesignerTheme, setUseDesignerTheme] = useState(true)
  const [lineSpacing, setLineSpacing] = useState('1.5')
  const printFontOptions = useMemo(() => buildPrintFontOptions({ systemFonts, customFonts }), [customFonts, systemFonts])
  const [printFont, setPrintFont] = useState('Georgia')
  const [exporting, setExporting] = useState(false)

  const options = useMemo(() => ({
    includeFrontMatter,
    includeChapterNumbers,
    includeSceneBreaks,
    includePartHeadings,
    includeWordStats,
    lineSpacing,
    printFont,
    useDesignerTheme,
  }), [includeFrontMatter, includeChapterNumbers, includeSceneBreaks, includePartHeadings, includeWordStats, lineSpacing, printFont, useDesignerTheme])
  const prepared = useMemo(() => prepareExport(novel, chapters, options), [novel, chapters, options])
  const selectedFormat = EXPORT_FORMATS.find((item) => item.key === format)
  const date = new Date().toISOString().slice(0, 10)
  const filename = format === 'pdf'
    ? `${prepared.baseName}-${date}.pdf`
    : `${prepared.baseName}-${date}.${EXTENSIONS[format] || format}`
  const supportsTypography = ['pdf', 'epub', 'docx', 'html'].includes(format)
  const supportsContentOptions = format !== 'json'

  const run = async () => {
    if (!novel || exporting) return
    setExporting(true)

    try {
      const geometry = {
        pageSize: novel.layout?.pageSize,
        pageMargin: novel.layout?.pageMargin,
        bleed: novel.layout?.bleed,
      }
      const layout = {
        ...geometry,
        ...(useDesignerTheme ? (novel.layout || {}) : {}),
        ...options,
        exportTheme: useDesignerTheme ? designPrintTheme(novel.layout || {}) : null,
      }
      const exportItems = prepared.items.map((chapter) => ({
        ...chapter,
        content: filterSceneBreaks(chapter.content, includeSceneBreaks),
      }))
      const manuscript = exportItems.filter((chapter) => !chapter.exportContainer)

      if (format === 'pdf') {
        sessionStorage.setItem(`moonscribe:print:${novel.id}`, JSON.stringify(layout))
        onClose()
        window.location.hash = `#/novel/${novel.id}/design/print`
        return
      }

      if (format === 'markdown') {
        let output = includeFrontMatter ? `# ${novel.title || 'Untitled novel'}\n\n` : ''
        exportItems.forEach((chapter) => {
          const level = chapter.exportContainer ? '#' : '##'
          output += `${level} ${chapter.title}\n\n${chapter.exportContainer ? '' : htmlToMarkdown(chapter.content)}\n\n`
        })
        if (includeWordStats) output += `---\n${prepared.totalWords.toLocaleString()} words · ${prepared.chapterCount} chapters\n`
        downloadText(output, filename)
      } else if (format === 'txt') {
        let output = includeFrontMatter ? `${novel.title || 'Untitled novel'}\n${'='.repeat(32)}\n\n` : ''
        exportItems.forEach((chapter) => {
          output += `${chapter.title}\n${'-'.repeat(Math.min(chapter.title.length, 48))}\n\n`
          if (!chapter.exportContainer) output += `${htmlToText(chapter.content)}\n\n`
        })
        if (includeWordStats) output += `${prepared.totalWords.toLocaleString()} words · ${prepared.chapterCount} chapters\n`
        downloadText(output, filename)
      } else if (format === 'html') {
        downloadText(buildStyledHtml(novel, exportItems, {
          ...options,
          totalWords: prepared.totalWords,
          chapterCount: prepared.chapterCount,
        }), filename)
      } else if (format === 'json') {
        downloadText(JSON.stringify({
          app: 'moonscribe',
          version: 1,
          exportedAt: new Date().toISOString(),
          novel,
          chapters: [...(chapters || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        }, null, 2), filename)
      } else if (format === 'docx') {
        const { exportNovelDocx } = await import('../utils/exportDocx')
        await exportNovelDocx(novel, manuscript, layout, filename)
      } else if (format === 'epub') {
        const { exportNovelEpub } = await import('../utils/exportEpub')
        await exportNovelEpub(novel, manuscript, layout, filename)
      }

      toast(`${selectedFormat?.label || 'File'} exported.`)
      onClose()
    } catch (error) {
      console.error('MoonScribe export failed', error)
      toast(`Couldn’t export ${selectedFormat?.label || 'that file'}. Your manuscript is unchanged.`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal open={open} onClose={exporting ? () => {} : onClose} title="Publish & export" width={920}>
      <div className="export-studio">
        <header className="export-intro">
          <div>
            <span className="export-kicker">Your manuscript, your format</span>
            <p>Prepare a clean reading copy, an editable document, or a complete MoonScribe archive.</p>
          </div>
          <span className="export-private"><Icon icon="fa-solid fa-shield-halved" /> Exported on this device</span>
        </header>

        <div className="export-layout">
          <nav className="export-format-list" aria-label="Export format">
            {EXPORT_FORMATS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`export-format-card${format === item.key ? ' active' : ''}`}
                onClick={() => setFormat(item.key)}
                aria-pressed={format === item.key}
              >
                <span className="export-format-icon"><Icon icon={item.icon} /></span>
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                {format === item.key && <Icon icon="fa-solid fa-check" className="export-format-check" />}
              </button>
            ))}
          </nav>

          <section className="export-settings" aria-label="Export settings">
            <div className="export-section-head">
              <div><span>Format</span><h3>{selectedFormat?.label}</h3></div>
              <span className="export-file-pill">.{format === 'pdf' ? 'pdf' : EXTENSIONS[format]}</span>
            </div>

            {supportsContentOptions ? (
              <>
                <div className="export-setting-group">
                  <h4>Manuscript</h4>
                  <Toggle checked={includeFrontMatter} onChange={setIncludeFrontMatter} label="Title page" detail="Begin with the novel title and byline" />
                  <Toggle checked={includeChapterNumbers} onChange={setIncludeChapterNumbers} label="Chapter numbering" detail="Use the manuscript’s numbered structure" />
                  <Toggle checked={includePartHeadings} onChange={setIncludePartHeadings} label="Part headings" detail="Preserve books, parts and acts" />
                  <Toggle checked={includeSceneBreaks} onChange={setIncludeSceneBreaks} label="Scene breaks" detail="Keep ornamental scene separators" />
                  <Toggle checked={includeWordStats} onChange={setIncludeWordStats} label="Writing statistics" detail="Append words and chapter totals" />
                  <Toggle checked={useDesignerTheme} onChange={setUseDesignerTheme} label="Designer theme" detail="Use your page colours, typography and ornaments" />
                </div>

                {supportsTypography && (
                  <div className="export-setting-group export-typography">
                    <h4>Typography</h4>
                    <label><span>Typeface</span><select value={printFont} onChange={(event) => setPrintFont(event.target.value)}>{printFontOptions.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}</select></label>
                    <label><span>Line spacing</span><select value={lineSpacing} onChange={(event) => setLineSpacing(event.target.value)}><option value="1">Single</option><option value="1.15">Compact</option><option value="1.5">Book</option><option value="2">Double</option></select></label>
                  </div>
                )}
              </>
            ) : (
              <div className="export-backup-note"><Icon icon="fa-solid fa-box-archive" /><div><strong>Complete project archive</strong><p>Includes the novel record, every chapter, structure, design settings and timestamps without changing your data.</p></div></div>
            )}
          </section>

          <aside className="export-summary">
            <div className="export-paper-preview">
              <span className="export-paper-moon">☾</span>
              <small>MoonScribe</small>
              <h3>{novel?.title || 'Untitled novel'}</h3>
              <i />
              <p>{prepared.chapterCount} chapters</p>
            </div>
            <dl>
              <div><dt>Words</dt><dd>{prepared.totalWords.toLocaleString()}</dd></div>
              <div><dt>Chapters</dt><dd>{prepared.chapterCount}</dd></div>
              <div><dt>File</dt><dd title={filename}>{filename}</dd></div>
            </dl>
          </aside>
        </div>

        <footer className="export-footer">
          <div className="export-imports">
            <span>Bringing work in?</span>
            <button type="button" onClick={() => importMdRef?.current?.click()}>Import Markdown</button>
            <button type="button" onClick={() => importRtfRef?.current?.click()}>Import RTF</button>
          </div>
          <div className="export-actions">
            <button className="button button-ghost" onClick={onClose} disabled={exporting}>Cancel</button>
            <button className="button button-primary export-submit" onClick={run} disabled={exporting}>
              <Icon icon={exporting ? 'fa-solid fa-spinner fa-spin' : selectedFormat?.icon} />
              {exporting ? 'Preparing…' : format === 'pdf' ? 'Open print studio' : `Export ${selectedFormat?.label}`}
            </button>
          </div>
        </footer>
      </div>
    </Modal>
  )
}

function Toggle({ checked, onChange, label, detail }) {
  return (
    <label className="export-toggle-row">
      <span><strong>{label}</strong><small>{detail}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  )
}
