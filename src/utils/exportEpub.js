// EPUB 3 export, built entirely in the browser. Chapters become XHTML
// documents with a contents <nav>; the whole thing is zipped (STORE) with a
// standard mimetype/container layout so it opens in any reader.
import { buildZip } from './zip'
import { downloadBlob, safeName } from './download'

function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Rewrite the editor's HTML for XHTML: scene breaks become a centered
// paragraph, void elements are self-closed.
function toXhtml(html, symbol) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(String(html), 'text/html')
  doc.querySelectorAll('.scene-break').forEach((el) => {
    const p = doc.createElement('p')
    p.className = 'scene-break'
    p.textContent = symbol
    el.replaceWith(p)
  })
  return doc.body.innerHTML
    .replace(/<(img|br|hr)([^>]*)>/gi, '<$1$2/>')
    .replace(/\sdata-(?:"[^"]*"|'[^']*'|[^\s>]+)/g, '')
}

function uuid() {
  const rnd = (n) => n.toString(16).padStart(2, '0')
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return Array.from(bytes).map(rnd).join('')
}

function chapterDoc(title, body, idx) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<link rel="stylesheet" href="style.css"/>
</head>
<body>
<section epub:type="chapter">
<h2 class="chapter-title">${esc(title)}</h2>
<div class="content">${body}</div>
</section>
</body>
</html>`
}

export function buildEpub(novel, chapters, layout = {}) {
  const symbol = layout.sceneBreak || '❦'
  const byline = layout.cover?.byline || novel?.byline || ''
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const theme = layout.exportTheme || { paper: '#ffffff', ink: '#211d19', accent: '#8a6a3d' }

  const files = []
  const manifest = []
  const spine = []

  files.push({ name: 'mimetype', data: 'application/epub+zip' })
  files.push({
    name: 'META-INF/container.xml',
    data: `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  })

  if (layout.includeFrontMatter !== false) {
    manifest.push('<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>')
    spine.push('<itemref idref="title"/>')
    files.push({ name: 'OEBPS/title.xhtml', data: `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${esc(novel.title)}</title><link rel="stylesheet" href="style.css"/></head>
<body><section class="title-page"><h1>${esc(novel.title || 'Untitled novel')}</h1>${byline ? `<p>${esc(byline)}</p>` : ''}</section></body></html>` })
  }

  chapters.forEach((c, i) => {
    const id = `ch${i + 1}`
    const title = c.title || 'Untitled'
    manifest.push(`<item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`)
    spine.push(`<itemref idref="${id}"/>`)
    files.push({ name: `OEBPS/${id}.xhtml`, data: chapterDoc(title, toXhtml(c.content || '', symbol), i) })
  })

  const navItems = chapters
    .map((c, i) => `        <li><a href="ch${i + 1}.xhtml">${esc(c.title || 'Untitled')}</a></li>`)
    .join('\n')

  files.push({
    name: 'OEBPS/nav.xhtml',
    data: `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
<meta charset="utf-8"/>
<title>Contents</title>
<link rel="stylesheet" href="style.css"/>
</head>
<body>
<nav epub:type="toc">
<h1>Contents</h1>
<ol>
${navItems}
</ol>
</nav>
</body>
</html>`
  })

  files.push({
    name: 'OEBPS/style.css',
    data: `body { font-family: ${String(layout.printFont || 'Georgia').replace(/[;{}]/g, '')}, Georgia, 'Times New Roman', serif; margin: 0; background: ${theme.paper}; color: ${theme.ink}; }
.title-page { min-height: 80vh; display: flex; flex-direction: column; justify-content: center; text-align: center; }
.chapter-title { text-align: center; font-size: 1.4em; margin: 1em 0; }
.content p { margin: 0 0 1em; line-height: ${Number(layout.lineSpacing) || 1.5}; }
.content .scene-break { text-align: center; margin: 1.2em 0; color: ${theme.accent}; }
.content .page-break, .content .pg-break, .content [data-page-break="true"] { break-after: page; page-break-after: always; height: 0; }
nav ol { line-height: 1.8; }
`
  })

  manifest.push(`<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`)
  manifest.push(`<item id="css" href="style.css" media-type="text/css"/>`)
  spine.push(`<itemref idref="nav"/>`)

  files.push({
    name: 'OEBPS/content.opf',
    data: `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:${uuid()}</dc:identifier>
    <dc:title>${esc(novel.title)}</dc:title>
    <dc:creator>${esc(byline)}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
${manifest.map((m) => '    ' + m).join('\n')}
  </manifest>
  <spine>
${spine.map((s) => '    ' + s).join('\n')}
  </spine>
</package>`
  })

  return buildZip(files)
}

export function exportNovelEpub(novel, chapters, layout, filename) {
  const blob = new Blob([buildEpub(novel, chapters, layout)], { type: 'application/epub+zip' })
  downloadBlob(blob, filename || `${safeName(novel.title)}.epub`)
}
