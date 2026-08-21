import { describe, expect, it } from 'vitest'
import { inviteCode } from '../src/sync/engine'

describe('share invitation input', () => {
  it('accepts a raw invitation code', () => {
    expect(inviteCode('  moon-code  ')).toBe('moon-code')
  })

  it('extracts the code from a shared dashboard link', () => {
    expect(inviteCode('https://moonscribe.example/dashboard?share=moon-code')).toBe('moon-code')
  })
})
