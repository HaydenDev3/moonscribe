export type OAuthProvider = 'google' | 'discord'

export type OAuthCallback = {
  provider: OAuthProvider | null
  exchangeCode: string | null
  error: string | null
  linked: boolean
}

const CODE_PATTERN = /^[A-Za-z0-9_-]{16,256}$/

export function readOAuthCallback(search: string): OAuthCallback {
  const params = new URLSearchParams(search)
  const discordCode = params.get('discord_exchange')
  const oauthCode = params.get('oauth_exchange')
  const providerParam = params.get('provider')
  const provider: OAuthProvider | null = providerParam === 'google'
    ? 'google'
    : discordCode
      ? 'discord'
      : null
  const candidate = oauthCode || discordCode
  const exchangeCode = candidate && CODE_PATTERN.test(candidate) ? candidate : null
  const error = params.get('discord_error') || params.get('oauth_error')
  return { provider, exchangeCode, error, linked: params.get('linked') === '1' }
}

export function clearOAuthCallback(location: globalThis.Location) {
  const hash = location.hash
  const cleanHash = hash.includes('?') ? hash.slice(0, hash.indexOf('?')) : hash
  window.history.replaceState({}, '', `${location.pathname}${cleanHash}`)
}
