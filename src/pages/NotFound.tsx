import { Link } from 'react-router-dom'

export default function NotFound({ message = "This page drifted off the map — the ink must have dried before it landed." }) {
  return (
    <div className="app" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '4.5rem', fontWeight: 600, color: 'var(--twilight)', lineHeight: 1 }}>404</div>
        <div style={{ color: 'var(--rose)', fontSize: '1.2rem', letterSpacing: '0.4em', margin: '10px 0 18px' }}>❦</div>
        <p className="muted" style={{ margin: '0 0 28px' }}>{message}</p>
        <Link className="button button-primary" to="/" style={{ textDecoration: 'none' }}>
          ← Back to all novels
        </Link>
      </div>
    </div>
  )
}
