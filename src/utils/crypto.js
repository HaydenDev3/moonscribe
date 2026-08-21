// Passphrase encryption for backups. Uses the Web Crypto API: a key derived
// from the passphrase with PBKDF2 (SHA-256), then AES-GCM for authenticated
// encryption. Nothing is stored — the passphrase never leaves the device and
// there is no recovery, so a lost passphrase means a lost file.
const enc = new TextEncoder()
const dec = new TextDecoder()
// New backups use a stronger cost. Decryption reads the envelope's version so
// existing v1 (150k) backups remain recoverable.
const ITERATIONS = 600000
const LEGACY_ITERATIONS = 150000

function subtle() {
  const c = globalThis.crypto
  if (!c || !c.subtle) throw new Error('Encryption is not available in this browser')
  return c
}

function toB64(buf) {
  const b = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s)
}

function fromB64(str) {
  const s = atob(str)
  const b = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i)
  return b
}

async function deriveKey(passphrase, salt, iterations = ITERATIONS) {
  const c = subtle()
  const base = await c.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return c.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export function isEncryptedBackup(obj) {
  return !!obj && obj.app === 'moonscribe-encrypted'
}

export async function encryptJSON(obj, passphrase) {
  if (!passphrase || !passphrase.trim()) throw new Error('A passphrase is required')
  const c = subtle()
  const salt = c.getRandomValues(new Uint8Array(16))
  const iv = c.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const ct = await c.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)))
  return {
    app: 'moonscribe-encrypted',
    v: 2,
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: toB64(salt),
    iv: toB64(iv),
    ct: toB64(ct)
  }
}

export async function decryptJSON(envelope, passphrase) {
  if (!isEncryptedBackup(envelope)) throw new Error('Not an encrypted MoonScribe backup')
  const c = subtle()
  const iterations = Number(envelope.iterations || (envelope.v === 1 ? LEGACY_ITERATIONS : 0))
  if (!Number.isInteger(iterations) || iterations < LEGACY_ITERATIONS || iterations > 1_000_000) {
    throw new Error('This backup uses an unsupported encryption setting')
  }
  const key = await deriveKey(passphrase, fromB64(envelope.salt), iterations)
  let plain
  try {
    plain = await c.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(envelope.iv) }, key, fromB64(envelope.ct))
  } catch {
    throw new Error('Wrong passphrase — could not unlock this backup')
  }
  return JSON.parse(dec.decode(plain))
}
