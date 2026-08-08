import { describe, it, expect } from 'vitest'
import { mentionsInHtml, autoChapterMentions } from '../src/utils/mentions'

describe('mentionsInHtml', () => {
  it('finds a name only as a whole word', () => {
    const names = ['Storm', 'Ann']
    expect(mentionsInHtml('<p>Storm walked in.</p>', names)).toEqual(['Storm'])
    expect(mentionsInHtml('<p>Annette came home.</p>', names)).toEqual([])
    expect(mentionsInHtml('<p>Storm and Annette talked.</p>', names)).toEqual(['Storm'])
  })

  it('matches multi-word names', () => {
    expect(mentionsInHtml('<p>Captain Lena arrived.</p>', ['Captain Lena'])).toEqual(['Captain Lena'])
  })

  it('ignores scene-break ornaments and headings without names', () => {
    expect(mentionsInHtml('<h2>Chapter One</h2><div class="scene-break">❦</div><p>Quiet.</p>', ['Lena'])).toEqual([])
  })
})

describe('autoChapterMentions', () => {
  it('maps characters to the chapters that mention them', () => {
    const chapters = [
      { id: 'c1', content: '<p>Storm met Lena.</p>' },
      { id: 'c2', content: '<p>Storm was alone.</p>' },
      { id: 'c3', content: '<p>Nobody home.</p>' }
    ]
    const characters = [
      { id: 'storm', name: 'Storm', chapterIds: [] },
      { id: 'lena', name: 'Lena', chapterIds: [] }
    ]
    const map = autoChapterMentions(chapters, characters)
    expect(map.storm.sort()).toEqual(['c1', 'c2'])
    expect(map.lena).toEqual(['c1'])
  })

  it('keeps hand-pinned chapters even if the name is absent from the text', () => {
    const chapters = [{ id: 'c1', content: '<p>Silence.</p>' }]
    const characters = [{ id: 'k', name: 'Kade', chapterIds: ['c1'] }]
    expect(autoChapterMentions(chapters, characters).k).toEqual(['c1'])
  })
})
