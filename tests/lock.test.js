// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { makeLock, verifyLock } from '../src/db/lock'

describe('lock verifier', () => {
  it('verifies the correct passphrase and rejects wrong ones', async () => {
    const lock = await makeLock('a quiet tide', 'passphrase')
    expect(lock.kind).toBe('passphrase')
    expect(lock.verifier).toBeTruthy()
    expect(await verifyLock(lock, 'a quiet tide')).toBe(true)
    expect(await verifyLock(lock, 'wrong')).toBe(false)
  })

  it('works for a numeric PIN', async () => {
    const lock = await makeLock('2468', 'pin')
    expect(lock.kind).toBe('pin')
    expect(await verifyLock(lock, '2468')).toBe(true)
    expect(await verifyLock(lock, '1357')).toBe(false)
  })

  it('never stores the passphrase in the clear', async () => {
    const lock = await makeLock('storm-and-moonlight')
    expect(JSON.stringify(lock)).not.toContain('storm-and-moonlight')
  })

  it('requires a passphrase and fails closed on bad input', async () => {
    await expect(makeLock('')).rejects.toThrow(/passphrase/i)
    expect(await verifyLock(null, 'x')).toBe(false)
    expect(await verifyLock({ verifier: null }, 'x')).toBe(false)
  })
})
