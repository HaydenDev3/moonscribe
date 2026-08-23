// Global app context: novels list, settings, focus mode, toasts, sync.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { listNovels } from '../db/novels'
import { getMeta, setMeta } from '../db/meta'
import { switchDatabaseProfile } from '../db/db'
import { makeLock, verifyLock } from '../db/lock'
import * as syncEngine from '../sync/engine'
import { apiBaseUrl, authReturnUrl } from '../api/config'
import { openExternalUrl } from '../api/desktopAuth'
import { clearOAuthCallback, readOAuthCallback } from '../auth/oauthCallback'
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
  interfaceSoundVolume: 25,
  writingSoundVolume: 18,
  notificationSoundVolume: 40,
  ambientSoundVolume: 30,
  hapticFeedback: false,
  hapticIntensity: 'subtle',
  browserNotifications: false,
  notificationPreferences: {
    inApp: true,
    writingReminders: true,
    dailyGoalUpdates: true,
    writingStreaks: true,
    milestones: true,
    collaboration: true,
    syncProblems: true,
    backupReminders: true,
    announcements: true,
    tips: false,
    emailWritingReminders: false,
    emailWeeklySummary: true,
    emailMilestones: true,
    emailCollaboration: true,
    emailAnnouncements: false,
  },
  paperStrength: 'soft',
  displayName: '',
  writerName: '',
  profileBio: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  language: 'en-AU',
  startScreen: 'dashboard',
  dashboardHeroStyle: 'large',
  dashboardShowGreeting: true,
  dashboardShowStreak: true,
  dashboardShowRecent: true,
  dashboardShowPulse: true,
  dashboardShowProgress: true,
  dashboardShowContinuity: false,
  dashboardShowEditingQueue: true,
  dashboardShowQuote: false,
  dashboardLibraryView: 'grid',
  dashboardDensity: 'balanced',
  dashboardSidebarWidth: 240,
  dashboardSidebarDefault: 'expanded',
  dashboardAutoCollapse: false,
  dashboardShowCurrentStory: true,
  dashboardShowToolLabels: true,
  dashboardAnimateCollapse: true,
  writingGoalReminders: 'gentle',
  writingSessionTimer: false,
  writingStreaks: true,
  writingCelebrations: 'subtle',
  resumeCursorPosition: true,
  rememberScrollPosition: true,
  openLastChapter: true,
  toolbarFadeWhileTyping: false,
  hideSidebarWhileTyping: false,
}

const DEFAULT_SYNC = { server: null, username: null, status: 'offline', discordAvatar: null, provider: null }
const DEFAULT_ACCOUNT = { id: null, username: null, roles: ['user'], role: 'user', isAdmin: false, isDeveloper: false }

function normalizeRoles(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(',')
  const allowed = ['user', 'developer', 'beta_tester', 'admin']
  const roles = raw.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
  const selected = new Set(roles.filter((role) => allowed.includes(role)))
  if (!selected.size) selected.add('user')
  return allowed.filter((role) => selected.has(role))
}

function discordServer() {
  return apiBaseUrl()
}

export function AppProvider({ children }) {
  const [novels, setNovels] = useState([])
  const [onboardingDone, setOnboardingDone] = useState(null) // null = loading
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [focusMode, setFocusMode] = useState(false)
  const [toasts, setToasts] = useState([])
  const [sync, setSync] = useState(DEFAULT_SYNC)
  const [account, setAccount] = useState(DEFAULT_ACCOUNT)
  const [accountReady, setAccountReady] = useState(false)
  const [authFlow, setAuthFlow] = useState({ state: 'idle', provider: null, error: null })
  const oauthCallbackInFlight = useRef(false)
  const [guestMode, setGuestMode] = useState(false)
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
      import('../utils/sounds').then(({ playFeedback }) => playFeedback('notification.normal', {
        masterEnabled: settings.soundEnabled,
        channelEnabled: settings.notificationSounds,
        masterVolume: settings.soundVolume,
        channelVolume: settings.notificationSoundVolume,
      }))
    }
  }, [settings.soundEnabled, settings.notificationSounds, settings.soundVolume, settings.notificationSoundVolume])

  const refreshNovels = useCallback(async () => {
    const all = await listNovels()
    setNovels(all)
  }, [])

  // Load persisted state once.
  useEffect(() => {
    refreshNovels()
    getMeta('onboardingDone', false).then(setOnboardingDone)
    getMeta('guestMode', false).then(setGuestMode)
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
      let parsedProfile = null
      if (cfg.token && cfg.server) {
        try {
          parsedProfile = await syncEngine.validateSession()
          cfg = await syncEngine.getConfig()
        } catch (error) {
          console.error('[Account session]', error)
          cfg = await syncEngine.getConfig()
        }
      }
      if (parsedProfile) {
        const roles = normalizeRoles(parsedProfile.roles || parsedProfile.role || 'user')
        setAccount({
          id: parsedProfile.id || null,
          username: parsedProfile.username || cfg.username || null,
          roles,
          role: roles.includes('admin') ? 'admin' : roles.includes('developer') ? 'developer' : 'user',
          isAdmin: roles.includes('admin'),
          isDeveloper: roles.includes('developer'),
        })
      } else {
        setAccount(DEFAULT_ACCOUNT)
      }
      const discordAvatar = await getMeta('discordAvatar', null)
      const discordUsername = await getMeta('discordUsername', null)
      const authProvider = await getMeta('authProvider', null)
      setSync({
        server: cfg.server,
        // Provider metadata is only a display cache. Never use it to render
        // an authenticated session after the bearer token was rejected.
        username: cfg.token ? (cfg.username || discordUsername) : null,
        // A stored authenticated session is connected even before this tab's
        // first background pass. The status listener will move it through
        // syncing/synced (or error) immediately afterwards.
        status: cfg.server && cfg.token ? 'connecting' : 'offline',
        discordAvatar: cfg.token ? discordAvatar : null,
        provider: cfg.token ? authProvider : null
      })

      const callback = readOAuthCallback(window.location.search)
      const sp = new URLSearchParams(window.location.search)
      const exchangeCode = callback.exchangeCode
      const oauthCode = window.location.search.includes('oauth_exchange') ? exchangeCode : null
      const oauthProvider = callback.provider
      const magicToken = sp.get('magic_token')
      const dError = window.location.search.includes('discord_error') ? callback.error : null
      const oauthError = window.location.search.includes('oauth_error') ? callback.error : null
      if (magicToken) {
        setAuthFlow({ state: 'processing', provider: 'magic', error: null })
        try {
          const magicServer = discordServer()
          const response = await fetch(`${magicServer}/api/auth/magic-link/consume`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: magicToken }) })
          const account = await response.json()
          if (!response.ok) throw new Error(account.error || 'This sign-in link has expired. Please request another.')
          await setMeta('authProvider', 'magic')
          const res = await syncEngine.connectWithToken({ server: account.server || magicServer, token: account.token, username: account.username })
          if (res.ok) {
            clearOAuthCallback(window.location)
            setAuthFlow({ state: 'success', provider: 'magic', error: null })
            setSync({ server: account.server || magicServer, username: account.username, status: 'synced', discordAvatar: null, provider: 'magic' })
            window.location.replace('/dashboard')
            return
          }
        } catch (err) { toast(err.message || 'Could not complete Magic Link sign-in.') }
      } else if (exchangeCode) {
        if (oauthCallbackInFlight.current) return
        oauthCallbackInFlight.current = true
        setAuthFlow({ state: 'processing', provider: callback.provider, error: null })
        try {
          const withTimeout = (promise, label, ms = 12000) => Promise.race([
            promise,
            new Promise((_, reject) => window.setTimeout(() => reject(new Error(`${label} timed out. Please try again.`)), ms)),
          ])
          const oauthServer = discordServer()
          const callbackServer = new URLSearchParams(window.location.search).get('oauth_server')?.replace(/\/+$/, '')
          const exchangePath = oauthCode ? '/api/auth/oauth/exchange' : '/api/auth/discord/exchange'
          const exchangeCodeValue = oauthCode || exchangeCode
          const exchangeOrigins = [...new Set([callbackServer, oauthServer, typeof window !== 'undefined' ? window.location.origin : ''].filter(Boolean))]
          let response = null
          let account = null
          let lastError = null
          for (const origin of exchangeOrigins) {
            try {
              const candidate = await withTimeout(fetch(`${origin}${exchangePath}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: exchangeCodeValue }) }), 'The MoonScribe account service')
              const payload = await candidate.json().catch(() => ({}))
              if (candidate.ok) { response = candidate; account = payload; break }
              lastError = new Error(payload.error || `OAuth exchange failed at ${origin}.`)
              if (candidate.status !== 404 && candidate.status !== 502 && candidate.status !== 503) break
            } catch (error) { lastError = error }
          }
          if (!response || !account) throw lastError || new Error('Could not finish OAuth sign-in.')
          await setMeta('discordAvatar', account.avatar || null)
          await setMeta('discordUsername', account.username)
          await setMeta('authProvider', account.provider || oauthProvider || 'discord')
          const existing = await syncEngine.getConfig()
          const res = await withTimeout(syncEngine.connectWithToken({ server: account.server || oauthServer, token: account.linked && existing.token ? existing.token : account.token, username: account.username }), 'Saving your account session')
          if (!res?.ok) throw new Error(res?.error || 'MoonScribe could not save the account session.')
          if (res.ok) {
            const profile = await withTimeout(syncEngine.validateSession(), 'Loading your account profile').catch(() => null)
            if (profile) {
              const roles = normalizeRoles(profile.roles || profile.role || 'user')
              setAccount({
                id: profile.id || null,
                username: profile.username || account.username || null,
                roles,
                role: roles.includes('admin') ? 'admin' : roles.includes('developer') ? 'developer' : 'user',
                isAdmin: roles.includes('admin'),
                isDeveloper: roles.includes('developer'),
              })
            }
            setSync({ server: account.server || oauthServer, username: account.username, status: 'synced', discordAvatar: account.avatar || null, provider: account.provider || oauthProvider || 'discord' })
            clearOAuthCallback(window.location)
            setAuthFlow({ state: 'success', provider: account.provider || oauthProvider || 'discord', error: null })
            // OAuth should always finish in the signed-in library. This also
            // heals bookmarks or older callback URLs that still land on `/`.
            if (window.location.pathname !== '/dashboard') {
              window.location.replace('/dashboard')
              return
            }
          }
        } catch (err) {
          console.error('[Discord OAuth]', err)
          setAuthFlow({ state: 'error', provider: callback.provider, error: err.message || 'Could not finish sign-in.' })
          toast(err.message || 'Sign-in completed, but MoonScribe could not open the account session.')
        }
      } else if (dError || oauthError) {
        const reason = dError || oauthError
        console.error('[OAuth]', reason)
        clearOAuthCallback(window.location)
        setAuthFlow({ state: 'error', provider: callback.provider, error: reason })
        const providerCredentialError = reason === 'discord_credentials_invalid' || reason === 'google_credentials_invalid'
        toast(reason === 'oauth_state_expired'
          ? 'That sign-in attempt expired. Please start again.'
          : reason === 'discord_provider_unreachable' || reason === 'google_provider_unreachable'
            ? 'MoonScribe’s account service cannot reach the identity provider right now. Check the server network connection and try again.'
          : providerCredentialError
            ? 'The provider credentials or callback URL are not configured correctly on the MoonScribe server.'
          : reason === 'discord_profile_failed' || reason === 'google_profile_failed'
              ? 'The provider approved sign-in but did not return a usable profile. Please try again.'
              : reason === 'google_sign_in_failed'
                ? 'Google sign-in could not be completed. Check the Google OAuth callback URL and server credentials, then try again.'
              : 'The provider approved sign-in, but MoonScribe could not finish the secure account connection. Please try again.')
      }
    })().finally(() => setAccountReady(true))
    syncEngine.listConflicts().then(setConflicts)
  }, [refreshNovels, toast])

  // Rotate remembered sessions twice daily. The token remains valid for 30
  // days, while active writers receive a fresh 30-day window transparently.
  useEffect(() => {
    if (!sync.server || !sync.username) return
    const refresh = () => { void syncEngine.refreshSession().catch((error) => { if (error?.status === 401) console.warn('[Session] expired') }) }
    const timer = window.setInterval(refresh, 12 * 60 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [sync.server, sync.username])

  const continueAsGuest = useCallback(async () => {
    await switchDatabaseProfile('guest')
    await setMeta('guestMode', true)
    await setMeta('onboardingDone', true)
    setGuestMode(true); setOnboardingDone(true); await refreshNovels()
  }, [refreshNovels])

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
    const root = document.documentElement
    const start = settings.customGradientStart || ''
    const end = settings.customGradientEnd || ''
    root.style.setProperty('--custom-app-gradient', start && end ? `linear-gradient(135deg, ${start}, ${end})` : '')
    root.style.setProperty('--custom-app-start', start)
    root.style.setProperty('--custom-app-end', end)
    root.dataset.customGradient = start && end ? 'true' : 'false'
  }, [settings.customGradientStart, settings.customGradientEnd])

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
      import('../utils/sounds').then(({ playFeedback }) => playFeedback('ui.click', {
        masterEnabled: settings.soundEnabled,
        channelEnabled: settings.clickSounds,
        masterVolume: settings.soundVolume,
        channelVolume: settings.interfaceSoundVolume,
      }))
    }
    const type = (event) => {
      if (!settings.typingSounds || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (!event.target.closest('.ProseMirror, [contenteditable="true"]')) return
      const now = performance.now()
      if (now - lastTyped < 38) return
      lastTyped = now
      import('../utils/sounds').then(({ playFeedback }) => playFeedback(event.key === 'Enter' ? 'writing.return' : 'writing.key', {
        masterEnabled: settings.soundEnabled,
        channelEnabled: settings.typingSounds,
        masterVolume: settings.soundVolume,
        channelVolume: settings.writingSoundVolume,
      }))
    }
    document.addEventListener('click', click, true)
    document.addEventListener('keydown', type, true)
    return () => {
      document.removeEventListener('click', click, true)
      document.removeEventListener('keydown', type, true)
    }
  }, [settings.soundEnabled, settings.clickSounds, settings.typingSounds, settings.soundVolume, settings.interfaceSoundVolume, settings.writingSoundVolume])

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
      startAmbientSound(settings.ambientSoundVolume, settings.ambientMood || 'moonlit')
      stopOnHide = () => {
        if (document.hidden) stopAmbientSound()
        else startAmbientSound(settings.ambientSoundVolume, settings.ambientMood || 'moonlit')
      }
      document.addEventListener('visibilitychange', stopOnHide)
    })
    return () => {
      cancelled = true
      if (stopOnHide) document.removeEventListener('visibilitychange', stopOnHide)
      if (stopAmbient) stopAmbient()
    }
  }, [settings.soundEnabled, settings.ambientSound, settings.ambientMood, settings.ambientSoundVolume])

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
    let indicatorTimer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = syncEngine.onStatus(({ status }) => {
      if (indicatorTimer) clearTimeout(indicatorTimer)
      indicatorTimer = undefined
      const applyStatus = () => setSync((s) => ({ ...s, status }))
      if (status === 'syncing' || status === 'connecting') {
        indicatorTimer = setTimeout(applyStatus, 400)
      } else {
        applyStatus()
      }
      syncEngine.getConfig().then((cfg) => setSync((s) => ({ ...s, server: cfg.server, username: cfg.username })))
    })
    return () => {
      if (indicatorTimer) clearTimeout(indicatorTimer)
      unsubscribe()
    }
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
    setAuthFlow({ state: 'redirecting', provider: 'discord', error: null })
    try {
      const current = await syncEngine.getConfig()
      if (current.token) {
        const response = await fetch(`${server}/api/auth/link/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` }, body: JSON.stringify({ provider: 'discord', redirect_to: authReturnUrl() }) })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Could not start Discord connection.')
        await openExternalUrl(result.url)
        return
      }
      const response = await fetch(`${server}/api/auth/status`)
      const status = await response.json().catch(() => ({}))
      if (!response.ok || !status.online) throw new Error('MoonScribe’s account service is not running. Start the app with “npm run dev”, then try again.')
      if (!status.discordAuth) throw new Error('Discord sign-in is not configured yet. Add DISCORD_CLIENT_SECRET to the server environment, or use a MoonScribe account now.')
      const params = new URLSearchParams({ redirect_to: authReturnUrl(), client: authReturnUrl().startsWith('moonscribe:') ? 'desktop' : 'web' })
      await openExternalUrl(`${server}/auth/discord?${params}`)
    } catch (error) {
      setAuthFlow({ state: 'error', provider: 'discord', error: error.message || 'Could not reach MoonScribe’s account service.' })
      toast(error.message || 'Could not reach MoonScribe’s account service.')
    }
  }, [toast])

  const connectGoogle = useCallback(async () => {
    const server = discordServer()
    setAuthFlow({ state: 'redirecting', provider: 'google', error: null })
    try {
      const current = await syncEngine.getConfig()
      if (current.token) {
        const response = await fetch(`${server}/api/auth/link/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` }, body: JSON.stringify({ provider: 'google', redirect_to: authReturnUrl() }) })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Could not start Google connection.')
        await openExternalUrl(result.url)
        return
      }
      const response = await fetch(`${server}/api/auth/status`)
      const status = await response.json().catch(() => ({}))
      if (!response.ok || !status.online) throw new Error('MoonScribe’s account service is not running. Start the app with “npm run dev”, then try again.')
      if (!status.googleAuth) throw new Error('Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the server environment.')
      const params = new URLSearchParams({ redirect_to: authReturnUrl(), client: authReturnUrl().startsWith('moonscribe:') ? 'desktop' : 'web' })
      await openExternalUrl(`${server}/auth/google?${params}`)
    } catch (error) {
      setAuthFlow({ state: 'error', provider: 'google', error: error.message || 'Could not start Google sign-in.' })
      toast(error.message || 'Could not start Google sign-in.')
    }
  }, [toast])

  const sendMagicLink = useCallback(async (email) => {
    const response = await fetch(`${discordServer()}/api/auth/magic-link`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirect_to: authReturnUrl() }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Could not send your sign-in link.')
    return result
  }, [])

  const completeTwoFactorSignIn = useCallback(async ({ server, userId, code, username }) => {
    const base = (server || discordServer()).replace(/\/+$/, '')
    const response = await fetch(`${base}/api/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'That security code could not be confirmed.')
    const connected = await syncEngine.connectWithToken({ server: base, token: result.token, username: result.username || username })
    if (!connected.ok) throw new Error(connected.error || 'MoonScribe could not save the account session.')
    setSync({ server: base, username: connected.username || result.username || username, status: 'synced', discordAvatar: null, provider: 'email' })
    return { ok: true, username: connected.username || result.username || username }
  }, [])

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

  // IndexedDB remains the immediate write target. Remote work is batched after
  // a short period of inactivity instead of polling the cloud while the author
  // is typing. Reconnect/focus still reconcile immediately, and failed batches
  // back off rather than creating a tight retry loop.
  useEffect(() => {
    if (!sync.server) return undefined
    let stopped = false
    let batchTimer: ReturnType<typeof setTimeout> | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let failureCount = 0
    const retryDelays = [2_000, 5_000, 10_000, 30_000, 60_000]

    const clearTimers = () => {
      if (batchTimer) clearTimeout(batchTimer)
      if (retryTimer) clearTimeout(retryTimer)
      batchTimer = undefined
      retryTimer = undefined
    }

    const runSync = async () => {
      if (stopped || !navigator.onLine) return
      if (batchTimer) clearTimeout(batchTimer)
      batchTimer = undefined
      try {
        await syncEngine.sync()
        failureCount = 0
      } catch {
        if (stopped || !navigator.onLine) return
        const delay = retryDelays[Math.min(failureCount, retryDelays.length - 1)]
        failureCount += 1
        retryTimer = setTimeout(runSync, delay)
      }
    }

    const scheduleBatch = () => {
      setSync((current) => ({ ...current, status: navigator.onLine ? 'local' : 'offline' }))
      if (!navigator.onLine) return
      if (batchTimer) clearTimeout(batchTimer)
      batchTimer = setTimeout(runSync, 3_500)
    }
    const reconcileNow = () => {
      failureCount = 0
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = undefined
      void runSync()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') reconcileNow() }

    window.addEventListener('moonscribe:record-written', scheduleBatch)
    window.addEventListener('online', reconcileNow)
    window.addEventListener('focus', reconcileNow)
    document.addEventListener('visibilitychange', onVisible)
    reconcileNow()
    return () => {
      stopped = true
      clearTimers()
      window.removeEventListener('moonscribe:record-written', scheduleBatch)
      window.removeEventListener('online', reconcileNow)
      window.removeEventListener('focus', reconcileNow)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sync.server])

  const accountRoles = useMemo(() => normalizeRoles(account.roles), [account.roles])
  const hasRole = useCallback((role) => accountRoles.includes(role), [accountRoles])
  const userRoleLabel = accountRoles.includes('admin') ? 'Admin' : accountRoles.includes('developer') ? 'Developer' : accountRoles.includes('beta_tester') ? 'Beta Tester' : 'User'

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
      syncUsername: sync.username || (guestMode ? 'Guest' : null),
      guestMode,
      continueAsGuest,
      syncStatus: sync.status,
      syncDiscordAvatar: sync.discordAvatar,
      syncProvider: sync.provider,
      authFlow,
      accountReady,
      accountRoles,
      userRoleLabel,
      hasRole,
      isAdmin: hasRole('admin'),
      isDeveloper: hasRole('developer'),
      syncNow,
      connectSync,
      connectDiscord,
      connectGoogle,
      sendMagicLink,
      completeTwoFactorSignIn,
      disconnectSync,
      signOutOtherDevices,
      customFonts,
      systemFonts,
      installCustomFont,
      deleteCustomFont,
      refreshSystemFonts,
    }),
    [novels, refreshNovels, onboardingDone, finishOnboarding, settings, updateSettings, resolvedTheme, focusMode, toast, toasts, appLock, locked, unlockApp, lockNow, enableAppLock, updateAppLock, disableAppLock, isNovelUnlocked, unlockNovel, forgetNovelUnlock, settingsOpen, openSettings, closeSettings, conflicts, resolveConflict, sync, guestMode, continueAsGuest, accountReady, accountRoles, userRoleLabel, hasRole, syncNow, connectSync, connectDiscord, connectGoogle, sendMagicLink, completeTwoFactorSignIn, disconnectSync, signOutOtherDevices, customFonts, systemFonts, installCustomFont, deleteCustomFont, refreshSystemFonts, authFlow]
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
