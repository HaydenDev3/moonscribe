import { encryptJSON, decryptJSON } from '../utils/crypto'

// Passphrase/PIN gating. We never store the passphrase — instead we store a
// "verifier": a known token encrypted under the passphrase. Entering the right
// passphrase decrypts it back to the token; anything else fails the AES-GCM
// authentication tag. Same primitive backs the app lock and per-novel locks.
const TOKEN = 'moonscribe-lock-ok'

// Create a verifier envelope for a passphrase. `kind` ('pin' | 'passphrase')
// is stored only so the UI can show the right keypad; it is not a secret.
export async function makeLock(passphrase, kind = 'passphrase') {
  if (!passphrase || !passphrase.trim()) throw new Error('A passphrase is required')
  const verifier = await encryptJSON({ t: TOKEN }, passphrase)
  return { verifier, kind, createdAt: Date.now() }
}

// True when `passphrase` matches the one the lock was created with.
export async function verifyLock(lock, passphrase) {
  if (!lock?.verifier || !passphrase) return false
  try {
    const r = await decryptJSON(lock.verifier, passphrase)
    return r?.t === TOKEN
  } catch {
    return false
  }
}
