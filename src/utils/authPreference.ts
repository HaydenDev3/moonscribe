export type AuthProvider = 'discord' | 'google' | 'passkey' | 'magic' | 'email' | 'password'

const KEY = 'moonscribe:last-auth-provider'
const VALID = new Set<AuthProvider>(['discord', 'google', 'passkey', 'magic', 'email', 'password'])

export function readLastAuthProvider(): AuthProvider | null {
  try {
    const value = localStorage.getItem(KEY)
    return VALID.has(value as AuthProvider) ? value as AuthProvider : null
  } catch { return null }
}

export function saveLastAuthProvider(provider: unknown) {
  if (!VALID.has(provider as AuthProvider)) return
  try { localStorage.setItem(KEY, provider as string) } catch { /* best effort */ }
}

export function authProviderLabel(provider: AuthProvider | null) {
  if (provider === 'discord') return 'Discord'
  if (provider === 'google') return 'Google'
  if (provider === 'passkey') return 'Passkey'
  if (provider === 'magic' || provider === 'email') return 'Email'
  if (provider === 'password') return 'Password'
  return ''
}
