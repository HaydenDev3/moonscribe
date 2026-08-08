// App shell: routing, onboarding gate, PWA registration, theme wiring.
import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { useApp } from './context/AppContext'
import Dashboard from './pages/Dashboard'
import Novel from './pages/Novel'
import Toasts from './components/Toasts'
import Onboarding from './pages/Onboarding'
import ErrorBoundary from './components/ErrorBoundary'
import NotFound from './pages/NotFound'

const PrintView = lazy(() => import('./pages/PrintView'))

function Loading() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grey)' }}>
      <span style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic' }}>gathering the light…</span>
    </div>
  )
}

export default function App() {
  const { onboardingDone } = useApp()

  useEffect(() => {
    registerSW({ immediate: true })
  }, [])

  if (onboardingDone === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grey)', fontStyle: 'italic', fontFamily: 'var(--font-heading)' }}>
        waking up…
      </div>
    )
  }

  if (!onboardingDone) {
    return <Onboarding />
  }

  return (
    <HashRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/novel/:id" element={<Novel />} />
          {/* Every section is a mode of the writer workspace. */}
          <Route path="/novel/:id/:mode" element={<Novel />} />
          {/* Legacy binder deep links still resolve to the inline mode. */}
          <Route path="/novel/:id/binder/:section" element={<Novel />} />
          <Route
            path="/novel/:id/design/print"
            element={
              <Suspense fallback={<Loading />}>
                <PrintView />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toasts />
      </ErrorBoundary>
    </HashRouter>
  )
}
