import { describe, expect, it } from 'vitest'
import { detectPlatform, platformDownload } from '../src/utils/platform'

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
})
