import { Component, type ReactNode } from 'react'

type ErrorBoundaryProps = { children?: ReactNode }
type ErrorBoundaryState = { errored: boolean }

// Catches render errors anywhere in the app and offers a soft landing instead
// of a blank screen. We isolate the failing feature while preserving the rest of
// the writing studio so the app does not become a full lockout.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { errored: false }
  }

  static getDerivedStateFromError() {
    return { errored: true }
  }

  componentDidCatch(error: Error, info: any) {
    console.error('MoonScribe caught an error:', error, info)
  }

  override render() {
    if (this.state.errored) {
      return (
        <div className="app-error-fallback">
          <div className="app-error-card">
            <div className="feature-disabled-kicker">App safeguard</div>
            <h2>Something slipped in the ink.</h2>
            <p>Your work is still safe. We kept the rest of the studio available and paused the failing area until it can be repaired.</p>
            <div className="feature-disabled-actions">
              <button className="button button-primary" onClick={() => window.location.reload()} type="button">
                Reload the page
              </button>
              <button className="button button-ghost" onClick={() => window.history.back()} type="button">
                Go back
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
