import { describe, expect, it } from 'vitest'
import { DESIGN_SCHEMA_VERSION, DESIGN_THEME_PRESETS, makeDesignSnapshot, normalizeDesignProfile, normalizeDesignTheme } from '../src/utils/designerModel'

describe('designer metadata', () => {
  it('normalizes versioned themes and profiles without touching manuscript content', () => {
    expect(normalizeDesignTheme({ preset: 'literary' })).toMatchObject({ version: DESIGN_SCHEMA_VERSION, preset: 'literary' })
    expect(normalizeDesignProfile({ target: 'epub' })).toMatchObject({ version: DESIGN_SCHEMA_VERSION, target: 'epub' })
  })

  it('ships the guided theme presets', () => {
    expect(DESIGN_THEME_PRESETS.map((preset) => preset.id)).toEqual(expect.arrayContaining(['literary', 'dark-fantasy', 'romance', 'minimal', 'classic', 'contemporary']))
  })

  it('creates a design-only snapshot', () => {
    const snapshot = makeDesignSnapshot({ layout: { pageSize: 'a5' }, designTheme: { preset: 'classic' }, designProfile: { target: 'print-pdf' } }, 'Before theme')
    expect(snapshot).toMatchObject({ label: 'Before theme', version: DESIGN_SCHEMA_VERSION, layout: { pageSize: 'a5' }, designTheme: { preset: 'classic' } })
    expect(snapshot).not.toHaveProperty('content')
  })
})
