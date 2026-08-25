import { useState } from 'react'
import AuthModal from './AuthModal'
import { useApp } from '../context/AppContext'
export default function DesktopGateway() {
  const { continueAsGuest, hasRole, syncUsername } = useApp() as any
  const [authOpen, setAuthOpen] = useState(false)
  const betaAccess = hasRole?.('admin') || hasRole?.('developer') || hasRole?.('beta_tester')
  if (syncUsername && !betaAccess) return <main className="desktop-gateway"><div className="desktop-gateway-card"><div className="desktop-gateway-moon">☾</div><div className="desktop-gateway-kicker">PRIVATE BETA</div><h1>Desktop access is reserved.</h1><p>The MoonScribe desktop app is currently available to Beta Testers, Developers, and Admins. Your cloud library remains available in the browser.</p><button className="desktop-gateway-primary" onClick={() => window.open('https://moonscribe.cc/dashboard', '_blank', 'noopener,noreferrer')}>Open MoonScribe Cloud</button><small>Ask the MoonScribe team for desktop beta access.</small></div></main>
  return <main className="desktop-gateway"><div className="desktop-gateway-card"><div className="desktop-gateway-moon">☾</div><div className="desktop-gateway-kicker">MOONSCRIBE</div><h1>Return to your stories.</h1><p>Your library can travel with you, or stay entirely on this device.</p><button className="desktop-gateway-primary" onClick={() => setAuthOpen(true)}>Sign in to MoonScribe</button><small>Desktop access is currently limited to the private beta.</small></div><AuthModal open={authOpen} onClose={() => setAuthOpen(false)} /></main>
}
