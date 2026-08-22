import { describe, expect, it } from 'vitest'
import { apiBaseUrl, authReturnUrl, isDesktopRuntime } from '../src/api/config'

describe('shared cloud API configuration', () => {
  it('uses same-origin for the web client', () => {
    expect(apiBaseUrl({}, { protocol: 'https:', origin: 'https://app.moonscribe.cc' })).toBe('https://app.moonscribe.cc')
  })

  it('uses MoonScribe Cloud for a packaged desktop without configuration', () => {
    const desktop = { protocol: 'tauri:', origin: 'tauri://localhost' }
    expect(isDesktopRuntime(desktop)).toBe(true)
    expect(apiBaseUrl({}, desktop)).toBe('https://moonscribe.cc')
    expect(authReturnUrl({}, desktop)).toBe('moonscribe://auth/callback')
  })

  it('allows an explicit staging API without exposing a secret', () => {
    expect(apiBaseUrl({ VITE_API_URL: 'https://staging-api.moonscribe.cc/' }, { protocol: 'tauri:' })).toBe('https://staging-api.moonscribe.cc')
  })
})
