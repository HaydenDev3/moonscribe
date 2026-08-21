import { describe, expect, it } from 'vitest'
import { PAGE_MARGIN_PRESETS, PAGE_PRESETS, editorPageGeometry, mmToTwips, pageSizeMm, pageSizeTwips, pageMarginMm } from '../src/utils/pageSize'

describe('pageSize', () => {
  it('exposes preset trim sizes', () => {
    expect(PAGE_PRESETS.some((p) => p.key === 'trade-paperback')).toBe(true)
    const tp = PAGE_PRESETS.find((p) => p.key === 'trade-paperback')
    expect(tp.w).toBeCloseTo(139.7)
    expect(tp.h).toBeCloseTo(215.9)
  })

  it('mmToTwips rounds to whole twips', () => {
    expect(mmToTwips(0)).toBe(0)
    expect(mmToTwips(25.4)).toBe(1440) // 1 inch
    expect(mmToTwips(20)).toBe(1134) // 20mm ≈ 1133.9
  })

  it('resolves preset keys and object sizes', () => {
    expect(pageSizeMm('a5')).toEqual({ w: 148, h: 210 })
    expect(pageSizeMm({ w: 120, h: 180 })).toEqual({ w: 120, h: 180 })
    expect(pageSizeMm({ w: 0, h: 0 })).toEqual({ w: 139.7, h: 215.9 })
    expect(pageSizeMm('unknown')).toEqual({ w: 139.7, h: 215.9 })
  })

  it('converts page sizes to twips', () => {
    const { width, height } = pageSizeTwips('a5')
    expect(width).toBe(Math.round(148 * 56.6929))
    expect(height).toBe(Math.round(210 * 56.6929))
  })

  it('pageMarginMm clamps to a sane default', () => {
    expect(pageMarginMm(15)).toBe(15)
    expect(pageMarginMm(undefined)).toBe(20)
    expect(pageMarginMm('nope')).toBe(20)
    expect(pageMarginMm(0)).toBe(20)
  })

  it('uses the same physical geometry for editor pages and export pages', () => {
    const page = editorPageGeometry('a4', 20)
    expect(page.widthMm).toBe(210)
    expect(page.heightMm).toBe(297)
    expect(page.marginMm).toBe(20)
    expect(page.marginTopPx).toBe(page.marginPx)
    expect(page.marginRightPx).toBe(page.marginPx)
    expect(page.marginBottomPx).toBe(page.marginPx)
    expect(page.marginLeftPx).toBe(page.marginPx)
    expect(page.bodyWidthPx).toBe(Math.round(170 * 96 / 25.4))
    expect(page.bodyHeightPx).toBe(Math.round(257 * 96 / 25.4))
    expect(page.heightPx - page.bodyHeightPx).toBe(page.marginPx * 2)
  })

  it('provides familiar document margin presets', () => {
    expect(PAGE_MARGIN_PRESETS.map((preset) => preset.value)).toEqual([12, 16, 20, 25, 32])
  })

  it('keeps an editable text area when legacy margins are too large', () => {
    const page = editorPageGeometry('pocket', 500)
    expect(page.bodyWidthPx).toBeGreaterThanOrEqual(Math.round(20 * 96 / 25.4))
    expect(page.bodyHeightPx).toBeGreaterThanOrEqual(Math.round(20 * 96 / 25.4))
  })
})
