// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { encryptJSON, decryptJSON, isEncryptedBackup } from '../src/utils/crypto'

describe('backup encryption', () => {
  it('round-trips an object through encrypt/decrypt', async () => {
    const data = { app: 'moonscribe', novels: [{ id: 'n1', title: 'The Quiet Tide' }] }
    const env = await encryptJSON(data, 'moonlight over storm')
    expect(isEncryptedBackup(env)).toBe(true)
    expect(env.ct).toBeTruthy()
    expect(JSON.stringify(env)).not.toContain('Quiet Tide') // ciphertext, not plaintext
    const back = await decryptJSON(env, 'moonlight over storm')
    expect(back).toEqual(data)
  })

  it('rejects a wrong passphrase', async () => {
    const env = await encryptJSON({ a: 1 }, 'right')
    await expect(decryptJSON(env, 'wrong')).rejects.toThrow(/passphrase/i)
  })

  it('requires a passphrase to encrypt', async () => {
    await expect(encryptJSON({ a: 1 }, '')).rejects.toThrow(/passphrase/i)
  })

  it('refuses to decrypt a non-envelope', async () => {
    await expect(decryptJSON({ app: 'moonscribe' }, 'x')).rejects.toThrow(/encrypted/i)
  })
})
