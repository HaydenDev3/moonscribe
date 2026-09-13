import { describe, expect, it, beforeEach } from 'vitest'
import { authProviderLabel, readLastAuthProvider, saveLastAuthProvider } from '../src/utils/authPreference'

describe('auth preference', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      clear: () => values.clear(),
    } })
  })

  it('stores only valid providers and returns their human label', () => {
    saveLastAuthProvider('discord')
    expect(readLastAuthProvider()).toBe('discord')
    expect(authProviderLabel('discord')).toBe('Discord')
  })

  it('ignores invalid providers', () => {
    saveLastAuthProvider('not-a-provider')
    localStorage.setItem('moonscribe:last-auth-provider', 'not-a-provider')
    expect(readLastAuthProvider()).toBeNull()
  })
})
