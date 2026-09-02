// App shell: routing, onboarding gate, PWA registration, theme wiring.
import React, { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { useApp } from './context/AppContext'
import Landing from './pages/Landing'
import DesktopGateway from './components/DesktopGateway'
import { isDesktopRuntime } from './api/config'
import { callbackSearch } from './api/desktopAuth'
import { capabilities } from './platform/capabilities'
import { checkForDesktopUpdate } from './platform/updater'
import Toasts from './components/Toasts'
import CommandPalette from './components/CommandPalette'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Novel = lazy(() => import('./pages/Novel'))
const Settings = lazy(() => import('./components/Settings'))
const AccountCentre = lazy(() => import('./components/AccountCentre'))
import Onboarding from './pages/Onboarding'
import ErrorBoundary from './components/ErrorBoundary'
import FeatureGuard, { clearFeatureStatus } from './components/FeatureGuard'
import NotFound from './pages/NotFound'
import LockScreen from './components/LockScreen'
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const PublicPage = lazy(() => import('./pages/PublicPage'))
import { purgeExpired } from './db/trash'
import './styles/beta.css'
import './styles/notifications.css'
import './styles/scrollrail.css'
import './styles/announcements.css'
import './styles/responsive.css'
import AnnouncementBanner from './components/AnnouncementBanner'
import StartupDigest from './components/StartupDigest'
import Icon from './components/Icon'
import { createNote } from './db/notes'
import { updateDiscordPresence, clearDiscordPresence } from './platform/discordPresence'

const PrintView = lazy(() => import('./pages/PrintView'))

function Loading() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grey)' }}>
      <span style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic' }}>gathering the light…</span>
    </div>
  )
}

function SplashScreen() {
  return (
    <div className="moonscribe-splash" style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', gap: 0,
      animation: 'splashIn 0.6s cubic-bezier(0.22,1,0.36,1) both',
    }}>
      <style>{`
        @keyframes splashIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashDot {
          0%, 80%, 100% { opacity: 0.2; }
          40% { opacity: 1; }
        }
      `}</style>
      <div className="splash-moon" aria-hidden="true"><span /><i /></div>
      {/* Wordmark */}
      <div style={{
        fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem, 5vw, 2.8rem)',
        fontWeight: 600, color: 'var(--twilight)', letterSpacing: '0.01em',
        marginBottom: 6,
      }}>
        MoonScribe<span style={{ color: 'var(--accent)' }}>.</span>
      </div>
      {/* Tagline */}
      <div style={{
        fontFamily: 'var(--font-heading)', fontStyle: 'italic',
        fontSize: 'clamp(0.88rem, 2vw, 1.05rem)',
        color: 'var(--grey)', letterSpacing: '0.02em', marginBottom: 40,
      }}>
        a quiet place to write, made for two
      </div>
      {/* Breathing dots */}
      <div style={{ display: 'flex', gap: 7 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--accent)',
            display: 'block',
            animation: `splashDot 1.4s ease-in-out ${i * 0.22}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const appState = useApp() as {
    onboardingDone: boolean | null
    appLock?: { enabled?: boolean; kind?: string } | null
    locked?: boolean
    unlockApp?: (value: string) => Promise<boolean>
    syncUsername?: string | null
    accountReady?: boolean
    accountCentreOpen?: boolean
    closeAccountCentre?: () => void
    guestMode?: boolean
    sync?: { status?: string }
    hasRole?: (role: string) => boolean
    novels?: Array<{ id: string; title: string }>
    toast?: (message: string) => void
  }
  const { onboardingDone, appLock, locked, unlockApp, syncUsername, accountReady, guestMode, hasRole, accountCentreOpen, closeAccountCentre } = appState
  const hasNovel = (appState.novels || []).length > 0
  const initialLibrarySync = !!syncUsername && ['connecting', 'syncing'].includes(appState.sync?.status)

  useEffect(() => {
    // A development service worker can keep an older Vite bundle alive after
    // hot reloads. That leaves feature guards reporting errors from code that
    // no longer exists, so localhost must always use the live module graph.
    if (import.meta.env.DEV) {
      clearFeatureStatus('novel')
      navigator.serviceWorker?.getRegistrations?.().then((registrations) => registrations.forEach((registration) => { void registration.unregister() }))
    } else {
      registerSW({ immediate: true })
    }
    purgeExpired()
  }, [])

  useEffect(() => {
    if (!accountReady || !capabilities.nativeUpdater || !navigator.onLine || localStorage.getItem('moonscribe:update:autoCheck') === 'false') return
    const timer = window.setTimeout(async () => {
      try {
        const update = await checkForDesktopUpdate()
        if (update) window.dispatchEvent(new CustomEvent('moonscribe:update-available', { detail: { version: update.version } }))
      } catch {
        // Update availability is never allowed to interrupt local startup.
      }
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [accountReady])

  // Lock gate sits in front of everything (but after onboarding exists).
  if (syncUsername && onboardingDone && appLock?.enabled && locked) {
    return (
      <LockScreen
        {...({
          kind: appLock.kind ?? 'passphrase',
          onUnlock: unlockApp ?? (async () => true),
          title: 'Welcome back',
          lead: 'Enter your passphrase to open your library.',
        } as any)}
      />
    )
  }

  if (onboardingDone === null) {
    return <SplashScreen />
  }

  const enterStudio = (content: ReactNode) => {
    if (!accountReady) return <SplashScreen />
    // OAuth providers return to /dashboard with a one-time exchange query.
    // Let AppContext mount and consume it before the account gate redirects
    // back to the sign-in modal; otherwise no exchange request is made.
    const callbackQuery = typeof window !== 'undefined' ? callbackSearch(window.location, isDesktopRuntime()) : ''
    const oauthCallback = new URLSearchParams(callbackQuery).has('oauth_exchange')
    const discordCallback = new URLSearchParams(callbackQuery).has('discord_exchange')
    if (!syncUsername && !oauthCallback && !discordCallback) return <Navigate to="/?signin=1" replace />
    if (!onboardingDone && !hasNovel && !initialLibrarySync) return <Onboarding />
    if (isDesktopRuntime() && !guestMode && syncUsername && !hasRole?.('admin') && !hasRole?.('developer') && !hasRole?.('beta_tester')) return <DesktopGateway />
    return content
  }

  const Router = isDesktopRuntime() ? HashRouter : BrowserRouter
  return (
    <Router>
      <ErrorBoundary>
        <DiscordPresenceBridge enabled={!!(appState as any).settings?.discordRichPresence} locked={!!locked} active={!!syncUsername || !!guestMode} />
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <AnnouncementBanner />
        <StartupDigest />
        <GlobalQuickCapture novels={appState.novels || []} toast={appState.toast} />
        <div id="main-content" tabIndex={-1}>
        <Suspense fallback={<Loading />}><Routes>
          <Route path="/" element={isDesktopRuntime() ? (syncUsername || guestMode ? <Navigate to="/dashboard" replace /> : <DesktopGateway />) : <Landing />} />
          <Route path="/privacy" element={<PublicPage page="privacy" />} />
          <Route path="/terms" element={<PublicPage page="terms" />} />
          <Route path="/cookies" element={<PublicPage page="cookies" />} />
          <Route path="/acceptable-use" element={<PublicPage page="acceptable-use" />} />
          <Route path="/community" element={<PublicPage page="community" />} />
          <Route path="/contact" element={<PublicPage page="contact" />} />
          <Route path="/dashboard" element={enterStudio(<FeatureGuard featureName="dashboard" title="Dashboard unavailable"><Dashboard /></FeatureGuard>)} />
          <Route path="/admin" element={enterStudio(<AdminDashboard />)} />
          <Route
            path="/novel/:id/design/print"
            element={enterStudio(
              <FeatureGuard featureName="print-view" title="Print preview unavailable">
                <Suspense fallback={<Loading />}>
                  <PrintView />
                </Suspense>
              </FeatureGuard>
            )}
          />
          <Route path="/novel/:id" element={enterStudio(<FeatureGuard featureName="novel" title="Novel workspace unavailable"><Novel /></FeatureGuard>)} />
          {/* Every section is a mode of the writer workspace. */}
          <Route path="/novel/:id/:mode" element={enterStudio(<FeatureGuard featureName="novel-mode" title="Writer mode unavailable"><Novel /></FeatureGuard>)} />
          {/* Legacy binder deep links still resolve to the inline mode. */}
          <Route path="/novel/:id/binder/:section" element={enterStudio(<FeatureGuard featureName="binder" title="Binder unavailable"><Novel /></FeatureGuard>)} />
          <Route path="*" element={<NotFound />} />
        </Routes></Suspense>
        </div>
        <CommandPalette />
        <Settings />
        {accountCentreOpen && <Suspense fallback={null}><AccountCentre onClose={closeAccountCentre} /></Suspense>}
        <Toasts />
      </ErrorBoundary>
    </Router>
  )
}

function DiscordPresenceBridge({ enabled, locked, active }: { enabled: boolean; locked: boolean; active: boolean }) {
  const location = useLocation()
  const sessionStart = React.useRef(Date.now())
  React.useEffect(() => {
    if (!enabled || locked || !active) { void clearDiscordPresence(); return }
    void updateDiscordPresence(true, location.pathname, sessionStart.current)
  }, [enabled, locked, active, location.pathname])
  React.useEffect(() => () => { void clearDiscordPresence() }, [])
  return null
}

function GlobalQuickCapture({ novels, toast }) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState('')
  const [novelId, setNovelId] = React.useState('')
  const [template, setTemplate] = React.useState('idea')
  const templates = {
    idea: { label: 'Idea', prompt: 'What is the idea?\n\nWhy might it matter?' },
    dialogue: { label: 'Dialogue', prompt: 'Speaker:\n“ ”\n\nContext or delivery:' },
    research: { label: 'Research', prompt: 'Question:\n\nSource:\n\nUseful details:' },
    task: { label: 'Task', prompt: 'Task:\n\nNext step:\n\nDue / priority:' }
  }
  React.useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  React.useEffect(() => {
    const openFromPalette = () => setOpen(true)
    window.addEventListener('moonscribe:quick-capture-open', openFromPalette)
    let unlisten: (() => void) | undefined
    if (isDesktopRuntime()) {
      void import('@tauri-apps/api/event').then(({ listen }) => listen('moonscribe:quick-capture-open', openFromPalette)).then((dispose) => { unlisten = dispose })
    }
    return () => {
      window.removeEventListener('moonscribe:quick-capture-open', openFromPalette)
      unlisten?.()
    }
  }, [])
  React.useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
      if (event.key === 'Tab') {
        const dialog = document.querySelector('.quick-capture-modal')
        const focusable = dialog ? [...dialog.querySelectorAll<HTMLElement>('button, textarea, select, input, [tabindex]:not([tabindex="-1"])')].filter((element) => !(element as HTMLButtonElement).disabled) : []
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])
  React.useEffect(() => {
    if (!novelId && novels[0]?.id) setNovelId(novels[0].id)
  }, [novelId, novels])
  if (!open || !novels.length) return null
  const close = () => { setOpen(false); setValue(''); setTemplate('idea') }
  const chooseTemplate = (next) => { setTemplate(next); setValue(templates[next].prompt) }
  const save = async () => {
    const novel = novels.find((item) => item.id === novelId)
    if (!novel || !value.trim()) return
    const title = value.trim().split(/\r?\n/, 1)[0].slice(0, 72) || 'Quick capture'
    await createNote(novel.id, { title, content: value.trim() })
    toast?.(`Saved to ${novel.title}.`)
    close()
  }
  return <div className="quick-capture-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}><section className="quick-capture-modal" role="dialog" aria-modal="true" aria-labelledby="quick-capture-title"><header><div><span className="settings-panel-kicker">Capture</span><h2 id="quick-capture-title">Quick capture</h2></div><button className="button button-quiet" type="button" onClick={close} aria-label="Close quick capture"><Icon icon="fa-solid fa-xmark" /></button></header><div className="quick-capture-templates" role="group" aria-label="Capture templates">{Object.entries(templates).map(([id, item]) => <button key={id} type="button" className={template === id ? 'active' : ''} onClick={() => chooseTemplate(id)}>{item.label}</button>)}</div><textarea autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="A line, scene idea, or detail before it disappears…" aria-label="Quick capture note" rows={6} /><label>Save to<select value={novelId} onChange={(event) => setNovelId(event.target.value)}>{novels.map((novel) => <option key={novel.id} value={novel.id}>{novel.title}</option>)}</select></label><footer><span>Ctrl/Cmd + Shift + K anytime</span><button className="button button-primary" type="button" disabled={!value.trim() || !novelId} onClick={() => void save()}>Save capture</button></footer></section></div>
}
