import { describe, expect, it } from 'vitest'
import { PAGE_PRESETS, mmToTwips, pageSizeMm, pageSizeTwips, pageMarginMm } from '../src/utils/pageSize'

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
})
