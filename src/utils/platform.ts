export type MoonScribePlatform = 'windows' | 'macos' | 'linux' | 'mobile' | 'unknown'

export function isTabletRuntime(userAgent = '', maxTouchPoints = 0, width = 0, height = 0) {
  const ua = userAgent.toLowerCase()
  const largeTouchViewport = maxTouchPoints > 0 && Math.max(width, height) >= 600
  return /ipad|tablet|android(?!.*mobile)/.test(ua) || largeTouchViewport
}

export function detectPlatform(userAgent = '', platform = '', maxTouchPoints = 0): MoonScribePlatform {
  const ua = userAgent.toLowerCase()
  const os = platform.toLowerCase()
  const ipadDesktopMode = os.includes('mac') && maxTouchPoints > 1
  if (ipadDesktopMode || /ipad|iphone|ipod|android|mobile/.test(ua)) return 'mobile'
  if (/windows|win32|win64/.test(`${ua} ${os}`)) return 'windows'
  if (/macintosh|mac os|macintel|macarm/.test(`${ua} ${os}`)) return 'macos'
  if (/linux|x11/.test(`${ua} ${os}`)) return 'linux'
  return 'unknown'
}

export function platformDownload(platform: MoonScribePlatform, env: Record<string, string | undefined>) {
  const urls: Partial<Record<MoonScribePlatform, string>> = {
    windows: env.VITE_DOWNLOAD_WINDOWS_URL || '/downloads/MoonScribe_0.1.0_x64-setup.exe',
    macos: env.VITE_DOWNLOAD_MACOS_URL,
    linux: env.VITE_DOWNLOAD_LINUX_URL,
  }
  return urls[platform] || ''
}

export function platformLabel(platform: MoonScribePlatform) {
  if (platform === 'windows') return 'Windows'
  if (platform === 'macos') return 'macOS'
  if (platform === 'linux') return 'Linux'
  return 'desktop'
}
