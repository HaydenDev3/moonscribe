import Icon from '../../components/Icon'

export function DashboardLoading() {
  return <div className="moon-dashboard-loading" aria-label="Preparing your writing room" aria-live="polite">
    <div className="moon-skeleton moon-skeleton-header" />
    <div className="moon-skeleton moon-skeleton-hero" />
    <div className="moon-skeleton-row"><div className="moon-skeleton" /><div className="moon-skeleton" /></div>
  </div>
}

export function DashboardEmpty({ onCreate }: { onCreate: () => void }) {
  return <section className="moon-dashboard-empty">
    <span className="moon-empty-mark" aria-hidden="true">☾</span>
    <p className="moon-kicker">Welcome to MoonScribe</p>
    <h1>Your next story starts quietly.</h1>
    <p>There are no chapters to continue yet. Create somewhere for the first sentence to live.</p>
    <button className="moon-primary-button" type="button" onClick={onCreate}><Icon icon="fa-solid fa-plus" /> Create your first story</button>
    <div className="moon-quick-start" aria-label="Story ideas"><span>Novel</span><span>Short story</span><span>Poetry</span><span>Journal</span></div>
  </section>
}

export function DashboardError({ onRetry }: { onRetry: () => void }) {
  return <section className="moon-dashboard-empty" role="alert">
    <span className="moon-empty-mark" aria-hidden="true">☾</span><h1>Your writing room needs a moment.</h1>
    <p>Your stories are still safe on this device. Try loading the dashboard again.</p>
    <button className="moon-primary-button" type="button" onClick={onRetry}>Try again</button>
  </section>
}
