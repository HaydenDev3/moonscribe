import { Link } from 'react-router-dom'

export default function NotFound({ message = "This page drifted off the map — the ink must have dried before it landed." }) {
  return (
    <div className="not-found-scene">
      <div className="not-found-stars" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      <div className="not-found-moon" aria-hidden="true"><span /></div>
      <div className="not-found-copy">
        <div className="not-found-kicker">A PAGE BETWEEN CHAPTERS</div>
        <div className="not-found-number">404</div>
        <div className="not-found-glyph" aria-hidden="true">⌁</div>
        <h1>The story wandered.</h1>
        <p>{message}</p>
        <Link className="button button-primary" to="/" style={{ textDecoration: 'none' }}>Back to all novels · Return to the studio <span>→</span></Link>
      </div>
    </div>
  )
}
