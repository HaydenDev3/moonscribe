import { describe, expect, it } from 'vitest'
import { buildZip } from '../src/utils/zip'
import { docxToChapters, epubToChapters, readZipEntries } from '../src/utils/zipReader'

describe('desktop import ZIP readers', () => {
  it('reads stored ZIP entries and DOCX heading chapters', async () => {
    const document = '<?xml version="1.0"?><w:document xmlns:w="urn:schemas-microsoft-com:office:word"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter One</w:t></w:r></w:p><w:p><w:r><w:t>First paragraph.</w:t></w:r></w:p></w:body></w:document>'
    const archive = buildZip([{ name: 'word/document.xml', data: document }])
    const zip = await readZipEntries(archive)
    expect(new TextDecoder().decode(await zip.read('word/document.xml'))).toContain('Chapter One')
    const chapters = await docxToChapters(archive)
    expect(chapters).toHaveLength(1)
    expect(chapters[0].title).toBe('Chapter One')
    expect(chapters[0].content).toContain('First paragraph.')
  })

  it('rejects malformed archives', async () => {
    await expect(readZipEntries(new Uint8Array([1, 2, 3]))).rejects.toThrow('ZIP')
  })

  it('follows EPUB container, manifest, and spine order', async () => {
    const archive = buildZip([
      { name: 'META-INF/container.xml', data: '<container><rootfiles><rootfile full-path="OEBPS/package.opf"/></rootfiles></container>' },
      { name: 'OEBPS/package.opf', data: '<package><manifest><item id="one" href="one.xhtml"/><item id="two" href="two.xhtml"/></manifest><spine><itemref idref="two"/><itemref idref="one"/></spine></package>' },
      { name: 'OEBPS/one.xhtml', data: '<html><body><h1>First</h1><p>One.</p></body></html>' },
      { name: 'OEBPS/two.xhtml', data: '<html><body><h1>Second</h1><p>Two.</p></body></html>' }
    ])
    const chapters = await epubToChapters(archive)
    expect(chapters.map((chapter) => chapter.title)).toEqual(['Second', 'First'])
    expect(chapters[0].content).toContain('Two.')
  })
})
