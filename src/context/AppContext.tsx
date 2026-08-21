// Global app context: novels list, settings, focus mode, toasts, sync.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { listNovels } from '../db/novels'
import { getMeta, setMeta } from '../db/meta'
import { makeLock, verifyLock } from '../db/lock'
import * as syncEngine from '../sync/engine'
import {
  detectSystemFonts,
  installCustomFontFromFile,
  loadPersistedCustomFonts,
  loadPersistedSystemFonts,
  registerPersistedCustomFonts,
  removeCustomFont,
  saveSystemFonts,
} from '../utils/fonts'

const AppContext = createContext(null)

const THEMES = ['light', 'dark', 'amoled', 'ember', 'moss', 'sandstone', 'midnight']
const DEFAULT_SETTINGS = {
  paperTexture: false,
  theme: 'light',
  reduceMotion: false,
  readableFont: false,
  interfaceScale: 100,
  interfaceDensity: 'comfortable',
  cornerStyle: 'rounded',
  reduceTransparency: false,
  underlineLinks: false,
  largeTargets: false,
  colorVision: 'default',
  simplifiedDecorations: false,
  privacyBlur: false,
  lockOnBackground: false,
  // Editor preferences
  editorFontSize: 'md',        // 'sm' | 'md' | 'lg' | 'xl'
  editorLineHeight: 'normal',  // 'compact' | 'normal' | 'spacious' | 'airy'
  editorMeasure: 'comfortable',// 'narrow' | 'comfortable' | 'wide'
  spellCheck: true,
  autoCorrect: true,
  autosaveDelay: 1800,
  dropCaps: false,             // decorative first-letter on chapter openings
  typewriterMode: false,       // keep current line vertically centred while typing
  timewarmth: false,           // subtle amber warmth toward evening
  // Accessibility
  highContrast: false,
  focusRingVisible: false,
  // Appearance
  accentColor: 'gold',        // 'gold'|'rose'|'sage'|'slate'|'plum'|'teal'
  appLayout: 'studio',
  hiddenSidebarTabs: [],
  soundEnabled: false,
  clickSounds: true,
  typingSounds: false,
  notificationSounds: true,
  ambientSound: false,
  ambientMood: 'moonlit',
  soundVolume: 35,
  paperStrength: 'soft',
}

const DEFAULT_SYNC = { server: null, username: null, status: 'offline', discordAvatar: null, provider: null }

function discordServer() {
  if (import.meta.env.VITE_SYNC_SERVER) return import.meta.env.VITE_SYNC_SERVER.replace(/\/+$/, '')
  // Auth and sync are same-origin. Vite proxies these routes in development;
  // the production MoonScribe server serves the UI and API together.
  return window.location.origin
}

export function AppProvider({ children }) {
  const [novels, setNovels] = useState([])
  const [onboardingDone, setOnboardingDone] = useState(null) // null = loading
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [focusMode, setFocusMode] = useState(false)
  const [toasts, setToasts] = useState([])
  const [sync, setSync] = useState(DEFAULT_SYNC)
  const [accountReady, setAccountReady] = useState(false)
  const [appLock, setAppLockState] = useState(undefined) // undefined = loading, null = none
  const [locked, setLocked] = useState(false)
  const [unlockedNovels, setUnlockedNovels] = useState(() => new Set())
  const [customFonts, setCustomFonts] = useState([])
  const [systemFonts, setSystemFonts] = useState([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [conflicts, setConflicts] = useState([])
  const toastId = useRef(0)
  const idleTimer = useRef(null)

  const toast = useCallback((msg) => {
    const id = ++toastId.current
    setToasts((items) => [...items, { id, msg }])
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4200)
    if (settings.soundEnabled && settings.notificationSounds) {
      import('../utils/sounds').then(({ playAppSound }) => playAppSound('notification', settings.soundVolume))
    }
  }, [settings.soundEnabled, settings.notificationSounds, settings.soundVolume])

  const refreshNovels = useCallback(async () => {
    const all = await listNovels()
    setNovels(all)
  }, [])

  // Load persisted state once.
  useEffect(() => {
    refreshNovels()
    getMeta('onboardingDone', false).then(setOnboardingDone)
    getMeta('appLock', null).then((l) => {
      setAppLockState(l)
      if (l?.enabled) setLocked(true)
    })
    getMeta('settings', DEFAULT_SETTINGS).then((s) => {
      const next = { ...DEFAULT_SETTINGS, ...s }
      if (!THEMES.includes(next.theme)) next.theme = 'light'
      setSettings(next)
    })
    ;(async () => {
      const [persistedCustomFonts, persistedSystemFonts] = await Promise.all([
        loadPersistedCustomFonts(),
        loadPersistedSystemFonts(),
      ])
      setCustomFonts(Array.isArray(persistedCustomFonts) ? persistedCustomFonts : [])
      setSystemFonts(Array.isArray(persistedSystemFonts) ? persistedSystemFonts : [])
      await registerPersistedCustomFonts(persistedCustomFonts)
      if (!persistedSystemFonts?.length) {
        try {
          const detected = await detectSystemFonts()
          setSystemFonts(detected)
          await saveSystemFonts(detected)
        } catch (error) {
          console.warn('[System fonts]', error)
        }
      }
    })()
    ;(async () => {
      let cfg = await syncEngine.getConfig()
      if (cfg.token && cfg.server) {
        try {
          await syncEngine.validateSession()
          cfg = await syncEngine.getConfig()
        } catch (error) {
          console.error('[Account session]', error)
          cfg = await syncEngine.getConfig()
        }
      }
      const discordAvatar = await getMeta('discordAvatar', null)
      const discordUsername = await getMeta('discordUsername', null)
      const authProvider = await getMeta('authProvider', null)
      setSync({
        server: cfg.server,
        username: cfg.username || discordUsername,
        // A stored authenticated session is connected even before this tab's
        // first background pass. The status listener will move it through
        // syncing/synced (or error) immediately afterwards.
        status: cfg.server && cfg.token ? 'connecting' : 'offline',
        discordAvatar,
        provider: authProvider
      })

      const sp = new URLSearchParams(window.location.search)
      const exchangeCode = sp.get('discord_exchange')
      const oauthCode = sp.get('oauth_exchange')
      const oauthProvider = sp.get('provider')
      const dError = sp.get('discord_error')
      if (exchangeCode || oauthCode) {
        window.history.replaceState({}, '', window.location.pathname + window.location.hash)
        try {
          const oauthServer = discordServer()
          const response = await fetch(`${oauthServer}${oauthCode ? '/api/auth/oauth/exchange' : '/api/auth/discord/exchange'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: oauthCode || exchangeCode })
          })
          const account = await response.json()
          if (!response.ok) throw new Error(account.error || 'Could not finish Discord sign-in.')
          await setMeta('discordAvatar', account.avatar || null)
          await setMeta('discordUsername', account.username)
          await setMeta('authProvider', account.provider || oauthProvider || 'discord')
          const res = await syncEngine.connectWithToken({ server: account.server || oauthServer, token: account.token, username: account.username })
          if (res.ok) {
            setSync({ server: account.server || oauthServer, username: account.username, status: 'synced', discordAvatar: account.avatar || null, provider: account.provider || oauthProvider || 'discord' })
            // OAuth should always finish in the signed-in library. This also
            // heals bookmarks or older callback URLs that still land on `/`.
            if (window.location.pathname !== '/dashboard') {
              window.location.replace('/dashboard')
              return
            }
          }
        } catch (err) {
          console.error('[Discord OAuth]', err)
          toast(err.message || 'Sign-in completed, but MoonScribe could not open the account session.')
        }
      } else if (dError) {
        window.history.replaceState({}, '', window.location.pathname + window.location.hash)
        console.error('[Discord OAuth]', dError)
        toast('Discord approved the sign-in, but MoonScribe could not complete the secure token exchange. Please try again.')
      }
    })().finally(() => setAccountReady(true))
    syncEngine.listConflicts().then(setConflicts)
  }, [refreshNovels, toast])

  // Keep the conflict list live as sync surfaces or resolves them.
  useEffect(() => {
    const onConflicts = () => syncEngine.listConflicts().then(setConflicts)
    window.addEventListener('moonscribe:conflicts', onConflicts)
    return () => window.removeEventListener('moonscribe:conflicts', onConflicts)
  }, [])

  const resolveConflict = useCallback(async (cid, choice) => {
    await syncEngine.resolveConflict(cid, choice)
    setConflicts(await syncEngine.listConflicts())
    await refreshNovels()
    window.dispatchEvent(new CustomEvent('moonscribe:synced'))
  }, [refreshNovels])

  // ---- theme ----
  // settings.theme: 'dark' | 'amoled'. The app is always dark by default.
  const resolvedTheme = THEMES.includes(settings.theme) ? settings.theme : 'light'

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    document.documentElement.classList.toggle('paper-texture', settings.paperTexture)
  }, [settings.paperTexture])

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', !!settings.reduceMotion)
  }, [settings.reduceMotion])

  useEffect(() => {
    document.documentElement.classList.toggle('readable-font', !!settings.readableFont)
  }, [settings.readableFont])

  useEffect(() => {
    const SIZE_MAP = { sm: '0.88rem', md: '1rem', lg: '1.15rem', xl: '1.3rem' }
    document.documentElement.style.setProperty('--editor-font-size', SIZE_MAP[settings.editorFontSize] || '1rem')
  }, [settings.editorFontSize])

  useEffect(() => {
    const LH_MAP = { compact: '1.65', normal: '1.85', spacious: '2.05', airy: '2.3' }
    document.documentElement.style.setProperty('--editor-line-height', LH_MAP[settings.editorLineHeight] || '1.85')
  }, [settings.editorLineHeight])

  useEffect(() => {
    const M_MAP = { narrow: '52ch', comfortable: '68ch', wide: '84ch', normal: '68ch' }
    document.documentElement.style.setProperty('--measure', M_MAP[settings.editorMeasure] || '68ch')
  }, [settings.editorMeasure])

  useEffect(() => {
    document.documentElement.classList.toggle('drop-caps', !!settings.dropCaps)
  }, [settings.dropCaps])

  useEffect(() => {
    document.documentElement.classList.toggle('typewriter-mode', !!settings.typewriterMode)
  }, [settings.typewriterMode])

  // Time-of-day warmth: gently shifts --bg toward amber between 18:00–22:00
  useEffect(() => {
    if (!settings.timewarmth) {
      document.documentElement.style.removeProperty('--timewarm-overlay')
      return
    }
    const update = () => {
      const h = new Date().getHours() + new Date().getMinutes() / 60
      // Ramp 0→1 from 17:00 to 19:30, stay at 1 until 22:00, ramp down to 23:00
      let v = 0
      if (h >= 17 && h < 19.5)  v = (h - 17) / 2.5
      else if (h >= 19.5 && h < 22) v = 1
      else if (h >= 22 && h < 23) v = 1 - (h - 22)
      document.documentElement.style.setProperty('--timewarm-overlay', `rgba(255,180,60,${(v * 0.07).toFixed(3)})`)
    }
    update()
    const id = setInterval(update, 60_000)
    return () => {
      clearInterval(id)
      document.documentElement.style.removeProperty('--timewarm-overlay')
    }
  }, [settings.timewarmth])

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', !!settings.highContrast)
  }, [settings.highContrast])

  useEffect(() => {
    document.documentElement.classList.toggle('focus-ring-visible', !!settings.focusRingVisible)
  }, [settings.focusRingVisible])

  useEffect(() => {
    const root = document.documentElement
    root.style.fontSize = `${Math.max(85, Math.min(125, Number(settings.interfaceScale) || 100))}%`
    root.dataset.density = settings.interfaceDensity || 'comfortable'
    root.dataset.corners = settings.cornerStyle || 'rounded'
    root.dataset.colorVision = settings.colorVision || 'default'
    root.dataset.appLayout = settings.appLayout || 'studio'
    root.dataset.paperStrength = settings.paperStrength || 'soft'
    root.classList.toggle('reduce-transparency', !!settings.reduceTransparency)
    root.classList.toggle('underline-links', !!settings.underlineLinks)
    root.classList.toggle('large-targets', !!settings.largeTargets)
    root.classList.toggle('simplified-decorations', !!settings.simplifiedDecorations)
  }, [settings.interfaceScale, settings.interfaceDensity, settings.cornerStyle, settings.colorVision, settings.appLayout, settings.paperStrength, settings.reduceTransparency, settings.underlineLinks, settings.largeTargets, settings.simplifiedDecorations, settings.privacyBlur])

  useEffect(() => {
    if (!settings.soundEnabled) return undefined
    let lastTyped = 0
    const click = (event) => {
      if (!settings.clickSounds || !event.target.closest('button, a, [role="button"], [role="menuitem"], [role="option"]')) return
      import('../utils/sounds').then(({ playAppSound }) => playAppSound('click', settings.soundVolume))
    }
    const type = (event) => {
      if (!settings.typingSounds || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (!event.target.closest('.ProseMirror, [contenteditable="true"]')) return
      const now = performance.now()
      if (now - lastTyped < 38) return
      lastTyped = now
      import('../utils/sounds').then(({ playAppSound }) => playAppSound(event.key === 'Enter' ? 'return' : 'type', settings.soundVolume))
    }
    document.addEventListener('click', click, true)
    document.addEventListener('keydown', type, true)
    return () => {
      document.removeEventListener('click', click, true)
      document.removeEventListener('keydown', type, true)
    }
  }, [settings.soundEnabled, settings.clickSounds, settings.typingSounds, settings.soundVolume])

  useEffect(() => {
    let cancelled = false
    let stopOnHide = null
    let stopAmbient = null
    if (!settings.soundEnabled || !settings.ambientSound) {
      import('../utils/sounds').then(({ stopAmbientSound }) => {
        if (!cancelled) stopAmbientSound()
      })
      return () => { cancelled = true }
    }
    import('../utils/sounds').then(({ startAmbientSound, stopAmbientSound }) => {
      if (cancelled) return
      stopAmbient = stopAmbientSound
      startAmbientSound(settings.soundVolume, settings.ambientMood || 'moonlit')
      stopOnHide = () => {
        if (document.hidden) stopAmbientSound()
        else startAmbientSound(settings.soundVolume, settings.ambientMood || 'moonlit')
      }
      document.addEventListener('visibilitychange', stopOnHide)
    })
    return () => {
      cancelled = true
      if (stopOnHide) document.removeEventListener('visibilitychange', stopOnHide)
      if (stopAmbient) stopAmbient()
    }
  }, [settings.soundEnabled, settings.ambientSound, settings.ambientMood, settings.soundVolume])

  useEffect(() => {
    const ACCENT_MAP = {
      gold:  { accent: '#b68235', deep: '#7d5411', fill: '#ffe3bf', fg: '#5a3b0a' },
      rose:  { accent: '#a86a52', deep: '#7a4a36', fill: '#f5d5c8', fg: '#5a2e1e' },
      sage:  { accent: '#7d8a6a', deep: '#566248', fill: '#d4e0c8', fg: '#2e3d22' },
      slate: { accent: '#6a7d8a', deep: '#465866', fill: '#c8d8e0', fg: '#1e3040' },
      plum:  { accent: '#8a6a8a', deep: '#624862', fill: '#e0c8e0', fg: '#3d1e3d' },
      teal:  { accent: '#4a8a84', deep: '#2e645f', fill: '#c0dedd', fg: '#0e3835' },
      violet:{ accent: '#7867b8', deep: '#55438f', fill: '#d9d2f2', fg: '#30245f' },
      ocean: { accent: '#397ca6', deep: '#245a7a', fill: '#c7e1ef', fg: '#163d55' },
      coral: { accent: '#c36f61', deep: '#914a40', fill: '#f2d0ca', fg: '#5e2922' },
      silver:{ accent: '#7c858f', deep: '#535c65', fill: '#d8dde2', fg: '#303941' },
    }
    const c = ACCENT_MAP[settings.accentColor] || ACCENT_MAP.gold
    const r = document.documentElement
    const darkTheme = ['dark', 'amoled', 'ember', 'moss', 'midnight'].includes(resolvedTheme)
    r.style.setProperty('--accent', c.accent)
    r.style.setProperty('--accent-deep', c.deep)
    r.style.setProperty('--moon', c.accent)
    r.style.setProperty('--moon-deep', darkTheme ? c.fill : c.deep)
    r.style.setProperty('--accent-soft', darkTheme ? `color-mix(in srgb, ${c.accent} 14%, transparent)` : `color-mix(in srgb, ${c.fill} 60%, transparent)`)
    r.style.setProperty('--accent-fill', darkTheme ? `color-mix(in srgb, ${c.accent} 27%, var(--surface))` : c.fill)
    r.style.setProperty('--accent-fill-hover', darkTheme ? `color-mix(in srgb, ${c.accent} 38%, var(--surface))` : c.fill)
    r.style.setProperty('--accent-fg', darkTheme ? '#f7f3ed' : c.fg)
  }, [settings.accentColor, resolvedTheme])

  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const finishOnboarding = useCallback(async () => {
    await setMeta('onboardingDone', true)
    setOnboardingDone(true)
  }, [])

  const updateSettings = useCallback(async (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      if (!THEMES.includes(next.theme)) next.theme = 'light'
      setMeta('settings', next)
      return next
    })
  }, [])

  const installCustomFont = useCallback(async ({ file, familyName }) => {
    const entry = await installCustomFontFromFile(file, familyName)
    setCustomFonts((prev) => [...prev.filter((font) => font.id !== entry.id), entry])
    toast(`Installed “${entry.label}”.`)
    return entry
  }, [toast])

  const deleteCustomFont = useCallback(async (entry) => {
    await removeCustomFont(entry)
    setCustomFonts((prev) => prev.filter((font) => font.id !== entry.id && font.family !== entry.family))
    toast(`Removed “${entry.label}”.`)
  }, [toast])

  const refreshSystemFonts = useCallback(async () => {
    const detected = await detectSystemFonts()
    setSystemFonts(detected)
    await saveSystemFonts(detected)
    toast(detected.length ? `Detected ${detected.length} system font${detected.length === 1 ? '' : 's'}.` : 'No additional system fonts were detected.')
    return detected
  }, [toast])

  // ---- app lock ----
  const unlockApp = useCallback(async (passphrase) => {
    const cfg = await getMeta('appLock', null)
    const ok = await verifyLock(cfg, passphrase)
    if (ok) setLocked(false)
    return ok
  }, [])

  const lockNow = useCallback(() => {
    setAppLockState((l) => {
      if (l?.enabled) setLocked(true)
      return l
    })
    setUnlockedNovels(new Set())
  }, [])

  const enableAppLock = useCallback(async ({ passphrase, kind = 'passphrase', autoLockMinutes = 15 }) => {
    const lock = await makeLock(passphrase, kind)
    const cfg = { enabled: true, ...lock, autoLockMinutes }
    await setMeta('appLock', cfg)
    setAppLockState(cfg)
    setLocked(false)
    return true
  }, [])

  const updateAppLock = useCallback(async (patch) => {
    const cfg = await getMeta('appLock', null)
    if (!cfg) return
    const next = { ...cfg, ...patch }
    await setMeta('appLock', next)
    setAppLockState(next)
  }, [])

  const disableAppLock = useCallback(async (passphrase) => {
    const cfg = await getMeta('appLock', null)
    const ok = await verifyLock(cfg, passphrase)
    if (!ok) return false
    await setMeta('appLock', null)
    setAppLockState(null)
    setLocked(false)
    return true
  }, [])

  // Auto-lock after a stretch of inactivity. Reset on any real interaction.
  useEffect(() => {
    const minutes = appLock?.enabled ? appLock.autoLockMinutes : 0
    if (!minutes || minutes <= 0 || locked) return
    const reset = () => {
      clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => setLocked(true), minutes * 60 * 1000)
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    for (const e of events) window.addEventListener(e, reset, { passive: true })
    reset()
    return () => {
      clearTimeout(idleTimer.current)
      for (const e of events) window.removeEventListener(e, reset)
    }
  }, [appLock, locked])

  // ---- per-novel lock (session-scoped unlock) ----
  const isNovelUnlocked = useCallback((id) => unlockedNovels.has(id), [unlockedNovels])
  const unlockNovel = useCallback(async (novel, passphrase) => {
    const ok = await verifyLock(novel?.lock, passphrase)
    if (ok) setUnlockedNovels((s) => new Set(s).add(novel.id))
    return ok
  }, [])
  const forgetNovelUnlock = useCallback((id) => {
    setUnlockedNovels((s) => {
      const next = new Set(s)
      next.delete(id)
      return next
    })
  }, [])

  // ---- sync ----
  useEffect(() => {
    return syncEngine.onStatus(({ status }) => {
      setSync((s) => ({ ...s, status }))
      syncEngine.getConfig().then((cfg) => setSync((s) => ({ ...s, server: cfg.server, username: cfg.username })))
    })
  }, [])

  useEffect(() => {
    const onSynced = () => refreshNovels()
    window.addEventListener('moonscribe:synced', onSynced)
    return () => window.removeEventListener('moonscribe:synced', onSynced)
  }, [refreshNovels])

  const syncNow = useCallback(async () => {
    try {
      const res = await syncEngine.sync()
      if (res.pushed > 0 || res.pulled > 0) toast('Synced.')
      return res
    } catch {
      return { pushed: 0, pulled: 0 }
    }
  }, [toast])

  const connectSync = useCallback(async ({ url, mode, username, password, replaceLocal = false }) => {
    const res = await syncEngine.connect({ url, mode, username, password, replaceLocal })
    const cfg = await syncEngine.getConfig()
    setSync({ server: cfg.server, username: cfg.username, status: res.ok ? 'synced' : 'error', discordAvatar: null, provider: 'email' })
    return res
  }, [])

  const connectDiscord = useCallback(async () => {
    const server = discordServer()
    try {
      const response = await fetch(`${server}/api/auth/status`)
      const status = await response.json().catch(() => ({}))
      if (!response.ok || !status.online) throw new Error('MoonScribe’s account service is not running. Start the app with “npm run dev”, then try again.')
      if (!status.discordAuth) throw new Error('Discord sign-in is not configured yet. Add DISCORD_CLIENT_SECRET to the server environment, or use a MoonScribe account now.')
      const params = new URLSearchParams({ redirect_to: window.location.origin })
      window.location.assign(`${server}/auth/discord?${params}`)
    } catch (error) {
      toast(error.message || 'Could not reach MoonScribe’s account service.')
    }
  }, [toast])

  const connectGoogle = useCallback(async () => {
    const server = discordServer()
    try {
      const response = await fetch(`${server}/api/auth/status`)
      const status = await response.json().catch(() => ({}))
      if (!response.ok || !status.online) throw new Error('MoonScribe’s account service is not running. Start the app with “npm run dev”, then try again.')
      if (!status.googleAuth) throw new Error('Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the server environment.')
      const params = new URLSearchParams({ redirect_to: window.location.origin })
      window.location.assign(`${server}/auth/google?${params}`)
    } catch (error) { toast(error.message || 'Could not start Google sign-in.') }
  }, [toast])

  useEffect(() => {
    const conceal = () => {
      if (settings.privacyBlur) document.documentElement.classList.add('privacy-hidden')
    }
    const reveal = () => document.documentElement.classList.remove('privacy-hidden')
    window.addEventListener('blur', conceal)
    window.addEventListener('focus', reveal)
    return () => {
      window.removeEventListener('blur', conceal)
      window.removeEventListener('focus', reveal)
      reveal()
    }
  }, [settings.privacyBlur])

  useEffect(() => {
    if (!settings.lockOnBackground || !appLock?.enabled) return undefined
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') lockNow()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [settings.lockOnBackground, appLock?.enabled, lockNow])

  const disconnectSync = useCallback(async () => {
    await syncEngine.disconnect()
    await setMeta('discordAvatar', null)
    await setMeta('discordUsername', null)
    await setMeta('authProvider', null)
    setSync({ server: null, username: null, status: 'offline', discordAvatar: null, provider: null })
  }, [])

  const signOutOtherDevices = useCallback(async () => {
    const removed = await syncEngine.signOutOtherDevices()
    toast(removed ? `Signed out ${removed} other device${removed === 1 ? '' : 's'}.` : 'No other signed-in devices.')
    return removed
  }, [toast])

  // Signed-in libraries continuously converge with the server. IndexedDB
  // remains the immediate write target, so a slow or missing connection never
  // blocks typing; the next successful pass drains the pending queue.
  useEffect(() => {
    if (!sync.server) return undefined
    let stopped = false
    const quietlySync = () => {
      if (stopped || !navigator.onLine) return
      syncEngine.sync().catch(() => {})
    }
    const timer = setInterval(quietlySync, 20_000)
    const onVisible = () => { if (document.visibilityState === 'visible') quietlySync() }
    window.addEventListener('online', quietlySync)
    window.addEventListener('focus', quietlySync)
    document.addEventListener('visibilitychange', onVisible)
    quietlySync()
    return () => {
      stopped = true
      clearInterval(timer)
      window.removeEventListener('online', quietlySync)
      window.removeEventListener('focus', quietlySync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sync.server])

  const appValue = useMemo(
    () => ({
      novels,
      refreshNovels,
      onboardingDone,
      finishOnboarding,
      settings,
      updateSettings,
      resolvedTheme,
      focusMode,
      setFocusMode,
      toast,
      toasts,
      appLock,
      locked,
      unlockApp,
      lockNow,
      enableAppLock,
      updateAppLock,
      disableAppLock,
      isNovelUnlocked,
      unlockNovel,
      forgetNovelUnlock,
      settingsOpen,
      openSettings,
      closeSettings,
      conflicts,
      resolveConflict,
      syncServer: sync.server,
      syncUsername: sync.username,
      syncStatus: sync.status,
      syncDiscordAvatar: sync.discordAvatar,
      syncProvider: sync.provider,
      accountReady,
      syncNow,
      connectSync,
      connectDiscord,
      connectGoogle,
      disconnectSync,
      signOutOtherDevices,
      customFonts,
      systemFonts,
      installCustomFont,
      deleteCustomFont,
      refreshSystemFonts,
    }),
    [novels, refreshNovels, onboardingDone, finishOnboarding, settings, updateSettings, resolvedTheme, focusMode, toast, toasts, appLock, locked, unlockApp, lockNow, enableAppLock, updateAppLock, disableAppLock, isNovelUnlocked, unlockNovel, forgetNovelUnlock, settingsOpen, openSettings, closeSettings, conflicts, resolveConflict, sync, accountReady, syncNow, connectSync, connectDiscord, connectGoogle, disconnectSync, signOutOtherDevices, customFonts, systemFonts, installCustomFont, deleteCustomFont, refreshSystemFonts]
  )

  return (
    <AppContext.Provider value={appValue}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
