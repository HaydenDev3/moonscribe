import { beforeEach, describe, expect, it } from 'vitest'
import { detectPlatform, platformDownload } from '../src/utils/platform'
import { clearNativeMirrorFailure, pendingNativeMirrorFailures, queueNativeMirrorFailure } from '../src/platform/nativeStorage'

beforeEach(() => {
  const values = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] || null,
    get length() { return values.size }
  } as any
})

describe('desktop download platform detection', () => {
  it('detects Windows desktop', () => {
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32')).toBe('windows')
  })

  it('keeps iPad desktop mode on Cloud', () => {
    expect(detectPlatform('Mozilla/5.0 (Macintosh)', 'MacIntel', 5)).toBe('mobile')
  })

  it('keeps Android on Cloud even though its UA includes Linux', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 15; Pixel)', 'Linux armv8l')).toBe('mobile')
  })

  it('does not invent unavailable macOS or Linux downloads', () => {
    expect(platformDownload('macos', {})).toBe('')
    expect(platformDownload('linux', {})).toBe('')
  })

  it('deduplicates native retries and acknowledges recovered records', () => {
    queueNativeMirrorFailure({ kind: 'put', store: 'chapters', id: 'c1', payload: { id: 'c1', title: 'Old' }, updatedAt: 1 })
    queueNativeMirrorFailure({ kind: 'put', store: 'chapters', id: 'c1', payload: { id: 'c1', title: 'New' }, updatedAt: 2 })
    queueNativeMirrorFailure({ kind: 'delete', store: 'notes', id: 'n1', updatedAt: 3 })
    expect(pendingNativeMirrorFailures()).toBe(2)
    clearNativeMirrorFailure('chapters', 'c1')
    expect(pendingNativeMirrorFailures()).toBe(1)
    clearNativeMirrorFailure('notes', 'n1')
    expect(pendingNativeMirrorFailures()).toBe(0)
  })
})
