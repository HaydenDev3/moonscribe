import { describe, expect, it } from 'vitest'
import { geometryChanged, normalizeBookGeometry, rendererDiagnostics } from '../src/utils/bookRenderer'

describe('book renderer foundation', () => {
  it('normalizes shared cover measurements', () => {
    const geometry = normalizeBookGeometry({ trimWidthMm: 148, trimHeightMm: 210, spineMm: 12.4, bleedMm: 3, pages: 240 })
    expect(geometry.aspect).toBeCloseTo(210 / 148)
    expect(geometry.spineRatio).toBeCloseTo(12.4 / 148)
    expect(geometry.pages).toBe(240)
  })

  it('ignores sub-pixel geometry noise but detects real changes', () => {
    const base = normalizeBookGeometry({ trimWidthMm: 148, trimHeightMm: 210, spineMm: 12.4, pages: 240 })
    expect(geometryChanged(base, normalizeBookGeometry({ trimWidthMm: 148.001, trimHeightMm: 210, spineMm: 12.4, pages: 240 }))).toBe(false)
    expect(geometryChanged(base, normalizeBookGeometry({ trimWidthMm: 152.4, trimHeightMm: 228.6, spineMm: 12.4, pages: 240 }))).toBe(true)
  })

  it('creates local, non-content renderer diagnostics', () => {
    const diagnostics = rendererDiagnostics({ webgl: true, quality: 'balanced', contextLosses: 1, textureFailures: 2 })
    expect(diagnostics).toMatchObject({ webgl: true, quality: 'balanced', contextLosses: 1, textureFailures: 2 })
    expect(diagnostics).not.toHaveProperty('coverImage')
    expect(diagnostics).not.toHaveProperty('manuscript')
  })
})
