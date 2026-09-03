import { describe, expect, it } from 'vitest'
import { buildBookPreview, normalizeBookPreview } from '../src/utils/bookPreview'

describe('shared book preview model', () => {
  it('normalizes geometry and produces explicit pages', () => {
    const result = buildBookPreview({ title: 'A Book' }, [{ id: 'c1', title: 'First', content: '<p>Hello world.</p>' }], { pageSize: 'a5', pageMargin: 12 })
    expect(result.pages.map((page) => page.type)).toEqual(['title', 'chapter-open'])
    expect(result.pages[1].chapterTitle).toBe('First')
    expect(result.pageCount).toBe(1)
  })

  it('changes capacity when typography or geometry changes', () => {
    const compact = normalizeBookPreview({}, [], { pageSize: 'a4', pageMargin: 12, bodySize: 10 })
    const spacious = normalizeBookPreview({}, [], { pageSize: 'pocket', pageMargin: 25, bodySize: 14, lineSpacing: 2 })
    expect(compact.charsPerLine * compact.linesPerPage).toBeGreaterThan(spacious.charsPerLine * spacious.linesPerPage)
  })

  it('reports empty manuscripts and short final pages', () => {
    expect(buildBookPreview({}, [], {}).diagnostics.some((item) => item.message.includes('No chapters'))).toBe(true)
    expect(buildBookPreview({}, [{ id: 'c', title: 'End', content: '<p>Short ending.</p>' }], {}).diagnostics.some((item) => item.message.includes('short page'))).toBe(true)
  })
})
