import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getNovel } from '../db/novels'
import { listChapters } from '../db/chapters'
import { dailyHistory, monthlyHistory, todaySessionStats } from '../db/stats'
import { useApp } from '../context/AppContext'
import SubPageTopbar from '../components/SubPageTopbar'
import EmptyState from '../components/EmptyState'
import { formatWords } from '../utils/words'
import { heatmapCells, wordsPerMinute } from '../utils/stats'

export default function Analytics({ embedded }) {
  const { id } = useParams()
  const { toast } = useApp()
  const [novel, setNovel] = useState(null)
  const [chapters, setChapters] = useState([])
  const [history, setHistory] = useState([])
  const [monthly, setMonthly] = useState([])
  const [todaySessions, setTodaySessions] = useState({ words: 0, minutes: 0 })

  const load = useCallback(async () => {
    setNovel(await getNovel(id))
    setChapters(await listChapters(id))
    setHistory(await dailyHistory(id, 90))
    setMonthly(await monthlyHistory(id, 12))
    setTodaySessions(await todaySessionStats(id))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (!novel) {
    return <div style={{ padding: 'var(--space-7)', textAlign: 'center', color: 'var(--grey)' }}>Counting your words…</div>
  }

  const totalWords = chapters.reduce((s, c) => s + (c.wordCount || 0), 0)
  const today = history[history.length - 1]?.words || 0

  const streaks = []
  let cur = 0
  for (const d of history) {
    if (d.words > 0) cur += 1
    else cur = 0
    streaks.push(cur)
  }
  const streak = streaks[streaks.length - 1] || 0
  const writingDays = history.filter((d) => d.words > 0).length
  const best = history.reduce((m, d) => (d.words > m.words ? d : m), { words: 0, date: '' })
  const last7 = history.slice(-7).reduce((s, d) => s + d.words, 0)
  const avg = writingDays ? Math.round(history.reduce((s, d) => s + d.words, 0) / Math.max(1, writingDays)) : 0
  const todayWpm = todaySessions.minutes > 0.5 ? wordsPerMinute(todaySessions.words, todaySessions.minutes * 60000) : null

  const maxDay = Math.max(...history.map((d) => d.words), 1)
  const stats = [
    { label: 'Total words', value: formatWords(totalWords), sub: 'across every chapter' },
    { label: 'Words today', value: formatWords(today), sub: 'this page counts this device' },
    { label: 'This week', value: formatWords(last7), sub: 'last seven days' },
    { label: 'Best day', value: formatWords(best.words), sub: best.date ? prettyDate(best.date) : 'no words yet' },
    { label: 'Streak', value: streak, sub: streak === 1 ? 'day in a row' : `${streak} days in a row` },
    { label: 'Average', value: formatWords(avg), sub: 'per writing day' },
    { label: 'Today’s pace', value: todayWpm === null ? '—' : `${todayWpm} wpm`, sub: todaySessions.minutes > 0.5 ? `${Math.round(todaySessions.minutes)} min writing` : 'write a little to see it' }
  ]

  const byStatus = { draft: 0, revised: 0, final: 0 }
  for (const c of chapters) byStatus[c.status] = (byStatus[c.status] || 0) + (c.wordCount || 0)

  const topChapters = [...chapters].sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0)).slice(0, 8)
  const maxChapter = Math.max(...topChapters.map((c) => c.wordCount || 0), 1)

  return (
    <div className={embedded ? undefined : 'app'}>
      {!embedded && <SubPageTopbar novel={novel} title="Analytics" />}
      <div className="page page-wide">
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <h2 style={{ margin: 0 }}>Analytics</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>A quiet look at the shape of your work. Numbers, never judgements.</p>
        </div>

        {totalWords === 0 && history.every((d) => d.words === 0) ? (
          <EmptyState icon="◔" title="Nothing counted yet">
            Write a few words and this page will start telling their story — gently.
          </EmptyState>
        ) : (
          <>
            <div className="stat-grid">
              {stats.map((s) => (
                <div className="card stat-card" key={s.label}>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                  <div className="sub">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="card chart-card">
              <h3>Words per day · last 30 days</h3>
              <div className="chart-bars" style={{ '--max': maxDay }}>
                {history.slice(-30).map((d) => (
                  <div className="chart-col" key={d.date} title={`${prettyDate(d.date)} — ${formatWords(d.words)} words`}>
                    <div className="chart-bar" style={{ height: `${d.words ? Math.max(4, (d.words / maxDay) * 100) : 2}%` }}>
                      <span className="chart-tip">{d.words > 0 ? d.words : ''}</span>
                    </div>
                    <div className="chart-day">{d.date === todayKey() ? '·' : dayLabel(d.date)}</div>
                  </div>
                ))}
              </div>
              <button className="button button-quiet" style={{ marginTop: 12 }} onClick={() => { load(); toast('Refreshed.') }}>↻ Refresh</button>
            </div>

            <div className="card chart-card">
              <h3>Last 90 days</h3>
              <div className="heatmap">
                {heatmapCells(history).map((week, wi) => (
                  <div className="heat-week" key={wi}>
                    {week.map((cell, di) =>
                      cell ? (
                        <div
                          key={cell.date}
                          className={`heat-cell level-${cell.level}`}
                          title={`${prettyDate(cell.date)} — ${formatWords(cell.words)} words`}
                        />
                      ) : (
                        <div key={`e${di}`} className="heat-cell empty" />
                      )
                    )}
                  </div>
                ))}
              </div>
              <div className="heat-legend small muted">
                less
                {[0, 1, 2, 3, 4].map((l) => (
                  <span key={l} className={`heat-cell level-${l}`} />
                ))}
                more
              </div>
            </div>

            <div className="card chart-card">
              <h3>Words per month · last 12 months</h3>
              <div className="chart-bars month-bars" style={{ '--max': Math.max(...monthly.map((m) => m.words), 1) }}>
                {monthly.map((m) => (
                  <div className="chart-col" key={m.key} title={`${m.label} — ${formatWords(m.words)} words`}>
                    <div className="chart-bar" style={{ height: `${m.words ? Math.max(4, (m.words / Math.max(...monthly.map((x) => x.words), 1)) * 100) : 2}%` }}>
                      <span className="chart-tip">{m.words > 0 ? formatWords(m.words) : ''}</span>
                    </div>
                    <div className="chart-day">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="two-col">
              <div className="card chart-card">
                <h3>Where the words live</h3>
                {topChapters.length === 0 ? (
                  <p className="muted small">No chapters yet.</p>
                ) : (
                  <div className="chapter-bars">
                    {topChapters.map((c) => (
                      <div className="chapter-bar-row" key={c.id}>
                        <span className="cb-label" title={c.title}>{c.title || 'Untitled'}</span>
                        <div className="cb-track">
                          <div className="cb-fill" style={{ width: `${((c.wordCount || 0) / maxChapter) * 100}%` }} />
                        </div>
                        <span className="cb-words">{formatWords(c.wordCount || 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card chart-card">
                <h3>Draft · revised · final</h3>
                <div className="status-bars">
                  {[
                    ['draft', 'Draft', byStatus.draft, 'var(--mist)'],
                    ['revised', 'Revised', byStatus.revised, 'var(--rose)'],
                    ['final', 'Final', byStatus.final, 'var(--sage)']
                  ].map(([key, label, words, color]) => (
                    <div className="status-row" key={key}>
                      <span className="dot" style={{ background: color }} />
                      <span className="cb-label">{label}</span>
                      <div className="cb-track">
                        <div className="cb-fill" style={{ width: `${totalWords ? (words / totalWords) * 100 : 0}%`, background: color }} />
                      </div>
                      <span className="cb-words">{formatWords(words)}</span>
                    </div>
                  ))}
                </div>
                <p className="small muted" style={{ marginTop: 16 }}>
                  {writingDays} writing days in the last 30. {streak > 0 ? `A quiet streak of ${streak}.` : 'A fresh beginning.'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function prettyDate(iso) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function dayLabel(iso) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-GB', { day: 'numeric' })
}

function todayKey() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
