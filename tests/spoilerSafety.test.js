import { describe, expect, it } from 'vitest'
import { isAnchorVisible, paragraphAnchor, revealHtmlThroughAnchor } from '../src/utils/spoilerSafety'

describe('spoiler-safe beta reader reveal', () => {
  it('reveals only the current chapter through the marker buffer', () => {
    const html = '<p>One</p><p>Two</p><p>Three</p><p>Four</p>'
    expect(revealHtmlThroughAnchor(html, { furthestPosition: 1 })).toBe('<p>One</p>\n<p>Two</p>\n<p>Three</p>')
  })

  it('uses stable text-derived paragraph anchors and a one-block buffer', () => {
    const anchor = paragraphAnchor(2, '<p>Two</p>')
    expect(anchor).toMatch(/^p-2-/)
    expect(isAnchorVisible({ furthestPosition: 2 }, 3)).toBe(true)
    expect(isAnchorVisible({ furthestPosition: 2 }, 4)).toBe(false)
  })
})
