import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import NotificationBell from '../components/NotificationBell'
import { createNote } from '../db/notes'
import { useApp } from '../context/AppContext'
import ContinueWriting from './ContinueWriting'
import DashboardErrorBoundary from './DashboardErrorBoundary'
import QuickCapture from './QuickCapture'
import { useDashboardData } from './hooks/useDashboardData'
import { DashboardEmpty, DashboardError, DashboardLoading } from './states/DashboardStates'
import {
  RecentChaptersWidget,
  StoryProgressWidget,
  TodayWidget,
  WritingRhythmWidget,
} from './widgets/DashboardWidgets'
import { greetingFor } from './utils/dashboardMetrics'
import { useContextMenu } from '../components/ContextMenu'
import { formatWords } from '../utils/words'
import './dashboard.css'
import RecentNovelsCarousel from './RecentNovelsCarousel'

export default function DashboardHome({
  novels,
  username,
  syncStatus,
  syncAvatar,
  onCreate,
  onLibrary,
  onSearch,
  onMenu,
  onAccount,
}: any) {
  const navigate = useNavigate()
  const { toast, setFocusMode } = useApp()
  const { openContextMenu } = useContextMenu()
  const data = useDashboardData(novels)
  const openChapter = (chapter: any) =>
    navigate(`/novel/${chapter.novelId}`, { state: { chapterId: chapter.id } })
  const openCurrent = () =>
    data.currentNovel &&
    navigate(`/novel/${data.currentNovel.id}`, {
      state: data.currentChapter ? { chapterId: data.currentChapter.id } : undefined,
    })
  const saveCapture = async (content: string, type: string) => {
    if (!data.currentNovel) return
    await createNote(data.currentNovel.id, {
      title: `[${type}] ${content.split(/\r?\n/, 1)[0].slice(0, 64)}`,
      content,
    })
    toast(`Saved to ${data.currentNovel.title}.`)
  }

  if (data.loading) return <DashboardLoading />
  if (data.error && !data.novels.length) return <DashboardError onRetry={data.retry} />
  if (!data.novels.length) return <DashboardEmpty onCreate={onCreate} />

  return (
    <DashboardErrorBoundary label="Dashboard">
      <div className="moon-dashboard-home">
        <MobileDashboardHeader
          username={username}
          syncStatus={syncStatus}
          syncAvatar={syncAvatar}
          onMenu={onMenu}
          onAccount={onAccount}
        />
        <header className="moon-dashboard-header desktop-dashboard-greeting">
          <div>
            <p>
              {greetingFor()}
              {username ? `, ${username}` : ''}.
            </p>
            <h1>Ready to return to your story?</h1>
            <span className="dashboard-streak-summary">
              <span className="dashboard-streak-main">
                <span className="dashboard-streak-fire" aria-hidden="true">
                  🔥
                </span>
                <strong>{data.streak || 0}</strong>
                <span>day{data.streak === 1 ? '' : 's'} streak</span>
              </span>
              <span className="dashboard-streak-meta">
                · {data.todayWords.toLocaleString()} today · {data.monthWords.toLocaleString()} this
                month
              </span>
            </span>
          </div>
          <div className="moon-header-actions">
            <button type="button" onClick={onSearch} aria-label="Search MoonScribe">
              <Icon icon="fa-solid fa-magnifying-glass" />
              <span>Search</span>
            </button>
            <span
              className={`moon-status-pill ${syncStatus === 'synced' || syncStatus === 'local' ? 'is-synced' : ''}`}
            >
              <i />
              {syncStatus === 'synced'
                ? 'Synced'
                : syncStatus === 'local'
                  ? 'Saved locally'
                  : 'Offline'}
            </span>
          </div>
        </header>
        <div className="moon-mobile-greeting md:hidden">
          <div>
            <p>{greetingFor()},</p>
            <h1>{username || 'writer'}.</h1>
            <span>Ready to return to your story?</span>
          </div>
          <button type="button" onClick={onSearch} aria-label="Search your stories">
            <Icon icon="fa-solid fa-magnifying-glass" animated />
          </button>
        </div>
        {syncStatus === 'offline' && (
          <div className="moon-offline-note">
            <Icon icon="fa-solid fa-cloud-arrow-up" />
            <span>
              <strong>Offline</strong> Changes will sync when you’re back online. Your local stories
              remain available.
            </span>
          </div>
        )}
        <DashboardErrorBoundary label="Continue writing">
          <ContinueWriting
            novel={data.currentNovel}
            chapter={data.currentChapter}
            todayWords={data.todayWords}
            onContinue={openCurrent}
            onOpenChapter={openCurrent}
            onFocus={() => {
              setFocusMode(true)
              openCurrent()
            }}
          />
        </DashboardErrorBoundary>
        <RecentNovelsCarousel
          rankedNovels={data.recentNovels}
          currentNovel={data.currentNovel}
          onOpen={(novel: any) => navigate(`/novel/${novel.id}`)}
        />
        <TodayWorkspace data={data} onOpenChapter={openChapter} />
        <div
          className="moon-dashboard-grid"
          onContextMenu={(event) =>
            openContextMenu(event, [
              {
                label: 'Show all dashboard widgets',
                icon: 'fa-solid fa-eye',
                onClick: () =>
                  document
                    .querySelectorAll('.moon-card[hidden]')
                    .forEach((card) => card.removeAttribute('hidden')),
              },
            ])
          }
        >
          <TodayWidget data={data} />
          <WritingRhythmWidget data={data} />
          <SessionWidget data={data} />
          <RecentChaptersWidget data={data} onOpen={openChapter} onViewAll={onLibrary} />
          <StoryProgressWidget data={data} />
        </div>
        <DashboardErrorBoundary label="Quick capture">
          <QuickCapture onSave={saveCapture} />
        </DashboardErrorBoundary>
      </div>
    </DashboardErrorBoundary>
  )
}

function SessionWidget({ data }: { data: any }) {
  const minutes = Math.round(data.session?.minutes || 0)
  const words = data.session?.words || 0
  return (
    <section className="moon-card dashboard-session-widget" aria-label="Writing sessions">
      <div className="dashboard-card-heading">
        <div>
          <span className="dashboard-section-label">Writing sessions</span>
          <h3>Today’s focus</h3>
        </div>
        <Icon icon="fa-solid fa-hourglass-half" />
      </div>
      <div className="dashboard-session-metrics">
        <strong>{formatWords(words)}</strong>
        <span>words in sessions</span>
        <strong>{minutes}m</strong>
        <span>focused today</span>
      </div>
      <small className="muted">
        {data.session?.recent?.length
          ? `${data.session.recent.length} recent sessions recorded on this device.`
          : 'Start writing to record your first session.'}
      </small>
    </section>
  )
}

function TodayWorkspace({
  data,
  onOpenChapter,
}: {
  data: any
  onOpenChapter: (chapter: any) => void
}) {
  const max = Math.max(...data.heatmap.map((day: any) => day.words), 1)
  const warnings = [
    data.health.unsynced > 0 &&
      `${data.health.unsynced} change${data.health.unsynced === 1 ? '' : 's'} waiting to sync`,
    data.health.unresolvedComments > 0 &&
      `${data.health.unresolvedComments} unresolved comment${data.health.unresolvedComments === 1 ? '' : 's'}`,
    data.health.overdueGoals > 0 &&
      `${data.health.overdueGoals} overdue goal${data.health.overdueGoals === 1 ? '' : 's'}`,
    data.health.failedBackups > 0 &&
      `${data.health.failedBackups} failed backup${data.health.failedBackups === 1 ? '' : 's'}`,
  ].filter(Boolean)
  return (
    <section className="today-workspace" aria-labelledby="today-workspace-title">
      <div className="today-workspace-heading">
        <div>
          <span className="dashboard-section-label">Today</span>
          <h2 id="today-workspace-title">A gentle place to begin.</h2>
          <p className="muted">
            {data.todayWords
              ? `${formatWords(data.todayWords)} words in motion today.`
              : 'Your next small session is enough.'}
          </p>
        </div>
        <div className="today-workspace-report">
          <strong>{formatWords(data.weekWords)}</strong>
          <span>this week</span>
          <strong>{formatWords(data.monthWords)}</strong>
          <span>this month</span>
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="today-workspace-warnings" role="status">
          <Icon icon="fa-solid fa-circle-exclamation" />
          <span>{warnings.join(' · ')}</span>
        </div>
      )}
      <div className="today-workspace-grid">
        <div>
          <h3>Writing rhythm</h3>
          <div className="today-heatmap" aria-label="Writing activity over the last five weeks">
            {data.heatmap.map((day: any) => (
              <span
                key={day.date}
                title={`${day.date}: ${day.words} words`}
                style={{ opacity: day.words ? 0.35 + (day.words / max) * 0.65 : 0.16 }}
              />
            ))}
          </div>
          <small className="muted">Last five weeks · darker squares mean more words</small>
        </div>
        <div>
          <h3>Continue with</h3>
          <div className="today-recent-list">
            {data.recentChapters.slice(0, 3).map((chapter: any) => (
              <button key={chapter.id} onClick={() => onOpenChapter(chapter)}>
                <span>{chapter.title || 'Untitled chapter'}</span>
                <small>
                  {chapter.novelTitle} · {formatWords(chapter.wordCount || 0)} words
                </small>
              </button>
            ))}
            {!data.recentChapters.length && (
              <span className="muted">Create a chapter to start your writing trail.</span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export function MobileDashboardHeader({
  username,
  syncStatus,
  syncAvatar,
  onMenu,
  onAccount,
}: any) {
  return (
    <header className="moon-mobile-dashboard-header md:hidden">
      <button
        type="button"
        className="moon-mobile-icon-button"
        onClick={onMenu}
        aria-label="Open workspace menu"
      >
        <Icon icon="fa-solid fa-bars" animated />
      </button>
      <div className="moon-mobile-brand">
        <span className="moon-mobile-brand-mark">
          <img src="/moonscribelogo.png" alt="" />
        </span>
        <span>MoonScribe</span>
      </div>
      <div className="moon-mobile-header-actions">
        <NotificationBell buttonClassName="moon-mobile-icon-button" />
        <button
          type="button"
          className="moon-mobile-avatar-wrap"
          onClick={onAccount}
          aria-label="Open account settings"
          title="Open account settings"
        >
          {syncAvatar ? (
            <img className="moon-mobile-avatar" src={syncAvatar} alt="" />
          ) : (
            <span className="moon-mobile-avatar">
              {(username || 'M').slice(0, 1).toUpperCase()}
            </span>
          )}
          <i className={`is-${syncStatus || 'offline'}`} />
        </button>
      </div>
    </header>
  )
}
