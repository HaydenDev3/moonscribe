import { describe, expect, it } from 'vitest'
import { defaultAuthorWebsite, normalizeAuthorWebsite, safeWebsiteUrl } from '../src/websites/model'

describe('author website model', () => {
  it('migrates older drafts into the complete v2 shape', () => {
    const site = normalizeAuthorWebsite({ authorName: 'Lyra', theme: 'midnight' } as never)
    expect(site.version).toBe(2)
    expect(site.authorName).toBe('Lyra')
    expect(site.heroEyebrow).toContain('AUTHOR')
    expect(site.interests.length).toBeGreaterThan(0)
  })

  it('starts private and never includes manuscript content', () => {
    const site = defaultAuthorWebsite('Lyra')
    expect(site.published).toBe(false)
    expect(site.books).toEqual([])
    expect(site).not.toHaveProperty('chapters')
  })

  it('accepts only safe public link protocols and local paths', () => {
    expect(safeWebsiteUrl('https://example.com')).toContain('https://example.com')
    expect(safeWebsiteUrl('mailto:author@example.com')).toBe('mailto:author@example.com')
    expect(safeWebsiteUrl('/privacy')).toBe('/privacy')
    expect(safeWebsiteUrl('javascript:alert(1)')).toBe('')
  })
})
