import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listChapters } from '../db/chapters'
import { computeNumbers, titleFor, isContainer } from '../utils/numbering'
import { listCharacters } from '../db/characters'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icon'
import Select from '../components/Select'
import { formatWords } from '../utils/words'

const TIME_COLOR = {
  dawn:      { bg: '#fef3c7', fg: '#92400e', icon: 'fa-solid fa-sun' },
  morning:   { bg: '#fde68a', fg: '#78350f', icon: 'fa-solid fa-cloud-sun' },
  midday:    { bg: '#fed7aa', fg: '#7c2d12', icon: 'fa-solid fa-sun' },
  afternoon: { bg: '#fca5a5', fg: '#7f1d1d', icon: 'fa-solid fa-cloud-sun' },
  dusk:      { bg: '#c4b5fd', fg: '#3b0764', icon: 'fa-solid fa-cloud-moon' },
  night:     { bg: '#1e1b4b', fg: '#c7d2fe', icon: 'fa-solid fa-moon' },
  uncertain: { bg: '#e5e7eb', fg: '#374151', icon: 'fa-regular fa-clock' },
}

const BEAT_COLOR = {
  action:      '#ef4444',
  dialogue:    '#3b82f6',
  reflection:  '#10b981',
  description: '#8b5cf6',
  conflict:    '#f97316',
  resolution:  '#14b8a6',
  revelation:  '#f59e0b',
  transition:  '#6b7280',
}

function resolveTimeKey(t) {
  const k = (t || '').toLowerCase()
  if (k.startsWith('dawn')) return 'dawn'
  if (k.startsWith('morn')) return 'morning'
  if (k.startsWith('mid') || k.startsWith('noon')) return 'midday'
  if (k.startsWith('after')) return 'afternoon'
  if (k.startsWith('dusk')) return 'dusk'
  if (k.startsWith('night')) return 'night'
  return 'uncertain'
}

function beatColor(beat) {
  if (!beat) return 'var(--mist)'
  const k = beat.toLowerCase()
  for (const [key, color] of Object.entries(BEAT_COLOR)) {
    if (k.includes(key)) return color
  }
  return 'var(--accent)'
}

const ACCENT_PALETTE = [
  '#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#d53f8c','#718096',
]

export default function Timeline({ novelId, embedded }) {
  const { id } = useParams()
  const nid = novelId || id
  const navigate = useNavigate()
  const [chapters, setChapters] = useState([])
  const [characters, setCharacters] = useState([])
  const [filterPov, setFilterPov] = useState('')
  const [filterBeat, setFilterBeat] = useState('')
  const [filterTime, setFilterTime] = useState('')
  const [view, setView] = useState('timeline') // 'timeline' | 'grid'

  const load = useCallback(async () => {
    setChapters(await listChapters(nid))
    setCharacters(await listCharacters(nid))
  }, [nid])

  useEffect(() => { load() }, [load])

  const numbers = computeNumbers(chapters)
  const scenes = chapters.filter((c) => !isContainer(c))

  // Assign each unique POV a colour from the palette
  const povColors = useMemo(() => {
    const povs = [...new Set(scenes.map((c) => c.meta?.pov).filter(Boolean))]
    return Object.fromEntries(povs.map((p, i) => [p, ACCENT_PALETTE[i % ACCENT_PALETTE.length]]))
  }, [scenes])

  const filtered = scenes.filter((c) => {
    const m = c.meta || {}
    if (filterPov && m.pov !== filterPov) return false
    if (filterBeat && !(m.beat || '').toLowerCase().includes(filterBeat.toLowerCase())) return false
    if (filterTime && resolveTimeKey(m.timeOfDay) !== filterTime) return false
    return true
  })

  // Group into parts
  const groups = useMemo(() => {
    const gs = []
    let currentPart = null
    for (const c of chapters) {
      if (isContainer(c)) {
        currentPart = c.title || c.part
        gs.push({ part: currentPart, id: c.id, scenes: [] })
      } else {
        const target = gs[gs.length - 1]
        if (target) target.scenes.push(c)
        else gs.push({ part: null, id: 'root', scenes: [c] })
      }
    }
    return gs.filter((g) => g.scenes.some((s) => filtered.includes(s)))
  }, [chapters, filtered])

  const allPovs = [...new Set(scenes.map((c) => c.meta?.pov).filter(Boolean))]
  const allBeats = [...new Set(scenes.map((c) => c.meta?.beat).filter(Boolean))]

  const open = (c) => navigate(`/novel/${nid}`, { state: { chapterId: c.id } })

  const totalWords = filtered.reduce((s, c) => s + (c.wordCount || 0), 0)

  if (scenes.length === 0) {
    return (
      <div className={embedded ? undefined : 'app'}>
        <div className="page page-wide">
          <EmptyState icon="fa-solid fa-timeline" title="The timeline is empty">
            Set a scene's place, time and beat in the metadata bar as you write — it'll appear here in full colour.
          </EmptyState>
        </div>
      </div>
    )
  }

  return (
    <div className={embedded ? undefined : 'app'}>
      <div className="page page-wide" style={{ paddingBottom: 'var(--space-8)' }}>

        {/* Header */}
        <div className="tl-header">
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.7rem' }}>Timeline</h2>
            <p className="muted small" style={{ margin: '3px 0 0' }}>
              {filtered.length} scene{filtered.length !== 1 ? 's' : ''} · {formatWords(totalWords)} words
            </p>
          </div>
          <div className="tl-toolbar">
            {/* View toggle */}
            <div className="pill-toggle">
              <button className={`pill ${view === 'timeline' ? 'active' : ''}`} onClick={() => setView('timeline')}>
                <Icon icon="fa-solid fa-bars-staggered" /> Timeline
              </button>
              <button className={`pill ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>
                <Icon icon="fa-solid fa-border-all" /> Grid
              </button>
            </div>
            {/* Filters */}
            {allPovs.length > 0 && (
              <Select
                value={filterPov}
                onChange={setFilterPov}
                ariaLabel="Filter by POV"
                width={140}
                options={[
                  { value: '', label: 'All POV' },
                  ...allPovs.map((p) => ({ value: p, label: p })),
                ]}
              />
            )}
            {allBeats.length > 0 && (
              <Select
                value={filterBeat}
                onChange={setFilterBeat}
                ariaLabel="Filter by beat"
                width={140}
                options={[
                  { value: '', label: 'All beats' },
                  ...allBeats.map((b) => ({ value: b, label: b })),
                ]}
              />
            )}
            <Select
              value={filterTime}
              onChange={setFilterTime}
              ariaLabel="Filter by time of day"
              width={140}
              options={[
                { value: '', label: 'All times' },
                ...Object.keys(TIME_COLOR)
                  .filter((k) => k !== 'uncertain')
                  .map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) })),
              ]}
            />
            {(filterPov || filterBeat || filterTime) && (
              <button className="button button-quiet" onClick={() => { setFilterPov(''); setFilterBeat(''); setFilterTime('') }}>
                <Icon icon="fa-solid fa-xmark" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* POV legend */}
        {allPovs.length > 0 && (
          <div className="tl-legend">
            {allPovs.map((p) => (
              <button
                key={p}
                className={`tl-legend-chip ${filterPov === p ? 'active' : ''}`}
                style={{ ['--chip-color' as any]: povColors[p] } as CSSProperties}
                onClick={() => setFilterPov(filterPov === p ? '' : p)}
              >
                <span className="tl-legend-dot" />
                {p}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="tl-empty">No scenes match the current filters.</div>
        )}

        {view === 'timeline' ? (
          <div className="tl-track">
            {groups.map((g) => {
              const gScenes = g.scenes.filter((s) => filtered.includes(s))
              if (gScenes.length === 0) return null
              return (
                <div key={g.id} className="tl-part">
                  {g.part && <div className="tl-part-label">{g.part}</div>}
                  <div className="tl-spine">
                    {gScenes.map((c, i) => {
                      const m = c.meta || {}
                      const tk = resolveTimeKey(m.timeOfDay)
                      const tc = TIME_COLOR[tk]
                      const pov = m.pov
                      const povColor = pov ? (povColors[pov] || 'var(--grey)') : null
                      const wBar = Math.max(6, Math.min(100, (c.wordCount || 0) / 3))
                      return (
                        <div key={c.id} className={`tl-scene ${i % 2 ? 'below' : 'above'}`} style={{ ['--scene-color' as any]: povColor || beatColor(m.beat) } as CSSProperties} onClick={() => open(c)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(c)}>
                          {/* Vertical line connector */}
                          <div className="tl-connector">
                            <span className="tl-scene-index">{numbers.get(c.id)?.label || i + 1}</span>
                            <div className="tl-node" style={{ background: povColor || 'var(--accent)', borderColor: 'var(--surface)' }} />
                            {i < gScenes.length - 1 && <div className="tl-line" />}
                          </div>

                          <div className="tl-card">
                            {/* Time-of-day header band */}
                            <div className="tl-card-time" style={{ background: tc.bg, color: tc.fg }}>
                              <Icon icon={tc.icon} />
                              <span>{m.timeOfDay || tk}</span>
                              {m.location && <><span className="tl-sep">·</span><Icon icon="fa-solid fa-location-dot" /><span>{m.location}</span></>}
                            </div>

                            <div className="tl-card-body">
                              <div className="tl-card-title">{titleFor(c, numbers)}</div>
                              {m.pov && (
                                <div className="tl-card-pov">
                                  <span className="tl-pov-dot" style={{ background: povColor }} />
                                  {m.pov}
                                </div>
                              )}
                              {m.beat && (
                                <span className="tl-beat-chip" style={{ background: beatColor(m.beat) + '22', color: beatColor(m.beat), borderColor: beatColor(m.beat) + '44' }}>
                                  {m.beat}
                                </span>
                              )}
                              <div className="tl-words">{formatWords(c.wordCount || 0)}</div>
                              {/* Word-count bar */}
                              <div className="tl-wbar" style={{ width: `${wBar}%`, background: povColor || 'var(--accent)' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Grid view */
          <div className="tl-grid">
            {filtered.map((c) => {
              const m = c.meta || {}
              const tk = resolveTimeKey(m.timeOfDay)
              const tc = TIME_COLOR[tk]
              const pov = m.pov
              const povColor = pov ? (povColors[pov] || 'var(--grey)') : null
              return (
                <div key={c.id} className="tl-grid-card" onClick={() => open(c)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(c)}>
                  <div className="tl-grid-band" style={{ background: povColor || 'var(--accent)' }} />
                  <div className="tl-grid-inner">
                    <div className="tl-grid-title">{titleFor(c, numbers)}</div>
                    {m.timeOfDay && (
                      <span className="tl-time-badge" style={{ background: tc.bg, color: tc.fg }}>
                        <Icon icon={tc.icon} /> {m.timeOfDay}
                      </span>
                    )}
                    {m.pov && <div className="tl-grid-pov" style={{ color: povColor }}>{m.pov}</div>}
                    {m.beat && (
                      <span className="tl-beat-chip" style={{ background: beatColor(m.beat) + '22', color: beatColor(m.beat), borderColor: beatColor(m.beat) + '44' }}>
                        {m.beat}
                      </span>
                    )}
                    {m.location && <div className="tl-grid-loc"><Icon icon="fa-solid fa-location-dot" /> {m.location}</div>}
                    <div className="tl-words">{formatWords(c.wordCount || 0)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
