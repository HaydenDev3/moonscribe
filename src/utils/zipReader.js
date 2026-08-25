// Small ZIP reader for desktop imports. Supports the STORE and DEFLATE methods
// used by DOCX and EPUB packages without adding a second archive dependency.
export async function readZipEntries(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 0xffff - 22); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('That file is not a readable ZIP package.')
  const count = view.getUint16(eocd + 10, true)
  let cursor = view.getUint32(eocd + 16, true)
  const entries = new Map()
  for (let i = 0; i < count; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('The ZIP directory is invalid.')
    const method = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const nameSize = view.getUint16(cursor + 28, true)
    const extraSize = view.getUint16(cursor + 30, true)
    const commentSize = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameSize))
    entries.set(name, { method, compressedSize, localOffset })
    cursor += 46 + nameSize + extraSize + commentSize
  }
  const read = async (name) => {
    const entry = entries.get(name)
    if (!entry) return null
    const offset = entry.localOffset
    const nameSize = view.getUint16(offset + 26, true)
    const extraSize = view.getUint16(offset + 28, true)
    const raw = bytes.slice(offset + 30 + nameSize + extraSize, offset + 30 + nameSize + extraSize + entry.compressedSize)
    if (entry.method === 0) return raw
    if (entry.method !== 8 || typeof globalThis.DecompressionStream === 'undefined') throw new Error(`Compressed ZIP entry “${name}” cannot be read here.`)
    const stream = new Blob([raw]).stream().pipeThrough(new globalThis.DecompressionStream('deflate-raw'))
    return new Uint8Array(await new globalThis.Response(stream).arrayBuffer())
  }
  return { names: [...entries.keys()], read }
}

export async function docxToChapters(input) {
  const zip = await readZipEntries(input)
  const xmlBytes = await zip.read('word/document.xml')
  if (!xmlBytes) throw new Error('The DOCX document body is missing.')
  const xml = new DOMParser().parseFromString(new TextDecoder().decode(xmlBytes), 'application/xml')
  const paragraphs = [...(xml.getElementsByTagNameNS('*', 'p').length ? xml.getElementsByTagNameNS('*', 'p') : xml.getElementsByTagName('w:p'))].map((p) => {
    const textNodes = p.getElementsByTagNameNS('*', 't')
    const text = [...(textNodes.length ? textNodes : p.getElementsByTagName('w:t'))].map((node) => node.textContent || '').join('')
    const styles = p.getElementsByTagNameNS('*', 'pStyle')
    const style = (styles.length ? styles[0] : p.getElementsByTagName('w:pStyle')[0])?.getAttribute('w:val') || ''
    return { text: text.trim(), heading: /^heading/i.test(style) }
  }).filter((p) => p.text)
  const chapters = []
  let current = { title: 'Imported manuscript', lines: [] }
  for (const paragraph of paragraphs) {
    if (paragraph.heading && current.lines.length) { chapters.push(current); current = { title: paragraph.text, lines: [] } }
    else if (paragraph.heading) current.title = paragraph.text
    else current.lines.push(paragraph.text)
  }
  if (current.lines.length) chapters.push(current)
  return chapters.map((chapter) => ({ title: chapter.title, content: chapter.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('') }))
}

export async function epubToChapters(input) {
  const zip = await readZipEntries(input)
  const containerBytes = await zip.read('META-INF/container.xml')
  if (!containerBytes) throw new Error('The EPUB container is missing.')
  const container = new DOMParser().parseFromString(new TextDecoder().decode(containerBytes), 'application/xml')
  const rootfile = container.getElementsByTagName('rootfile')[0]?.getAttribute('full-path')
  if (!rootfile) throw new Error('The EPUB package manifest is missing.')
  const opfBytes = await zip.read(rootfile)
  if (!opfBytes) throw new Error('The EPUB package file is missing.')
  const opf = new DOMParser().parseFromString(new TextDecoder().decode(opfBytes), 'application/xml')
  const base = rootfile.includes('/') ? rootfile.slice(0, rootfile.lastIndexOf('/') + 1) : ''
  const items = new Map([...opf.getElementsByTagName('item')].map((item) => [item.getAttribute('id'), item.getAttribute('href')]))
  return (await Promise.all([...opf.getElementsByTagName('itemref')].map(async (ref) => {
    const href = items.get(ref.getAttribute('idref'))
    if (!href) return null
    const bytes = await zip.read(`${base}${decodeURIComponent(href)}`)
    if (!bytes) return null
    const html = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'text/html')
    const title = html.querySelector('h1,h2,h3,title')?.textContent?.trim() || 'Imported chapter'
    const content = [...html.body.querySelectorAll('h1,h2,h3,p,li,blockquote')].map((node) => `<p>${escapeHtml(node.textContent?.trim() || '')}</p>`).join('')
    return content ? { title, content } : null
  }))).filter(Boolean)
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
}
