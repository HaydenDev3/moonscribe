import { describe, expect, it } from 'vitest'
import { buildStyledHtml, filterSceneBreaks, prepareExport } from '../src/utils/exportDocument'

const novel = { title: 'Moon & Ember', byline: 'A. Writer' }
const chapters = [
  { id: 'c2', kind: 'chapter', order: 3, title: 'Second', content: '<p>Two</p>', wordCount: 1 },
  { id: 'part', kind: 'part', order: 1, title: 'The Beginning', content: '', wordCount: 0 },
  { id: 'c1', kind: 'chapter', order: 2, title: 'First', content: '<p>One</p>', wordCount: 1 },
]

describe('export document preparation', () => {
  it('orders the manuscript and keeps structural headings out of chapter totals', () => {
    const result = prepareExport(novel, chapters, {
      includePartHeadings: true,
      includeChapterNumbers: false,
    })

    expect(result.items.map((item) => item.id)).toEqual(['part', 'c1', 'c2'])
    expect(result.manuscript.map((item) => item.id)).toEqual(['c1', 'c2'])
    expect(result.chapterCount).toBe(2)
    expect(result.totalWords).toBe(2)
  })

  it('removes scene breaks and unsafe interactive markup from exported prose', () => {
    const html = filterSceneBreaks('<p onclick="bad()">Safe</p><div class="scene-break">❦</div><script>bad()</script>', false)

    expect(html).toContain('Safe')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('scene-break')
    expect(html).not.toContain('<script')
  })

  it('escapes metadata and emits self-contained print CSS', () => {
    const html = buildStyledHtml({ title: '<Moon & Ember>' }, prepareExport(novel, chapters, { includePartHeadings: false }).manuscript, {
      includeFrontMatter: true,
      includeSceneBreaks: true,
      lineSpacing: '1.5',
    })

    expect(html).toContain('&lt;Moon &amp; Ember&gt;')
    expect(html).toContain('@media print')
    expect(html).not.toContain('<h1><Moon')
  })
})
