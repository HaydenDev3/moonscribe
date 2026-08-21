import { describe, it, expect } from 'vitest'
import { rtfToText, rtfToChapters } from '../src/utils/importRtf'

const SAMPLE = String.raw`{\rtf1\ansi\deff0 {\fonttbl{\f0 Times New Roman;}}
{\colortbl;\red0\green0\blue0;}
\f0\fs24 Chapter One\par
The morning was quiet.\par
She opened the letter at last.\par
\page
Chapter Two\par
Rain \'91again\'92 \emdash always rain.\par
}`

describe('rtfToText', () => {
  it('returns null for non-RTF input', () => {
    expect(rtfToText('just some plain text')).toBeNull()
  })

  it('strips control layer and font/color tables, keeping prose', () => {
    const t = rtfToText(SAMPLE)
    expect(t).not.toBeNull()
    expect(t).toContain('The morning was quiet.')
    expect(t).not.toContain('Times New Roman')
    expect(t).not.toContain('fonttbl')
  })

  it('decodes windows-1252 smart quotes and control-word dashes', () => {
    const t = rtfToText(SAMPLE)
    expect(t).toContain('‘again’')
    expect(t).toContain('—')
  })
})

describe('rtfToChapters', () => {
  it('splits on headings and page breaks into chapters', () => {
    const chs = rtfToChapters(SAMPLE)
    expect(chs).toHaveLength(2)
    expect(chs[0].title).toBe('Chapter One')
    expect(chs[1].title).toBe('Chapter Two')
    expect(chs[0].content).toContain('<p>The morning was quiet.</p>')
    expect(chs[1].content).toContain('always rain')
  })

  it('returns null for non-RTF', () => {
    expect(rtfToChapters('# Not RTF')).toBeNull()
  })

  it('handles a manuscript with no headings as a single imported chapter', () => {
    const rtf = String.raw`{\rtf1\ansi The wind rose over the bay.\par It did not stop.\par}`
    const chs = rtfToChapters(rtf)
    expect(chs).toHaveLength(1)
    expect(chs[0].content).toContain('The wind rose over the bay.')
  })
})
