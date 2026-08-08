import { Component } from 'react'
import NotFound from '../pages/NotFound'

// Catches render errors anywhere in the app and offers a soft landing instead
// of a blank screen. The little routines of a novel are too fragile to lose.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { errored: false }
  }

  static getDerivedStateFromError() {
    return { errored: true }
  }

  componentDidCatch(error, info) {
    console.error('Moonscribe caught an error:', error, info)
  }

  render() {
    if (this.state.errored) {
      return (
        <div>
          <NotFound message="Something slipped in the ink. Your words are safe — reload and we’ll pick up where we left off." />
          <div style={{ textAlign: 'center', paddingBottom: 'var(--space-7)' }}>
            <button className="button button-ghost" onClick={() => window.location.reload()}>
              Reload the page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
