// App shell: routing, onboarding gate, PWA registration, theme wiring.
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { useApp } from './context/AppContext'
import Landing from './pages/Landing'
import DesktopGateway from './components/DesktopGateway'
import { isDesktopRuntime } from './api/config'
import { capabilities } from './platform/capabilities'
import { detectPlatform } from './utils/platform'
import { checkForDesktopUpdate } from './platform/updater'
import Toasts from './components/Toasts'
import CommandPalette from './components/CommandPalette'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Novel = lazy(() => import('./pages/Novel'))
const Settings = lazy(() => import('./components/Settings'))
import ConflictModal from './components/ConflictModal'
import Onboarding from './pages/Onboarding'
import ErrorBoundary from './components/ErrorBoundary'
import FeatureGuard from './components/FeatureGuard'
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

const PrintView = lazy(() => import('./pages/PrintView'))

function Loading() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grey)' }}>
      <span style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic' }}>gathering the light…</span>
    </div>
  )
}

function MobileCloudPaused() {
  return <main className="mobile-cloud-paused"><div className="mobile-cloud-paused-card"><span className="settings-panel-kicker">MoonScribe</span><h1>Mobile cloud is temporarily paused</h1><p>We’re tuning the tablet and phone experience before reopening the writing studio. Your local desktop library is safe and unchanged.</p><a className="button button-secondary" href="/">Return to MoonScribe</a></div></main>
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
    guestMode?: boolean
  }
  const { onboardingDone, appLock, locked, unlockApp, syncUsername, accountReady, guestMode } = appState
  const mobileCloudPaused = detectPlatform(globalThis.navigator?.userAgent, globalThis.navigator?.platform, globalThis.navigator?.maxTouchPoints) === 'mobile'

  useEffect(() => {
    registerSW({ immediate: true })
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
    if (mobileCloudPaused) return <MobileCloudPaused />
    if (!syncUsername) return <Navigate to="/?signin=1" replace />
    if (!onboardingDone) return <Onboarding />
    return content
  }

  const Router = isDesktopRuntime() ? HashRouter : BrowserRouter
  return (
    <Router>
      <ErrorBoundary>
        <AnnouncementBanner />
        <Suspense fallback={<Loading />}><Routes>
          <Route path="/" element={isDesktopRuntime() && !syncUsername && !guestMode ? <DesktopGateway /> : <Landing />} />
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
        <CommandPalette />
        <Settings />
        <ConflictModal />
        <Toasts />
      </ErrorBoundary>
    </Router>
  )
}
