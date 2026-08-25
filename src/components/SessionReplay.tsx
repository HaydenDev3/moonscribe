import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSnapshot, getSnapshotTimeline } from '../db/snapshots'
import Icon from './Icon'
import { sanitizeStoredHtml } from '../utils/formatHtml'

// Replay is intentionally paced like a writing session rather than a slideshow.
// The previous intervals made snapshots advance before the typing animation had
// time to settle, which made the whole replay feel unnaturally rushed.
const SPEEDS = { slow: 3600, normal: 2400, fast: 1400 }
const LARGE_SNAPSHOT_CHARS = 60_000
const PREVIEW_CHARS = 42_000
const MAX_TICKS = 120
const TYPING_RATES = { slow: 12, normal: 24, fast: 48 }

function boundedSnapshotHtml(html, complete) {
  const safe = sanitizeStoredHtml(html || '')
  if (complete || safe.length <= LARGE_SNAPSHOT_CHARS) return { html: safe, bounded: false }
  const doc = new DOMParser().parseFromString(`<main>${safe}</main>`, 'text/html')
  const root = doc.body.firstElementChild
  const selected = []
  let chars = 0
  const blocks = Array.from(root?.children || [])
  for (let index = blocks.length - 1; index >= 0 && chars < PREVIEW_CHARS; index -= 1) {
    const block = blocks[index]
    chars += block.textContent?.length || 0
    selected.unshift(block.outerHTML)
  }
  return { html: selected.join(''), bounded: true }
}

function htmlTextLength(html) {
  const doc = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  return doc.body.firstElementChild?.textContent?.length || 0
}

function truncateReplayHtml(html, limit) {
  if (!Number.isFinite(limit)) return html
  const doc = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  const source = doc.body.firstElementChild
  if (!source) return ''
  let remaining = Math.max(0, limit)
  const copy = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (remaining <= 0) return null
      const text = node.textContent || ''
      const next = doc.createTextNode(text.slice(0, remaining))
      remaining -= text.length
      return next
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null
    const element = node.cloneNode(false)
    if (node.tagName === 'IMG') return element
    for (const child of node.childNodes) {
      if (remaining <= 0) break
      const cloned = copy(child)
      if (cloned) element.appendChild(cloned)
    }
    return element
  }
  const result = doc.createElement('main')
  for (const child of source.childNodes) {
    if (remaining <= 0) break
    const cloned = copy(child)
    if (cloned) result.appendChild(cloned)
  }
  return result.innerHTML
}

function fmt(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtAgo(ts) {
  const diff = Math.round((Date.now() - ts) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function SessionReplay({ chapterId, sessionStart, onClose }) {
  const [snaps, setSnaps] = useState([])
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [speed, setSpeed] = useState('normal')
  const [snap, setSnap] = useState(null)
  const [loadingSnapshot, setLoadingSnapshot] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [typingAnimation, setTypingAnimation] = useState(true)
  const [typedChars, setTypedChars] = useState(Number.POSITIVE_INFINITY)
  const playRef = useRef(null)
  const containerRef = useRef(null)

  // Load all snapshots for this chapter taken since the session started
  const load = useCallback(async () => {
    if (!chapterId) return
    const list = await getSnapshotTimeline(chapterId, sessionStart || 0)
    setSnaps(list)
    setIdx(list.length > 0 ? list.length - 1 : 0)
    setLoaded(true)
  }, [chapterId, sessionStart])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const meta = snaps[idx]
    let cancelled = false
    setShowComplete(false)
    if (!meta) { setSnap(null); return undefined }
    setLoadingSnapshot(true)
    getSnapshot(meta.id).then((row) => {
      if (!cancelled) setSnap(row || meta)
    }).finally(() => { if (!cancelled) setLoadingSnapshot(false) })
    return () => { cancelled = true }
  }, [snaps, idx])

  // Auto-play: advance idx every PLAY_INTERVAL ms
  useEffect(() => {
    if (!playing) { clearInterval(playRef.current); return }
    playRef.current = setInterval(() => {
      setIdx((prev) => {
        if (prev >= snaps.length - 1) { setPlaying(false); return prev }
        return prev + 1
      })
    }, SPEEDS[speed])
    return () => clearInterval(playRef.current)
  }, [playing, snaps.length, speed])

  const preview = useMemo(() => boundedSnapshotHtml(snap?.content || '', showComplete), [snap?.content, showComplete])
  const previewLength = useMemo(() => htmlTextLength(preview.html), [preview.html])
  useEffect(() => {
    if (!playing || !typingAnimation || loadingSnapshot) {
      setTypedChars(Number.POSITIVE_INFINITY)
      return undefined
    }
    setTypedChars(0)
    let frame
    let previous = performance.now()
    let current = 0
    const draw = (now) => {
      current = Math.min(previewLength, current + ((now - previous) / 1000) * TYPING_RATES[speed])
      previous = now
      setTypedChars(Math.floor(current))
      if (current < previewLength) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [playing, typingAnimation, loadingSnapshot, previewLength, idx, speed])
  const replayHtml = useMemo(() => truncateReplayHtml(preview.html, typedChars), [preview.html, typedChars])
  const ticks = useMemo(() => {
    if (snaps.length <= MAX_TICKS) return snaps.map((item, index) => ({ item, index }))
    return Array.from({ length: MAX_TICKS }, (_, tick) => {
      const index = Math.round((tick / (MAX_TICKS - 1)) * (snaps.length - 1))
      return { item: snaps[index], index }
    })
  }, [snaps])

  if (!loaded) return null
  if (snaps.length === 0) {
    return (
      <div className="replay-empty">
        <Icon icon="fa-solid fa-clock-rotate-left" />
        <span>No snapshots yet — keep writing and they'll appear here.</span>
        <button className="replay-close" onClick={onClose} aria-label="Close replay"><Icon icon="fa-solid fa-xmark" /></button>
      </div>
    )
  }

  const snapMeta = snaps[idx]
  const isLive = idx === snaps.length - 1
  const previous = snaps[Math.max(0, idx - 1)]
  const wordDelta = (snapMeta?.wordCount || 0) - (previous?.wordCount || 0)
  const sessionDelta = (snapMeta?.wordCount || 0) - (snaps[0]?.wordCount || 0)

  return (
    <div className="replay-panel" ref={containerRef}>
      <div className="replay-head">
        <span className="replay-title">
          <Icon icon="fa-solid fa-clock-rotate-left" /> Writing Replay
        </span>
        <div className="replay-head-meta">
          {snapMeta && <span className="replay-ts">{fmt(snapMeta.ts)} · {fmtAgo(snapMeta.ts)}</span>}
          {isLive && <span className="replay-live-badge">LIVE</span>}
        </div>
        <button className="replay-close" onClick={onClose} aria-label="Close replay"><Icon icon="fa-solid fa-xmark" /></button>
      </div>

      {/* Timeline scrubber */}
      <div className="replay-scrubber">
        <div className="replay-summary"><span>Session evolution</span><b>{sessionDelta >= 0 ? '+' : ''}{sessionDelta} words</b></div>
        <input
          type="range"
          min={0}
          max={snaps.length - 1}
          value={idx}
          onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)) }}
          aria-label="Scrub through writing history"
        />
        <div className="replay-tick-row" aria-hidden="true">
          {ticks.map(({ item: s, index: i }) => (
            <span
              key={s.id}
              className="replay-tick"
              style={{ left: `${snaps.length === 1 ? 0 : (i / (snaps.length - 1)) * 100}%` }}
              title={fmt(s.ts)}
            />
          ))}
        </div>
      </div>

      {/* Transport controls */}
      <div className="replay-controls">
        <button
          className="replay-btn"
          onClick={() => { setPlaying(false); setIdx(0) }}
          disabled={idx === 0}
          aria-label="Jump to start"
          title="Start"
        >
          <Icon icon="fa-solid fa-backward-step" />
        </button>
        <button
          className="replay-btn"
          onClick={() => { setPlaying(false); setIdx((p) => Math.max(0, p - 1)) }}
          disabled={idx === 0}
          aria-label="Step back"
          title="Back"
        >
          <Icon icon="fa-solid fa-backward" />
        </button>
        <button
          className="replay-btn replay-play"
          onClick={() => {
            if (!playing && isLive && snaps.length > 1) {
              setIdx(0)
              setPlaying(true)
            } else {
              setPlaying((p) => !p)
            }
          }}
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause' : 'Play (restarts from beginning)'}
        >
          <Icon icon={playing ? 'fa-solid fa-pause' : 'fa-solid fa-play'} />
        </button>
        <button
          className="replay-btn"
          onClick={() => { setPlaying(false); setIdx((p) => Math.min(snaps.length - 1, p + 1)) }}
          disabled={isLive}
          aria-label="Step forward"
          title="Forward"
        >
          <Icon icon="fa-solid fa-forward" />
        </button>
        <button
          className="replay-btn"
          onClick={() => { setPlaying(false); setIdx(snaps.length - 1) }}
          disabled={isLive}
          aria-label="Jump to latest"
          title="Latest"
        >
          <Icon icon="fa-solid fa-forward-step" />
        </button>
        <span className="replay-counter">{idx + 1} / {snaps.length}</span>
        <label className="replay-speed">Speed<select value={speed} onChange={(e) => setSpeed(e.target.value)}><option value="slow">0.5×</option><option value="normal">1×</option><option value="fast">2×</option></select></label>
        <button className={`replay-typing-toggle ${typingAnimation ? 'active' : ''}`} onClick={() => setTypingAnimation((value) => !value)} aria-pressed={typingAnimation} title="Animate the manuscript as it was written"><Icon icon="fa-solid fa-keyboard" /> Typing</button>
        {snapMeta && <span className="replay-words">{snapMeta.wordCount ?? '—'} words</span>}
      </div>

      <div className="replay-insights">
        <span><Icon icon="fa-solid fa-pen" /> {wordDelta === 0 ? 'No word-count change' : `${wordDelta > 0 ? '+' : ''}${wordDelta} words since previous snapshot`}</span>
        <span><Icon icon="fa-regular fa-clock" /> Snapshot {idx + 1} of {snaps.length}</span>
        <span className={isLive ? 'live' : ''}>{isLive ? 'Current draft' : 'Earlier draft'}</span>
      </div>

      {preview.bounded && <div className="replay-large-notice"><span><Icon icon="fa-solid fa-bolt" /> Large chapter mode · showing the latest writing</span><button onClick={() => setShowComplete(true)}>Show complete snapshot</button></div>}
      {showComplete && (snap?.content || '').length > LARGE_SNAPSHOT_CHARS && <div className="replay-large-notice"><span>Complete snapshot · rendering may take a moment</span><button onClick={() => setShowComplete(false)}>Return to fast view</button></div>}
      {/* Content preview: only one body is loaded and mounted at a time. */}
      <div className={`replay-content prose-preview ${loadingSnapshot ? 'loading' : ''} ${playing && typingAnimation ? 'is-typing' : ''}`} dangerouslySetInnerHTML={{ __html: replayHtml }} />
    </div>
  )
}
