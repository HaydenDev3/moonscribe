import { Component, type ErrorInfo, type ReactNode } from 'react'

export default class DashboardErrorBoundary extends Component<{ children: ReactNode; label?: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(`Dashboard widget failed: ${this.props.label || 'Dashboard'}`, error, info)
  }
  render() {
    if (this.state.failed) return <div className="moon-widget-fallback" role="alert"><p>{this.props.label || 'This part of the dashboard'} couldn’t load.</p><button type="button" onClick={() => this.setState({ failed: false })}>Try again</button></div>
    return this.props.children
  }
}
