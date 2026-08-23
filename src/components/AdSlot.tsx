import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

export default function AdSlot({ placement = 'secondary' }: { placement?: string }) {
  const pushed = useRef(false)

  useEffect(() => {
    if (pushed.current) return
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
      pushed.current = true
    } catch {
      // The AdSense loader may still be settling; the slot can retry on reload.
    }
  }, [])

  return (
    <aside className={`adsense-slot adsense-slot-${placement}`} aria-label="Advertisement">
      <span className="adsense-slot-label">Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-7279660074920894"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  )
}
