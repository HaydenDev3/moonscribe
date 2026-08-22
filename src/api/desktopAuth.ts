import { isDesktopRuntime } from './config'

const EXCHANGE_CODE = /^[A-Za-z0-9_-]{20,256}$/

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
  const accept = (urls: string[]) => {
    for (const rawUrl of urls) {
      const search = desktopAuthSearch(rawUrl)
      if (search) {
        window.location.replace(`/dashboard?${search}`)
        return
      }
    }
  }
  await onOpenUrl(accept)
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
