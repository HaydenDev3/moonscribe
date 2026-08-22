import { useState } from 'react'
import AuthModal from './AuthModal'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'
export default function DesktopGateway() {
  const { continueAsGuest } = useApp() as any
  const navigate = useNavigate()
  const [authOpen, setAuthOpen] = useState(false)
  return <main className="desktop-gateway"><div className="desktop-gateway-card"><div className="desktop-gateway-moon">☾</div><div className="desktop-gateway-kicker">MOONSCRIBE</div><h1>Return to your stories.</h1><p>Your library can travel with you, or stay entirely on this device.</p><button className="desktop-gateway-primary" onClick={() => setAuthOpen(true)}>Sign in to MoonScribe</button><div className="desktop-gateway-divider">or</div><button className="desktop-gateway-guest" onClick={async () => { await continueAsGuest(); navigate('/dashboard', { replace: true }) }}>Continue as Guest</button><small>Your writing is saved locally first.</small></div><AuthModal open={authOpen} onClose={() => setAuthOpen(false)} /></main>
}
