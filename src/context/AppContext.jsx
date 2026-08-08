// Global app context: novels list, settings, focus mode, toasts, sync.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { listNovels } from '../db/novels'
import { getMeta, setMeta } from '../db/meta'
import * as syncEngine from '../sync/engine'

const AppContext = createContext(null)

const DEFAULT_SETTINGS = { paperTexture: false, theme: 'auto' }

const DEFAULT_SYNC = { server: null, token: null, username: null, status: 'offline' }

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function AppProvider({ children }) {
  const [novels, setNovels] = useState([])
  const [onboardingDone, setOnboardingDone] = useState(null) // null = loading
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [focusMode, setFocusMode] = useState(false)
  const [toasts, setToasts] = useState([])
  const [sync, setSync] = useState(DEFAULT_SYNC)
  const toastId = useRef(0)

  const refreshNovels = useCallback(async () => {
    const all = await listNovels()
    setNovels(all)
  }, [])

  // Load persisted state once.
  useEffect(() => {
    refreshNovels()
    getMeta('onboardingDone', false).then(setOnboardingDone)
    getMeta('settings', DEFAULT_SETTINGS).then((s) => {
      setSettings({ ...DEFAULT_SETTINGS, ...s })
    })
    ;(async () => {
      const cfg = await syncEngine.getConfig()
      setSync({ server: cfg.server, token: cfg.token, username: cfg.username, status: cfg.state?.status || 'offline' })
    })()
  }, [refreshNovels])

  // ---- theme ----
  // settings.theme: 'light' | 'dark' | 'amoled' | 'auto'. 'auto' follows the
  // device and resolves dark → Moonlight (not Amoled).
  const resolvedTheme =
    settings.theme === 'dark' ? 'dark'
      : settings.theme === 'amoled' ? 'amoled'
      : settings.theme === 'light' ? 'light'
      : systemPrefersDark() ? 'dark'
      : 'light'

  useEffect(() => {
    if (settings.theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      document.documentElement.dataset.theme = mq.matches ? 'dark' : 'light'
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    document.documentElement.classList.toggle('paper-texture', settings.paperTexture)
  }, [settings.paperTexture])

  const finishOnboarding = useCallback(async () => {
    await setMeta('onboardingDone', true)
    setOnboardingDone(true)
  }, [])

  const updateSettings = useCallback(async (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      setMeta('settings', next)
      return next
    })
  }, [])

  const toast = useCallback((msg) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  // ---- sync ----
  useEffect(() => {
    return syncEngine.onStatus(({ status }) => {
      setSync((s) => ({ ...s, status }))
      syncEngine.getConfig().then((cfg) => setSync((s) => ({ ...s, server: cfg.server, token: cfg.token, username: cfg.username })))
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

  const connectSync = useCallback(async ({ url, mode, username, password }) => {
    const res = await syncEngine.connect({ url, mode, username, password })
    const cfg = await syncEngine.getConfig()
    setSync({ server: cfg.server, token: cfg.token, username: cfg.username, status: res.ok ? 'synced' : 'error' })
    return res
  }, [])

  const disconnectSync = useCallback(async () => {
    await syncEngine.disconnect()
    setSync({ server: null, token: null, username: null, status: 'offline' })
  }, [])

  return (
    <AppContext.Provider
      value={{
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
        syncServer: sync.server,
        syncToken: sync.token,
        syncUsername: sync.username,
        syncStatus: sync.status,
        syncNow,
        connectSync,
        disconnectSync
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
