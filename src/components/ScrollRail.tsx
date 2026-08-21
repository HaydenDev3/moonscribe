import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'motion/react'

// A manuscript-position rail synced to the editor scroll surface.
export default function ScrollRail({ scrollElRef, className = '', markers = [] }) {
  const [thumbTop, setThumbTop]     = useState(0)
  const [thumbHeight, setThumbHeight] = useState(40)
  const [canScroll, setCanScroll]   = useState(false)
  const [active, setActive]         = useState(false)
  const railTrackRef = useRef(null)
  const dragging     = useRef(false)
  const dragStartY   = useRef(0)
  const dragStartScroll = useRef(0)
  const dragThumbH   = useRef(40)
  const activeTimer  = useRef(null)

  const bump = useCallback(() => {
    setActive(true)
    clearTimeout(activeTimer.current)
    activeTimer.current = setTimeout(() => setActive(false), 1800)
  }, [])

  const sync = useCallback(() => {
    const el = scrollElRef?.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight <= clientHeight + 2) { setCanScroll(false); return }
    setCanScroll(true)
    const railH = clientHeight
    const h = Math.max(28, Math.round(railH * (clientHeight / scrollHeight)))
    const maxTop = railH - h
    const t = scrollHeight === clientHeight ? 0
      : Math.round((scrollTop / (scrollHeight - clientHeight)) * maxTop)
    setThumbTop(t)
    setThumbHeight(h)
    dragThumbH.current = h
    bump()
  }, [scrollElRef, bump])

  useEffect(() => {
    const el = scrollElRef?.current
    if (!el) return
    el.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    sync()
    return () => {
      el.removeEventListener('scroll', sync)
      ro.disconnect()
    }
  }, [scrollElRef, sync])

  const onTrackClick = (e) => {
    if (e.target !== railTrackRef.current) return
    const el = scrollElRef?.current
    if (!el) return
    const rect = railTrackRef.current.getBoundingClientRect()
    const ratio = (e.clientY - rect.top - dragThumbH.current / 2) / (rect.height - dragThumbH.current)
    el.scrollTop = Math.max(0, ratio) * (el.scrollHeight - el.clientHeight)
  }

  const onThumbDown = (e) => {
    e.preventDefault()
    dragging.current    = true
    dragStartY.current  = e.clientY
    dragStartScroll.current = scrollElRef?.current?.scrollTop || 0

    const onMove = (ev) => {
      if (!dragging.current) return
      const el = scrollElRef?.current
      if (!el) return
      const track = railTrackRef.current
      if (!track) return
      const trackH = track.clientHeight
      const maxThumb = trackH - dragThumbH.current
      const dy = ev.clientY - dragStartY.current
      const scrollRatio = dy / maxThumb
      el.scrollTop = Math.max(0, dragStartScroll.current + scrollRatio * (el.scrollHeight - el.clientHeight))
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!canScroll) return null

  return (
    <div className={`scroll-rail ${active ? 'active' : ''} ${className}`}>
      <div
        className="scroll-rail-track"
        ref={railTrackRef}
        onClick={onTrackClick}
      >
        <motion.div
          className="scroll-rail-thumb"
          initial={false}
          animate={{ top: thumbTop, height: thumbHeight }}
          transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.28 }}
          onMouseDown={onThumbDown}
        />
        {markers.map((marker) => (
          <motion.button
            key={marker.id}
            type="button"
            className={`scroll-rail-marker ${marker.activity || 'viewing'} ${marker.emphasis ? 'is-emphasis' : ''}`}
            initial={false}
            animate={{ top: `${Math.max(0, Math.min(1, marker.topRatio || 0)) * 100}%` }}
            transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.28 }}
            style={{ '--marker-color': marker.color || '#84b9ff' } as React.CSSProperties}
            title={marker.label || 'Collaborator'}
            aria-label={marker.label || 'Collaborator marker'}
            onClick={() => {
              const el = scrollElRef?.current
              if (!el) return
              const ratio = Math.max(0, Math.min(1, marker.topRatio || 0))
              el.scrollTop = ratio * Math.max(0, el.scrollHeight - el.clientHeight)
            }}
          >
            <span>{marker.shortLabel || '•'}</span>
          </motion.button>
        ))}
      </div>

    </div>
  )
}
