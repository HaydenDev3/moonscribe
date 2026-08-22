import Icon from '../../components/Icon'
import { timeAgo } from '../../utils/dates'
import { formatWords } from '../../utils/words'
import DashboardErrorBoundary from '../DashboardErrorBoundary'
import type { DashboardData } from '../hooks/useDashboardData'
import { bestWritingDay, readableDay } from '../utils/dashboardMetrics'
import { useContextMenu } from '../../components/ContextMenu'

const Card = ({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) => {
  const { openContextMenu } = useContextMenu()
  return <DashboardErrorBoundary label={label}><article className={`moon-card ${className}`} onContextMenu={(event) => { event.stopPropagation(); openContextMenu(event, [
    { label: `Hide ${label}`, icon: 'fa-solid fa-eye-slash', onClick: () => event.currentTarget.setAttribute('hidden', 'true') },
    'divider',
    { label: 'Show all dashboard widgets', icon: 'fa-solid fa-eye', onClick: () => document.querySelectorAll('.moon-card[hidden]').forEach((card) => card.removeAttribute('hidden')) },
  ]) }}>{children}</article></DashboardErrorBoundary>
}

export function TodayWidget({ data }: { data: DashboardData }) {
  const progress = data.dailyGoal ? Math.min(100, Math.round(data.todayWords / data.dailyGoal * 100)) : 0
  return <Card label="Today" className="moon-today"><p className="moon-kicker">Today</p><strong>{formatWords(data.todayWords)}</strong><span>words written</span>{data.dailyGoal > 0 && <><div className="moon-goal-line"><span>Goal</span><span>{formatWords(data.todayWords)} / {formatWords(data.dailyGoal)}</span></div><div className="moon-progress"><i style={{ width: `${progress}%` }} /></div></>}<p className="moon-card-note">{data.streak > 0 ? `${data.streak} day streak` : 'A fresh page is waiting.'}</p></Card>
}

export function WritingRhythmWidget({ data }: { data: DashboardData }) {
  const max = Math.max(1, ...data.rhythm.map((day) => day.words))
  const best = bestWritingDay(data.rhythm)
  return <Card label="Writing rhythm" className="moon-rhythm"><p className="moon-kicker">Writing rhythm</p><div className="moon-bars" aria-label="Words written during the last seven days">{data.rhythm.map((day, index) => <div key={day.date || index}><span><i style={{ height: `${Math.max(5, day.words / max * 100)}%` }} /></span><small>{day.date ? new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' }) : '–'}</small></div>)}</div><div className="moon-rhythm-footer"><strong>{formatWords(data.weekWords)} words this week</strong><span>{best?.words ? `Best day · ${readableDay(best.date)} · ${formatWords(best.words)}` : 'Your rhythm will appear as you write.'}</span></div></Card>
}

export function RecentChaptersWidget({ data, onOpen, onViewAll }: { data: DashboardData; onOpen: (chapter: any) => void; onViewAll: () => void }) {
  return <Card label="Recent chapters" className="moon-recent"><div className="moon-card-heading"><p className="moon-kicker">Recent chapters</p><button type="button" onClick={onViewAll}>View all <Icon icon="fa-solid fa-arrow-right" /></button></div><div className="moon-chapter-list">{data.recentChapters.length ? data.recentChapters.map((chapter) => <button type="button" key={chapter.id} onClick={() => onOpen(chapter)}><span><strong>{chapter.title || 'Untitled chapter'}</strong><small>{chapter.novelTitle}</small></span><span className="moon-chapter-time">{timeAgo(chapter.updatedAt)} <Icon icon="fa-solid fa-arrow-right" /></span></button>) : <p className="moon-card-note">Edited chapters will gather here.</p>}</div></Card>
}

export function StoryProgressWidget({ data }: { data: DashboardData }) {
  return <Card label="Story progress" className="moon-story-progress"><p className="moon-kicker">Story progress</p><h3>{data.currentNovel?.title || 'Your library'}</h3><dl><div><dt>Chapters</dt><dd>{data.chapterCount}</dd></div><div><dt>Manuscript</dt><dd>{formatWords(data.totalWords)} words</dd></div><div><dt>This month</dt><dd>{formatWords(data.monthWords)} words</dd></div></dl>{data.currentNovel?.novelWordGoal > 0 && <div className="moon-progress"><i style={{ width: `${Math.min(100, data.totalWords / data.currentNovel.novelWordGoal * 100)}%` }} /></div>}</Card>
}
