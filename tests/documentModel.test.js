import { describe, expect, it } from 'vitest'
import { documentEnvelope, normalizeDocumentHtml } from '../src/editor/documentModel'

describe('structured document migration', () => {
  it('preserves a saved manual page break as a semantic node', () => {
    const html = normalizeDocumentHtml('<p>Page one</p><div class="pg-break" data-page-break="true"><span>old label</span></div><p>Page two</p>')
    expect(html).toContain('<div class="page-break" data-page-break="true"></div>')
    expect(html).toContain('<p>Page one</p>')
    expect(html).toContain('<p>Page two</p>')
  })

  it('adds a caret paragraph after a trailing page break', () => {
    const html = normalizeDocumentHtml('<p>End</p><div data-page-break="true"></div>')
    expect(html).toMatch(/data-page-break="true"><\/div><p><br><\/p>$/)
  })

  it('removes executable content while migrating legacy documents', () => {
    const result = documentEnvelope('<p onclick="bad()">Safe</p><script>bad()</script>')
    expect(result.version).toBe(1)
    expect(result.html).toBe('<p>Safe</p>')
  })
})
