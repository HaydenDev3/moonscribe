import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
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

  const totalWords = chapters.reduce((s, c) => s + (c.wordCount || 0), 0)
  const today = history[history.length - 1]?.words || 0

  const { streak, writingDays, best, last7, avg, todayWpm, stats } = useMemo(() => {
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
    const stats = [
              { label: 'Total words', value: formatWords(totalWords), sub: 'across every chapter' },
      { label: 'Words today', value: formatWords(today), sub: 'this page counts this device' },
      { label: 'This week', value: formatWords(last7), sub: 'last seven days' },
      { label: 'Best day', value: formatWords(best.words), sub: best.date ? prettyDate(best.date) : 'no words yet' },
      { label: 'Streak', value: streak, sub: streak === 1 ? 'day in a row' : `${streak} days in a row` },
      { label: 'Average', value: formatWords(avg), sub: 'per writing day' },
      { label: 'Today’s pace', value: todayWpm === null ? '—' : `${todayWpm} wpm`, sub: todaySessions.minutes > 0.5 ? `${Math.round(todaySessions.minutes)} min writing` : 'write a little to see it' }
    ]
    return { streak, writingDays, best, last7, avg, todayWpm, stats }
  }, [history, today, todaySessions, totalWords])

  // Only show days from the novel's creation date onward — no phantom zeros before it existed
  const novelCreatedDate = novel?.createdAt ? toISODate(new Date(novel.createdAt)) : null
  const clippedHistory = novelCreatedDate ? history.filter((d) => d.date >= novelCreatedDate) : history

  const maxDay = Math.max(...clippedHistory.map((d) => d.words), 1)

  const byStatus = { draft: 0, revised: 0, final: 0 }
  for (const c of chapters) byStatus[c.status] = (byStatus[c.status] || 0) + (c.wordCount || 0)

  const topChapters = [...chapters].sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0)).slice(0, 8)
  const maxChapter = Math.max(...topChapters.map((c) => c.wordCount || 0), 1)

  if (!novel) {
    return <div style={{ padding: 'var(--space-7)', textAlign: 'center', color: 'var(--grey)' }}>Counting your words…</div>
  }

  return (
    <div className={embedded ? undefined : 'app'}>
      {!embedded && <SubPageTopbar novel={novel} title="Analytics" />}
      <div className="page page-wide analytics-page">
        <div className="analytics-hero">
          <div>
            <span className="analytics-eyebrow">Writing rhythm</span>
            <h2>Analytics</h2>
            <p>A quiet, useful picture of your manuscript—not a scoreboard.</p>
          </div>
          <button className="button button-quiet analytics-refresh" onClick={() => { load(); toast('Refreshed.') }}>↻ Refresh</button>
        </div>

        <div className="analytics-empty-summary" aria-label="Total words">
          <strong>Total words</strong><span>{formatWords(totalWords)}</span>
        </div>

        {totalWords === 0 && history.every((d) => d.words === 0) ? (
          <EmptyState icon="◔" title="Nothing counted yet">
            Write a few words and this page will start telling their story — gently.
          </EmptyState>
        ) : (
          <>
            <div className="stat-grid analytics-stat-grid">
              {stats.map((s) => (
                <div className="card stat-card" key={s.label}>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                  <div className="sub">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="card chart-card analytics-primary-chart">
              <div className="analytics-card-head"><div><span className="analytics-eyebrow">Momentum</span><h3>Words per day</h3></div><span className="analytics-range">Last 30 days</span></div>
              <div className="chart-bars" style={{ ['--max' as any]: maxDay } as CSSProperties}>
                {clippedHistory.slice(-30).map((d) => (
                  <div className="chart-col" key={d.date} title={`${prettyDate(d.date)} — ${formatWords(d.words)} words`}>
                    <div className="chart-bar" style={{ height: `${d.words ? Math.max(4, (d.words / maxDay) * 100) : 2}%` }}>
                      <span className="chart-tip">{d.words > 0 ? d.words : ''}</span>
                    </div>
                    <div className="chart-day">{d.date === todayKey() ? '·' : dayLabel(d.date)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card chart-card analytics-heat-card">
              <div className="analytics-card-head"><div><span className="analytics-eyebrow">Consistency</span><h3>Writing days</h3></div><span className="analytics-range">Last 90 days</span></div>
              <div className="heatmap">
                {heatmapCells(history).map((week, wi) => (
                  <div className="heat-week" key={wi}>
                    {week.map((cell, di) =>
                      cell ? (
                        <div
                          key={cell.date}
                          className={`heat-cell level-${cell.level}`}
                          role="img"
                          aria-label={`${prettyDate(cell.date)} — ${formatWords(cell.words)} words`}
                          title={`${prettyDate(cell.date)} — ${formatWords(cell.words)} words`}
                        />
                      ) : (
                        <div key={`e${di}`} className="heat-cell empty" aria-hidden="true" />
                      )
                    )}
                  </div>
                ))}
              </div>
              <div className="heat-legend small muted">
                less
                {[0, 1, 2, 3, 4].map((l) => (
                  <span key={l} className={`heat-cell level-${l}`} aria-hidden="true" />
                ))}
                more
              </div>
            </div>

            <div className="card chart-card">
              <div className="analytics-card-head"><div><span className="analytics-eyebrow">Long view</span><h3>Words per month</h3></div><span className="analytics-range">Last 12 months</span></div>
              <div className="chart-bars month-bars" style={{ ['--max' as any]: Math.max(...monthly.map((m) => m.words), 1) } as CSSProperties}>
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
                  ].map(([key, label, words, color]) => {
                    const wordCount = Number(words) || 0
                    return (
                      <div className="status-row" key={String(key)}>
                        <span className="dot" style={{ background: color }} />
                        <span className="cb-label">{String(label)}</span>
                        <div className="cb-track">
                          <div className="cb-fill" style={{ width: `${totalWords ? (wordCount / totalWords) * 100 : 0}%`, background: color }} />
                        </div>
                        <span className="cb-words">{formatWords(wordCount)}</span>
                      </div>
                    )
                  })}
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

function toISODate(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
