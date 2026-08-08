import { describe, it, expect } from 'vitest'
import { tidyHtml, sanitizePaste, composeMergedContent } from '../src/utils/formatHtml'

describe('tidyHtml', () => {
  it('collapses blank paragraph runs down to a single break', () => {
    const { html, stats } = tidyHtml('<p>One</p><p><br></p><p><br></p><p><br></p><p>Two</p>')
    expect(html).toContain('<p>One</p>')
    expect(html).toContain('<p>Two</p>')
    expect((html.match(/<p><br><\/p>/g) || []).length).toBe(1)
    expect(stats.blankLines).toBeGreaterThan(0)
  })

  it('converts a line of asterisks or flosks into a real scene break', () => {
    const a = tidyHtml('<p>One</p><p>***</p><p>Two</p>')
    expect(a.html).toContain('class="scene-break"')
    expect(a.stats.sceneBreaks).toBe(1)
    const b = tidyHtml('<p>One</p><p>❦ ❦ ❦</p><p>Two</p>')
    expect(b.html).toContain('class="scene-break"')
  })

  it('detects short heading-like lines and lifts them to h2', () => {
    const { html, stats } = tidyHtml('<p>Chapter 5</p><p>She opened the door.</p>')
    expect(html).toContain('<h2>Chapter 5</h2>')
    expect(stats.headings).toBe(1)
  })

  it('strips inline styles, Word classes and font tags', () => {
    const { html, stats } = tidyHtml('<p style="color:red" class="MsoNormal"><font face="Calibri"><b>Hi</b></font></p>')
    expect(html).not.toContain('style=')
    expect(html).not.toContain('MsoNormal')
    expect(html).not.toContain('font')
    expect(html).toContain('<b>Hi</b>')
    expect(stats.unwrapped).toBeGreaterThan(0)
  })

  it('normalises nbsp and double spaces', () => {
    const { html } = tidyHtml('<p>Hello&nbsp;&nbsp;world  there</p>')
    expect(html).toContain('Hello world there')
    expect(html).not.toContain('\u00a0')
  })

  it('keeps existing scene breaks intact', () => {
    const { html } = tidyHtml('<p>One</p><div class="scene-break" contenteditable="false" data-scene-break="true">❦</div><p>Two</p>')
    expect(html).toContain('scene-break')
  })
})

describe('sanitizePaste', () => {
  it('keeps lists, quotes, headings, bold and links; drops everything else', () => {
    const out = sanitizePaste('<div class="MsoNormal"><h2>Title</h2><p><span style="color:red">Hi <b>Storm</b></span></p><ul><li>One</li></ul><blockquote>Quoted</blockquote><img src="x"><p>Plain</p></div>')
    expect(out).toContain('<h2>Title</h2>')
    expect(out).toContain('<b>Storm</b>')
    expect(out).toContain('<ul><li>One</li></ul>')
    expect(out).toContain('<blockquote>Quoted</blockquote>')
    expect(out).not.toContain('img')
    expect(out).not.toContain('MsoNormal')
    expect(out).not.toContain('color:red')
  })

  it('converts plain text into paragraphs', () => {
    const out = sanitizePaste('First line\nsame para\n\nSecond paragraph')
    expect(out).toContain('<p>First line<br>same para</p>')
    expect(out).toContain('<p>Second paragraph</p>')
  })
})

describe('composeMergedContent', () => {
  it('joins with a scene break and trims the seam', () => {
    const { html } = composeMergedContent('<p>A.</p><p><br></p>', '<p><br></p><p>B.</p>', 'scene-break')
    expect(html).toContain('A.')
    expect(html).toContain('B.')
    expect(html).toContain('scene-break')
    expect(html).toMatch(/<\/p>\s*<div class="scene-break"/)
  })

  it('joins with a single space separator', () => {
    const { html } = composeMergedContent('<p>A.</p>', '<p>B.</p>', 'space')
    expect(html).toContain('A.')
    expect(html).toContain('B.')
    expect(html).not.toContain('scene-break')
    expect(html).toContain('<p><br></p>')
  })

  it('reports a word count for the merged text', () => {
    const { words } = composeMergedContent('<p>One two three.</p>', '<p>Four five.</p>', 'space')
    expect(words).toBe(5)
  })
})
