import { describe, expect, it } from 'vitest'
import { desktopAuthSearch } from '../src/api/desktopAuth'

describe('desktop OAuth links', () => {
  it('accepts the exact MoonScribe callback and one-use exchange code', () => {
    const code = 'a'.repeat(24)
    expect(desktopAuthSearch(`moonscribe://auth/callback?oauth_exchange=${code}&provider=google`))
      .toBe(`oauth_exchange=${code}&provider=google`)
  })

  it('rejects wrong schemes, paths, and malformed codes', () => {
    expect(desktopAuthSearch('https://evil.example/callback?oauth_exchange=abc')).toBeNull()
    expect(desktopAuthSearch('moonscribe://auth/other?oauth_exchange=' + 'a'.repeat(24))).toBeNull()
    expect(desktopAuthSearch('moonscribe://auth/callback?oauth_exchange=../../token')).toBeNull()
  })
})
