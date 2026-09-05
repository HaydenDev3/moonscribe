import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { createNote } from '../db/notes'
import { useApp } from '../context/AppContext'
import ContinueWriting from './ContinueWriting'
import DashboardErrorBoundary from './DashboardErrorBoundary'
import QuickCapture from './QuickCapture'
import { useDashboardData } from './hooks/useDashboardData'
import { DashboardEmpty, DashboardError, DashboardLoading } from './states/DashboardStates'
import { RecentChaptersWidget, StoryProgressWidget, TodayWidget, WritingRhythmWidget } from './widgets/DashboardWidgets'
import { greetingFor } from './utils/dashboardMetrics'
import { useContextMenu } from '../components/ContextMenu'
import './dashboard.css'

export default function DashboardHome({ novels, username, syncStatus, syncAvatar, onCreate, onLibrary, onSearch, onMenu, onAccount }: any) {
  const navigate = useNavigate()
  const { toast, setFocusMode } = useApp()
  const { openContextMenu } = useContextMenu()
  const data = useDashboardData(novels)
  const openChapter = (chapter: any) => navigate(`/novel/${chapter.novelId}`, { state: { chapterId: chapter.id } })
  const openCurrent = () => data.currentNovel && navigate(`/novel/${data.currentNovel.id}`, { state: data.currentChapter ? { chapterId: data.currentChapter.id } : undefined })
  const saveCapture = async (content: string, type: string) => {
    if (!data.currentNovel) return
    await createNote(data.currentNovel.id, { title: `[${type}] ${content.split(/\r?\n/, 1)[0].slice(0, 64)}`, content })
    toast(`Saved to ${data.currentNovel.title}.`)
  }

  if (data.loading) return <DashboardLoading />
  if (data.error && !data.novels.length) return <DashboardError onRetry={data.retry} />
  if (!data.novels.length) return <DashboardEmpty onCreate={onCreate} />

  return <DashboardErrorBoundary label="Dashboard"><div className="moon-dashboard-home">
    <MobileDashboardHeader username={username} syncStatus={syncStatus} syncAvatar={syncAvatar} onMenu={onMenu} onAccount={onAccount} />
    <header className="moon-dashboard-header desktop-dashboard-greeting"><div><p>{greetingFor()}{username ? `, ${username}` : ''}.</p><h1>Ready to return to your story?</h1><span>{data.streak ? `${data.streak}-day streak · ` : ''}{data.todayWords.toLocaleString()} words today · {data.monthWords.toLocaleString()} this month</span></div><div className="moon-header-actions"><button type="button" onClick={onSearch} aria-label="Search MoonScribe"><Icon icon="fa-solid fa-magnifying-glass" /><span>Search</span></button><span className={`moon-status-pill ${syncStatus === 'synced' || syncStatus === 'local' ? 'is-synced' : ''}`}><i />{syncStatus === 'synced' ? 'Synced' : syncStatus === 'local' ? 'Saved locally' : 'Offline'}</span></div></header>
    <div className="moon-mobile-greeting md:hidden"><div><p>{greetingFor()},</p><h1>{username || 'writer'}.</h1><span>Ready to return to your story?</span></div><button type="button" onClick={onSearch} aria-label="Search your stories"><Icon icon="fa-solid fa-magnifying-glass" /></button></div>
    {syncStatus === 'offline' && <div className="moon-offline-note"><Icon icon="fa-solid fa-cloud-arrow-up" /><span><strong>Offline</strong> Changes will sync when you’re back online. Your local stories remain available.</span></div>}
    <DashboardErrorBoundary label="Continue writing"><ContinueWriting novel={data.currentNovel} chapter={data.currentChapter} todayWords={data.todayWords} onContinue={openCurrent} onOpenChapter={openCurrent} onFocus={() => { setFocusMode(true); openCurrent() }} /></DashboardErrorBoundary>
    <div className="moon-dashboard-grid" onContextMenu={(event) => openContextMenu(event, [{ label: 'Show all dashboard widgets', icon: 'fa-solid fa-eye', onClick: () => document.querySelectorAll('.moon-card[hidden]').forEach((card) => card.removeAttribute('hidden')) }])}><TodayWidget data={data} /><WritingRhythmWidget data={data} /><RecentChaptersWidget data={data} onOpen={openChapter} onViewAll={onLibrary} /><StoryProgressWidget data={data} /></div>
    <DashboardErrorBoundary label="Quick capture"><QuickCapture onSave={saveCapture} /></DashboardErrorBoundary>
  </div></DashboardErrorBoundary>
}

export function MobileDashboardHeader({ username, syncStatus, syncAvatar, onMenu, onAccount }: any) {
  return <header className="moon-mobile-dashboard-header md:hidden">
    <button type="button" className="moon-mobile-icon-button" onClick={onMenu} aria-label="Open workspace menu"><Icon icon="fa-solid fa-bars" /></button>
    <div className="moon-mobile-brand"><span className="moon-mobile-brand-mark">☾</span><span>MoonScribe</span></div>
    <div className="moon-mobile-header-actions"><button type="button" className="moon-mobile-icon-button" aria-label="Notifications"><Icon icon="fa-regular fa-bell" /></button><button type="button" className="moon-mobile-avatar-wrap" onClick={onAccount} aria-label="Open account settings" title="Open account settings">{syncAvatar ? <img className="moon-mobile-avatar" src={syncAvatar} alt="" /> : <span className="moon-mobile-avatar">{(username || 'M').slice(0, 1).toUpperCase()}</span>}<i className={`is-${syncStatus || 'offline'}`} /></button></div>
  </header>
}
