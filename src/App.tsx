// App shell: routing, onboarding gate, PWA registration, theme wiring.
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { useApp } from './context/AppContext'
import Landing from './pages/Landing'
import DesktopGateway from './components/DesktopGateway'
import { isDesktopRuntime } from './api/config'
import { capabilities } from './platform/capabilities'
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
import { detectPlatform } from './utils/platform'

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

function MobileCloudPaused() {
  return (
    <div className="mobile-cloud-paused">
      <div className="mobile-cloud-paused-card">
        <div className="eyebrow">MoonScribe</div>
        <h1>MoonScribe is made for larger screens</h1>
        <p>The iPhone layout is temporarily paused so your writing workspace remains comfortable and reliable. Open MoonScribe on iPad, desktop, or a larger tablet.</p>
      </div>
    </div>
  )
}

function isIpadRuntime() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()
  return /ipad/.test(ua) || (platform.includes('mac') && navigator.maxTouchPoints > 1)
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

  const detectedPlatform = typeof navigator !== 'undefined'
    ? detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
    : 'unknown'
  if (detectedPlatform === 'mobile' && !isIpadRuntime()) {
    return <MobileCloudPaused />
  }

  const enterStudio = (content: ReactNode) => {
    if (!accountReady) return <SplashScreen />
    // OAuth providers return to /dashboard with a one-time exchange query.
    // Let AppContext mount and consume it before the account gate redirects
    // back to the sign-in modal; otherwise no exchange request is made.
    const oauthCallback = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('oauth_exchange')
    const discordCallback = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('discord_exchange')
    if (!syncUsername && !oauthCallback && !discordCallback) return <Navigate to="/?signin=1" replace />
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
