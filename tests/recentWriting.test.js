import { describe, it, expect, beforeEach } from 'vitest'
import { clearRecentWriting, readRecentWriting, saveRecentWriting } from '../src/utils/recentWriting'

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
}

beforeEach(() => { clearRecentWriting() })

describe('recent writing context', () => {
  it('round trips the last chapter and scroll position', () => {
    saveRecentWriting({ novelId: 'n1', chapterId: 'c1', mode: 'write', scrollTop: 240 })
    expect(readRecentWriting()).toMatchObject({ novelId: 'n1', chapterId: 'c1', mode: 'write', scrollTop: 240 })
  })

  it('ignores incomplete contexts and can clear safely', () => {
    saveRecentWriting({ novelId: 'n1' })
    expect(readRecentWriting()).toBeNull()
    saveRecentWriting({ novelId: 'n1', chapterId: 'c1' })
    clearRecentWriting()
    expect(readRecentWriting()).toBeNull()
  })
})
