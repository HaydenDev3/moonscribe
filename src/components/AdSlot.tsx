import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { isDesktopRuntime } from '../api/config'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

export default function AdSlot({ placement = 'secondary' }: { placement?: string }) {
  const { syncUsername } = useApp()
  const desktop = isDesktopRuntime()
  const pushed = useRef(false)
  const [providerReady, setProviderReady] = useState(false)
  const adsEnabled = !import.meta.env.DEV && String(import.meta.env.VITE_ADS_ENABLED || 'true').toLowerCase() !== 'false'
  const configured = String(import.meta.env.VITE_AD_FREE_USERNAMES || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
  const adFree = [...configured, 'storm', 'storm tattersall'].includes(String(syncUsername || '').trim().toLowerCase())

  useEffect(() => {
    if (desktop || adFree || !adsEnabled) return
    if (pushed.current) return
    const timer = window.setTimeout(() => setProviderReady(false), 3500)
    const markReady = () => { setProviderReady(true); window.clearTimeout(timer) }
    const script = document.querySelector('script[src*="adsbygoogle.js"]')
    script?.addEventListener('load', markReady, { once: true })
    if (window.adsbygoogle) markReady()
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
      pushed.current = true
    } catch {
      // The AdSense loader may still be settling; the slot can retry on reload.
    }
    return () => { window.clearTimeout(timer); script?.removeEventListener('load', markReady) }
  }, [adFree, adsEnabled, desktop])

  if (desktop || adFree || !adsEnabled || !providerReady) return null

  return (
    <aside className={`adsense-slot adsense-slot-${placement}`} aria-label="Advertisement">
      <span className="adsense-slot-label">Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-7279660074920894"
        data-ad-slot={import.meta.env.VITE_AD_SLOT || undefined}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  )
}
