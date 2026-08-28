import { isDesktopRuntime } from './config'

const EXCHANGE_CODE = /^[A-Za-z0-9_-]{20,256}$/

export function callbackSearch(locationLike: Pick<Location, 'search' | 'hash'>, desktop = isDesktopRuntime()) {
  if (desktop && locationLike.hash.includes('?')) return locationLike.hash.slice(locationLike.hash.indexOf('?'))
  return locationLike.search || ''
}

export function desktopAuthSearch(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'moonscribe:' || url.hostname !== 'auth' || url.pathname !== '/callback') return null
    const output = new URLSearchParams()
    for (const key of ['discord_exchange', 'oauth_exchange'] as const) {
      const value = url.searchParams.get(key)
      if (value && EXCHANGE_CODE.test(value)) output.set(key, value)
    }
    const magicToken = url.searchParams.get('magic_token')
    if (magicToken && /^[A-Za-z0-9_-]{32,128}$/.test(magicToken)) output.set('magic_token', magicToken)
    const provider = url.searchParams.get('provider')
    if (provider === 'google' || provider === 'discord') output.set('provider', provider)
    for (const key of ['discord_error', 'oauth_error'] as const) {
      const value = url.searchParams.get(key)
      if (value && /^[a-z0-9_-]{1,80}$/i.test(value)) output.set(key, value)
    }
    return output.size > 0 ? output.toString() : null
  } catch {
    return null
  }
}

export async function registerDesktopAuthLinks() {
  if (!isDesktopRuntime()) return
  const { getCurrent, onOpenUrl } = await import('@tauri-apps/plugin-deep-link')
  const { listen } = await import('@tauri-apps/api/event')
  const accept = (urls: string[] | string) => {
    const candidates = Array.isArray(urls) ? urls : [urls]
    for (const rawUrl of urls) {
      const search = desktopAuthSearch(rawUrl)
      if (search) {
        // Desktop uses HashRouter; keeping the callback in the hash ensures
        // both the route and the one-time exchange query survive the reload.
        window.location.replace(`${window.location.origin}/#/dashboard?${search}`)
        return
      }
    }
  }
  await onOpenUrl(accept)
  // The single-instance plugin receives a second launch's URI before the
  // deep-link plugin can deliver it. Forward that URI through the same path.
  await listen<string[]>('moonscribe://auth-callback', (event) => accept(event.payload))
  accept((await getCurrent()) || [])
}

export async function openExternalUrl(url: string) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' && !(import.meta.env.DEV && parsed.protocol === 'http:')) {
    throw new Error('MoonScribe blocked an unsafe external link.')
  }
  if (isDesktopRuntime()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(parsed.toString())
    return
  }
  window.open(parsed.toString(), '_blank', 'noopener,noreferrer')
}
