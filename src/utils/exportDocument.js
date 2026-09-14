import { computeNumbers, isContainer, titleFor } from './numbering'
import { safeName } from './download'
import { pageMarginMm, pageSizeMm } from './pageSize'

export const EXPORT_FORMATS = [
  { key: 'pdf', label: 'PDF', detail: 'Print-ready pages', icon: 'fa-solid fa-file-pdf', group: 'Publish' },
  { key: 'epub', label: 'EPUB', detail: 'eReaders and stores', icon: 'fa-solid fa-book-open', group: 'Publish' },
  { key: 'docx', label: 'Word', detail: 'Continue editing', icon: 'fa-solid fa-file-word', group: 'Publish' },
  { key: 'markdown', label: 'Markdown', detail: 'Portable source', icon: 'fa-brands fa-markdown', group: 'Archive' },
  { key: 'txt', label: 'Plain text', detail: 'Formatting-free', icon: 'fa-solid fa-file-lines', group: 'Archive' },
  { key: 'html', label: 'Web page', detail: 'Styled HTML', icon: 'fa-solid fa-code', group: 'Archive' },
  { key: 'json', label: 'MoonScribe', detail: 'Complete backup', icon: 'fa-solid fa-database', group: 'Archive' },
]

export function escapeExportHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function prepareExport(novel, chapters, options = {}) {
  const ordered = [...(chapters || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const numbers = computeNumbers(ordered)
  const items = ordered
    .filter((chapter) => !isContainer(chapter) || options.includePartHeadings)
    .map((chapter) => ({
      ...chapter,
      exportContainer: isContainer(chapter),
      title: options.includeChapterNumbers && !isContainer(chapter)
        ? titleFor(chapter, numbers)
        : (chapter.title || (isContainer(chapter) ? 'Part' : 'Chapter')),
    }))
  const manuscript = items.filter((chapter) => !chapter.exportContainer)
  const totalWords = manuscript.reduce((sum, chapter) => sum + (chapter.wordCount || 0), 0)

  return {
    items,
    manuscript,
    totalWords,
    chapterCount: manuscript.length,
    baseName: safeName(novel?.title || 'untitled-novel'),
  }
}

// Interior Layout stores print-specific settings under layout.interiorLayout,
// while the older export surfaces read the edition-level layout directly.
// Resolve both shapes here so browser exports match the live proof.
export function resolveExportLayout(layout = {}) {
  const interior = layout.interiorLayout || {}
  const margins = interior.margins || {}
  const pageSize = pageSizeMm(interior.pageSize ?? layout.pageSize)
  const orientedPageSize = interior.orientation === 'landscape'
    ? { w: pageSize.h, h: pageSize.w }
    : pageSize

  return {
    ...layout,
    ...interior,
    pageSize: orientedPageSize,
    pageMargin: margins.top ?? layout.pageMargin,
    pageMargins: margins,
    printFont: interior.bodyFont || layout.printFont,
    bodySize: interior.bodySize ?? layout.bodySize,
    lineSpacing: interior.lineHeight ?? layout.lineSpacing,
    textAlign: interior.paragraphStyle === 'left' ? 'left' : 'justify',
    firstIndent: interior.firstLineIndent ?? layout.firstIndent,
    chapterFont: interior.chapterFont || layout.chapterFont,
    chapterSize: interior.chapterSize ?? layout.chapterSize,
    chapterAlignment: interior.chapterAlignment || layout.chapterAlignment,
    showHeaders: interior.showHeaders ?? layout.showHeaders,
    showPageNumbers: interior.showPageNumbers ?? layout.showPageNumbers,
    pageNumberPosition: interior.pageNumberPosition || layout.pageNumberPosition,
  }
}

export function filterSceneBreaks(html, includeSceneBreaks) {
  if (!html || typeof DOMParser === 'undefined') return html || ''
  const doc = new DOMParser().parseFromString(String(html), 'text/html')
  doc.querySelectorAll('script, iframe, object, embed, link, meta').forEach((node) => node.remove())
  doc.body.querySelectorAll('*').forEach((node) => {
    ;[...node.attributes].forEach((attribute) => {
      if (/^on/i.test(attribute.name) || /^data-(entity|character|mention)/i.test(attribute.name)) {
        node.removeAttribute(attribute.name)
      }
    })
  })
  if (!includeSceneBreaks) {
    doc.querySelectorAll('.scene-break, [data-scene-break]').forEach((node) => node.remove())
  }
  return doc.body.innerHTML
}

export function buildStyledHtml(novel, items, options = {}) {
  const font = String(options.printFont || 'Georgia').replace(/[;{}]/g, '')
  const spacing = ['1', '1.15', '1.5', '2'].includes(String(options.lineSpacing))
    ? String(options.lineSpacing)
    : '1.5'
  const title = escapeExportHtml(novel?.title || 'Untitled novel')
  const theme = options.exportTheme || { paper: '#fffdf9', ink: '#211d19', accent: '#8a6a3d' }
  const layout = resolveExportLayout(options.layout || novel?.layout || {})
  const page = pageSizeMm(layout.pageSize)
  const margins = layout.pageMargins || {}
  const margin = pageMarginMm(layout.pageMargin)
  const pageMarginTop = pageMarginMm(margins.top ?? margin)
  const pageMarginBottom = pageMarginMm(margins.bottom ?? margin)
  const pageMarginInside = pageMarginMm(margins.inside ?? margin)
  const pageMarginOutside = pageMarginMm(margins.outside ?? margin)
  const bodySize = Number(layout.bodySize) || 11
  const chapterSize = Number(layout.chapterSize) || 24
  const paragraphIndent = Number(layout.firstIndent ?? layout.firstLineIndent) || 0
  const paragraphAlign = layout.textAlign === 'justify' || layout.paragraphStyle === 'justified' ? 'justify' : 'left'
  const paragraphSpacing = Number.isFinite(Number(layout.paragraphSpacing)) ? Number(layout.paragraphSpacing) : 1
  const chapterAlign = layout.chapterAlignment === 'left' || layout.chapterStyle === 'left' ? 'left' : 'center'
  const byline = escapeExportHtml(novel?.layout?.cover?.byline || novel?.byline || '')
  const sections = items.map((chapter) => {
    if (chapter.exportContainer) {
      return `<section class="part"><h1>${escapeExportHtml(chapter.title)}</h1></section>`
    }
    return `<section class="chapter"><h2>${escapeExportHtml(chapter.title)}</h2><div class="prose">${filterSceneBreaks(chapter.content, options.includeSceneBreaks)}</div></section>`
  }).join('\n')
  const stats = options.includeWordStats
    ? `<footer>${Number(options.totalWords || 0).toLocaleString()} words · ${Number(options.chapterCount || 0).toLocaleString()} chapters</footer>`
    : ''
  const frontMatter = options.includeFrontMatter
    ? `<header class="title-page"><p class="eyebrow">A MoonScribe manuscript</p><h1>${title}</h1>${byline ? `<p class="byline">${byline}</p>` : ''}</header>`
    : ''

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
:root{color-scheme:light;--ink:${theme.ink};--muted:color-mix(in srgb,${theme.ink} 62%,transparent);--rule:color-mix(in srgb,${theme.accent} 38%,transparent);--paper:${theme.paper};--accent:${theme.accent}}
*{box-sizing:border-box}body{margin:0;background:#eee9e1;color:var(--ink);font-family:${font},Georgia,serif;line-height:${spacing}}
.title-page,.chapter,.part{width:min(100% - 32px,760px);min-height:calc(100vh - 48px);margin:24px auto;padding:${pageMarginTop}mm ${pageMarginOutside}mm ${pageMarginBottom}mm ${pageMarginInside}mm;background:var(--paper);box-shadow:0 12px 40px #342b211c}
.title-page,.part{display:grid;place-content:center;text-align:center}.title-page h1,.part h1{font-size:clamp(2.4rem,7vw,5rem);line-height:1.02;margin:.2em 0}.eyebrow{font:600 .72rem/1.2 system-ui;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.byline{font-style:italic;color:var(--muted)}.chapter h2{text-align:${chapterAlign};font-family:${String(layout.chapterFont || font).replace(/[;{}]/g, '')},Georgia,serif;font-size:${chapterSize}pt;line-height:1.15;margin:0 0 3em}.prose{font-size:${bodySize}pt;text-align:${paragraphAlign}}.prose p{margin:0 0 ${paragraphSpacing}em;text-indent:${paragraphIndent}em}.prose blockquote{border-left:2px solid var(--rule);margin:1.5em 0;padding-left:1.25em;color:var(--muted)}
.scene-break{text-align:center;margin:2em 0}.page-break,.pg-break,.pg-auto-break,[data-page-break="true"],[data-auto-page-break="true"]{break-after:page;page-break-after:always;height:0;overflow:hidden}footer{width:min(100% - 32px,760px);margin:24px auto;color:var(--muted);font:500 .8rem system-ui;text-align:center}
@page{size:${page.w}mm ${page.h}mm;margin:${pageMarginTop}mm ${pageMarginOutside}mm ${pageMarginBottom}mm ${pageMarginInside}mm}
@media print{body{background:white}.title-page,.chapter,.part{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none;break-after:page}.chapter:last-of-type{break-after:auto}footer{display:none}}
</style></head><body>${frontMatter}${sections}${stats}</body></html>`
}
