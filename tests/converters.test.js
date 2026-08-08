import { describe, it, expect } from 'vitest'
import { htmlToMarkdown } from '../src/utils/htmlToMarkdown'
import { htmlToText } from '../src/utils/htmlToText'
import { highlightNames } from '../src/utils/highlight'

describe('htmlToMarkdown', () => {
  it('converts headings, bold, italic', () => {
    const md = htmlToMarkdown('<h2>Chapter One</h2><p><b>Storm</b> and <i>the moon</i>.</p>')
    expect(md).toContain('## Chapter One')
    expect(md).toContain('**Storm**')
    expect(md).toContain('*the moon*')
  })
  it('keeps scene breaks as ***', () => {
    const md = htmlToMarkdown('<p>A</p><div class="scene-break">❦</div><p>B</p>')
    expect(md).toContain('***')
  })
  it('handles blockquotes', () => {
    const md = htmlToMarkdown('<blockquote><p>A whispered line</p></blockquote>')
    expect(md).toContain('> A whispered line')
  })
  it('returns empty for empty input', () => {
    expect(htmlToMarkdown('')).toBe('')
  })
})

describe('htmlToText', () => {
  it('strips formatting but keeps text', () => {
    const t = htmlToText('<h2>One</h2><p><b>Two</b> three</p>')
    expect(t).toContain('One')
    expect(t).toContain('Two three')
    expect(t).not.toContain('<b>')
  })
  it('keeps scene breaks', () => {
    const t = htmlToText('<p>A</p><div class="scene-break">❦</div><p>B</p>')
    expect(t).toContain('❦')
  })
})

describe('highlightNames', () => {
  it('wraps names in soft underline spans with their colour', () => {
    const out = highlightNames('<p>Storm walked into the moonlit room.</p>', [{ name: 'Storm', color: '#D4A5A5' }])
    expect(out).toContain('hl-name')
    expect(out).toContain('#D4A5A5')
    expect(out).toContain('>Storm<')
    expect(out).toContain('walked into the moonlit room')
  })
  it('does not match names inside other words', () => {
    const out = highlightNames('<p>Stormlight is a word.</p>', [{ name: 'Storm', color: '#D4A5A5' }])
    expect(out).not.toContain('hl-name')
  })
  it('returns html unchanged when no characters', () => {
    expect(highlightNames('<p>x</p>', [])).toBe('<p>x</p>')
  })
})
