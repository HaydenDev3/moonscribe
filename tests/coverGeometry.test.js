import { describe, expect, it } from 'vitest'
import { coverGeometry, estimatePageCount } from '../src/utils/coverGeometry'

describe('cover geometry', () => {
  it('derives a printable spine and full-wrap measurements from editor trim', () => {
    const chapters = [{ wordCount: 30000 }, { wordCount: 30000 }]
    const layout = { pageSize: 'a5', bodySize: 11.5, bodyLineSpacing: 1.5, bleed: 3 }
    const geometry = coverGeometry(chapters, layout)

    expect(geometry.trimWidthMm).toBe(148)
    expect(geometry.trimHeightMm).toBe(210)
    expect(geometry.pages).toBeGreaterThan(190)
    expect(geometry.spineMm).toBeGreaterThan(10)
    expect(geometry.wrapWidthMm).toBeCloseTo(148 * 2 + geometry.spineMm + 6, 1)
  })

  it('keeps short books at a practical minimum page count and spine', () => {
    expect(estimatePageCount([], {})).toBe(24)
    expect(coverGeometry([], {}).spineMm).toBe(2)
  })
})
