import { describe, expect, it } from 'vitest'
import { sentenceDiff, sentences } from '../src/utils/sentenceDiff'

describe('sentence-level comparison', () => {
  it('segments prose without losing punctuation', () => {
    expect(sentences('One sentence. Another one!')).toEqual(['One sentence.', 'Another one!'])
  })

  it('marks inserted and removed sentences while preserving shared context', () => {
    const result = sentenceDiff('The door opened. Mira waited.', 'The door opened. Rowan entered. Mira waited.')
    expect(result).toEqual([
      { type: 'same', text: 'The door opened.' },
      { type: 'added', text: 'Rowan entered.' },
      { type: 'same', text: 'Mira waited.' },
    ])
  })
})
