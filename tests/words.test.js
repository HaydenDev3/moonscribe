import { describe, it, expect } from 'vitest'
import { countWords, countWordsFromText, formatWords } from '../src/utils/words'

describe('countWords', () => {
  it('counts plain text', () => {
    expect(countWords('<p>Hello world</p>')).toBe(2)
  })
  it('ignores tags and scene breaks', () => {
    const html = '<p>One <b>two</b> three</p><div class="scene-break">❦</div><p>Four.</p>'
    expect(countWords(html)).toBe(4)
  })
  it('returns 0 for empty', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('<p><br></p>')).toBe(0)
  })
  it('handles nbsp', () => {
    expect(countWords('<p>soft&nbsp;morning</p>')).toBe(2)
  })
})

describe('countWordsFromText', () => {
  it('counts from raw text', () => {
    expect(countWordsFromText('  the  quiet   moon ')).toBe(3)
  })
})

describe('formatWords', () => {
  it('formats with commas', () => {
    expect(formatWords(1204)).toBe('1,204')
    expect(formatWords(0)).toBe('0')
  })
})
