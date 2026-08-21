import { Component, type ReactNode } from 'react'

type FeatureGuardProps = {
  featureName?: string
  title?: string
  fallbackMessage?: string
  children?: ReactNode
}

type FeatureGuardState = {
  hasError: boolean
  disabled: boolean
  message: string
}

const FEATURE_STATUS_KEY = 'moonscribe:feature-status'

function safeParseFeatureStatus(raw: string | null) {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function getFeatureStatus(featureName?: string) {
  if (!featureName || typeof window === 'undefined') return { disabled: false }
  const raw = window.localStorage.getItem(`${FEATURE_STATUS_KEY}:${featureName}`)
  const parsed = safeParseFeatureStatus(raw)
  return { ...parsed, disabled: !!parsed?.disabled }
}

export function setFeatureStatus(featureName?: string, nextState?: Record<string, any>) {
  if (!featureName || typeof window === 'undefined') return
  const current = getFeatureStatus(featureName)
  const merged = { ...current, ...nextState, disabled: !!nextState?.disabled }
  window.localStorage.setItem(`${FEATURE_STATUS_KEY}:${featureName}`, JSON.stringify(merged))
}

export function clearFeatureStatus(featureName?: string) {
  if (!featureName || typeof window === 'undefined') return
  window.localStorage.removeItem(`${FEATURE_STATUS_KEY}:${featureName}`)
}

export default class FeatureGuard extends Component<FeatureGuardProps, FeatureGuardState> {
  featureName: string

  constructor(props: FeatureGuardProps) {
    super(props)
    const featureName = props.featureName || 'feature'
    const featureStatus = getFeatureStatus(featureName)
    this.state = {
      hasError: false,
      disabled: !!featureStatus.disabled,
      message: featureStatus.message || props.fallbackMessage || 'This feature has been temporarily disabled while we repair it.'
    }
    this.featureName = featureName
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: any) {
    const reason = error?.message || 'render failure'
    const message = this.props.fallbackMessage || 'This feature hit a problem and has been temporarily paused. The rest of the app is still available.'
    setFeatureStatus(this.featureName, {
      disabled: true,
      message,
      reason,
      at: Date.now()
    })

    this.setState({ disabled: true, message })
    console.error(`MoonScribe feature guard blocked ${this.featureName}:`, error, info)
  }

  retryFeature = () => {
    clearFeatureStatus(this.featureName)
    this.setState({ hasError: false, disabled: false, message: this.props.fallbackMessage || 'This feature has been temporarily disabled while we repair it.' })
  }

  override render() {
    const persisted = getFeatureStatus(this.featureName)
    const effectiveDisabled = this.state.disabled || persisted.disabled
    const message = this.state.message || persisted.message || this.props.fallbackMessage || 'This feature is temporarily unavailable.'

    if (this.state.hasError || effectiveDisabled) {
      return (
        <div className="feature-disabled-state" role="status" aria-live="polite">
          <div className="feature-disabled-card">
            <div className="feature-disabled-kicker">Feature paused</div>
            <h3>{this.props.title || 'This part of MoonScribe is unavailable right now'}</h3>
            <p>{message}</p>
            <div className="feature-disabled-actions">
              <button className="button button-secondary" onClick={this.retryFeature} type="button">
                Retry feature
              </button>
              <button className="button button-ghost" onClick={() => window.location.reload()} type="button">
                Reload app
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
