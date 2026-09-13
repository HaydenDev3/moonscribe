// CSP-safe application bootstrap. Keep this file same-origin so production can
// retain a strict script-src policy without inline exceptions.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  if ('serviceWorker' in navigator) {
    const reloadKey = 'moonscribe:localhost-worker-reset-v2'
    const shouldReload = !sessionStorage.getItem(reloadKey)
    navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      const hadWorker = registrations.length > 0 || !!navigator.serviceWorker.controller
      await Promise.all(registrations.map((registration) => registration.unregister()))
      if (shouldReload && hadWorker) {
        sessionStorage.setItem(reloadKey, '1')
        location.reload()
      }
    })
  }
  if ('caches' in window) caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
}

if (!/^tauri:$/i.test(window.location.protocol) && !/tauri\.localhost$/i.test(window.location.hostname)) {
  const ads = document.createElement('script')
  ads.async = true
  ads.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7279660074920894'
  ads.crossOrigin = 'anonymous'
  document.head.appendChild(ads)
}
