import { describe, expect, it } from 'vitest'
import { canExportSharedNovel, canOpenBetaChapter, canSeeAnnotation } from '../src/utils/collaborationAccess'

describe('collaboration privacy boundaries', () => {
  const betaNovel = { sharedRole: 'beta-reader' }
  it('blocks beta-reader exports and unrevealed chapter navigation', () => {
    expect(canExportSharedNovel(betaNovel)).toBe(false)
    expect(canOpenBetaChapter(betaNovel, 'later', ['current'])).toBe(false)
    expect(canOpenBetaChapter(betaNovel, 'current', ['current'])).toBe(true)
  })

  it('hides team feedback from beta readers while keeping it visible to the team', () => {
    expect(canSeeAnnotation(betaNovel, { visibility: 'team' })).toBe(false)
    expect(canSeeAnnotation({ sharedRole: 'editor' }, { visibility: 'team' })).toBe(true)
  })
})
