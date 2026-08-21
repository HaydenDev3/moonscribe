// Tests for EPUB assembly, the STORE-only ZIP writer, and Markdown import.
import { describe, it, expect } from 'vitest'
import { buildZip } from '../src/utils/zip'
import { buildEpub } from '../src/utils/exportEpub'
import { markdownToChapters, markdownWordCount } from '../src/utils/markdownToChapters'

const dec = new TextDecoder()

function readLocalData(bytes, offset) {
  // Local file header is 30 bytes + nameLen + extraLen; entry data follows.
  const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8)
  const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8)
  const start = offset + 30 + nameLen + extraLen
  const size = bytes[offset + 22] | (bytes[offset + 23] << 8) | (bytes[offset + 24] << 16) | (bytes[offset + 25] << 24)
  return { name: dec.decode(bytes.slice(offset + 30, offset + 30 + nameLen)), start, size, method: bytes[offset + 8] | (bytes[offset + 9] << 8) }
}

describe('zip (STORE writer)', () => {
  it('writes a valid empty-zip signature and entries', () => {
    const zip = buildZip([{ name: 'a.txt', data: 'hello' }, { name: 'b.txt', data: 'world!' }])
    // PK\x03\x04 local header
    expect(zip[0]).toBe(0x50)
    expect(zip[1]).toBe(0x4b)
    expect(zip[2]).toBe(0x03)
    expect(zip[3]).toBe(0x04)

    const e1 = readLocalData(zip, 0)
    expect(e1.name).toBe('a.txt')
    expect(dec.decode(zip.slice(e1.start, e1.start + e1.size))).toBe('hello')

    const e2 = readLocalData(zip, e1.start + e1.size)
    expect(e2.name).toBe('b.txt')
    expect(dec.decode(zip.slice(e2.start, e2.start + e2.size))).toBe('world!')

    // End-of-central-directory present near the end.
    const tail = zip.slice(-22)
    expect(tail[0]).toBe(0x50)
    expect(tail[1]).toBe(0x4b)
    expect(tail[2]).toBe(0x05)
    expect(tail[3]).toBe(0x06)
  })

  it('stores the mimetype entry first and uncompressed', () => {
    const zip = buildZip([
      { name: 'META-INF/container.xml', data: '<container/>' },
      { name: 'mimetype', data: 'application/epub+zip' },
      { name: 'content.opf', data: '<package/>' }
    ])
    const first = readLocalData(zip, 0)
    expect(first.name).toBe('mimetype')
    expect(first.method).toBe(0)
    expect(dec.decode(zip.slice(first.start, first.start + first.size))).toBe('application/epub+zip')
  })
})

describe('buildEpub', () => {
  const novel = { title: 'The Tide & the Storm' }
  const layout = { sceneBreak: '❦', cover: { byline: 'S. River' } }
  const chapters = [
    { title: 'The Shore', content: '<p>Morning light.</p><p class="scene-break">❦</p><p>Then the rain.</p>' },
    { title: 'The Deep', content: '' }
  ]

  it('creates the required EPUB container files', () => {
    const zip = buildEpub(novel, chapters, layout)
    const names = []
    let offset = 0
    // Walk local headers to collect entry names.
    while (offset < zip.length) {
      if (zip[offset] !== 0x50 || zip[offset + 1] !== 0x4b || zip[offset + 2] !== 0x03) break
      const e = readLocalData(zip, offset)
      names.push(e.name)
      if (e.size === 0) break
      offset = e.start + e.size
    }
    expect(names[0]).toBe('mimetype')
    expect(names).toContain('META-INF/container.xml')
    expect(names).toContain('OEBPS/content.opf')
    expect(names).toContain('OEBPS/nav.xhtml')
    expect(names).toContain('OEBPS/style.css')
    expect(names).toContain('OEBPS/ch1.xhtml')
    expect(names).toContain('OEBPS/ch2.xhtml')
  })

  it('escapes the novel title in metadata', () => {
    const zip = buildEpub(novel, chapters, layout)
    let offset = 0
    let opf = ''
    while (offset < zip.length) {
      if (zip[offset] !== 0x50 || zip[offset + 1] !== 0x4b || zip[offset + 2] !== 0x03) break
      const e = readLocalData(zip, offset)
      if (e.name === 'OEBPS/content.opf') {
        opf = dec.decode(zip.slice(e.start, e.start + e.size))
        break
      }
      if (e.size === 0) break
      offset = e.start + e.size
    }
    expect(opf).toContain('<dc:title>The Tide &amp; the Storm</dc:title>')
    expect(opf).toContain('<dc:creator>S. River</dc:creator>')
    expect(opf).toContain('idref="ch1"')
  })

  it('replaces scene breaks with a centered paragraph in chapter xhtml', () => {
    const zip = buildEpub(novel, chapters, layout)
    let offset = 0
    let ch1 = ''
    while (offset < zip.length) {
      if (zip[offset] !== 0x50 || zip[offset + 1] !== 0x4b || zip[offset + 2] !== 0x03) break
      const e = readLocalData(zip, offset)
      if (e.name === 'OEBPS/ch1.xhtml') {
        ch1 = dec.decode(zip.slice(e.start, e.start + e.size))
        break
      }
      if (e.size === 0) break
      offset = e.start + e.size
    }
    expect(ch1).toContain('<p class="scene-break">❦</p>')
    expect(ch1).toContain('Morning light.')
  })
})

describe('markdownToChapters', () => {
  it('turns # / ## headings into chapters and ### into inner headings', () => {
    const md = `# The Salt Garden

## Chapter One

### A Fresh Wind

The boat went out.

## Chapter Two

Nothing more.

`
    const chapters = markdownToChapters(md)
    expect(chapters.map((c) => c.title)).toEqual(['The Salt Garden', 'Chapter One', 'Chapter Two'])
    expect(chapters[1].content).toContain('<h3>A Fresh Wind</h3>')
    expect(chapters[1].content).toContain('<p>The boat went out.</p>')
  })

  it('preserves emphasis, links, quotes, lists and scene breaks', () => {
    const md = `## One

> A **quiet** warning

- first
- second

Then *stillness*.

***
`
    const chapters = markdownToChapters(md)
    const content = chapters[0].content
    expect(content).toContain('<blockquote>A <strong>quiet</strong> warning</blockquote>')
    expect(content).toContain('<ul><li>first</li><li>second</li></ul>')
    expect(content).toContain('<em>stillness</em>')
    expect(content).toContain('<p class="scene-break">❦</p>')
  })

  it('counts words from imported chapters', () => {
    const md = `## One\n\nHello dark world.\n\n## Two\n\nOnly one more.`
    expect(markdownWordCount(md)).toBe(6)
  })
})
