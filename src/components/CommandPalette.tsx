import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { searchAll } from '../db/search'
import Icon from './Icon'
import { useApp } from '../context/AppContext'
import { keybindFromEvent } from '../utils/keybinds'

// Command palette / smart search. Opened with Ctrl+K or Ctrl+Shift+P.
// Results are grouped by Chapters, Characters, Notes, Worldbuilding,
// Relationships and Novels; fully keyboard-navigable.
const GROUPS = [
  { key: 'chapters', label: 'Chapters', icon: 'fa-solid fa-pen-nib' },
  { key: 'characters', label: 'Characters', icon: 'fa-solid fa-user' },
  { key: 'notes', label: 'Notes', icon: 'fa-regular fa-note-sticky' },
  { key: 'world', label: 'Worldbuilding', icon: 'fa-solid fa-globe' },
  { key: 'glossary', label: 'Glossary', icon: 'fa-solid fa-book-open' },
  { key: 'relationships', label: 'Relationships', icon: 'fa-regular fa-heart' },
  { key: 'novels', label: 'Novels', icon: 'fa-solid fa-book' }
  ,{ key: 'media', label: 'Media', icon: 'fa-regular fa-images' }
  ,{ key: 'settings', label: 'Settings', icon: 'fa-solid fa-sliders' }
]
const SETTING_RESULTS = [
  ['themes','Themes and colour','Parchment, Midnight, AMOLED and accent colours'],['layout','App layout','Writer Studio, Visual Library or Compact'],['paper','Paper texture','Paper grain and intensity'],['font','Editor typography','Font size, line height and reading width'],['motion','Motion and animation','Reduce motion and interface effects'],['security','Lock & security','App lock, sessions and account security'],['sync','Sync','Cloud library, Discord and signed-in devices'],['keybinds','Keyboard shortcuts','View all MoonScribe keybinds'],['quick-capture','Quick capture','Save a note to a novel without leaving your current workspace']
].map(([id,title,subtitle]) => ({ id, title, subtitle }))

const SECTION_FOR = { characters: 'characters', notes: 'notes', world: 'world', relationships: 'relationships', glossary: 'glossary' }

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [flat, setFlat] = useState([])
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { openSettings, settings } = useApp()

  // Global shortcuts: Ctrl+K / Ctrl+Shift+P toggles, Esc closes.
  useEffect(() => {
    const onKey = (e) => {
      const shortcut = settings.keybinds?.commandPalette || 'Mod+K'
      if (keybindFromEvent(e) === shortcut) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings.keybinds])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults(null)
    setFlat([])
    setActive(0)
    const t = setTimeout(() => inputRef.current?.focus(), 20)
    return () => clearTimeout(t)
  }, [open])

  // Debounced search. Empty query shows a hint instead of results.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const t = setTimeout(async () => {
      if (!query.trim()) {
        setResults(null)
        setFlat([])
        return
      }
      const res = await searchAll(query)
      res.settings = SETTING_RESULTS.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(query.trim().toLowerCase()))
      if (cancelled) return
      setResults(res)
      const arr = []
      for (const g of GROUPS) {
        for (const r of res[g.key]) arr.push({ group: g.key, r })
      }
      setFlat(arr)
      setActive(0)
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, query])

  const go = useCallback(
    (group, r) => {
      setOpen(false)
      if (group === 'novels') {
        navigate(`/novel/${r.id}`)
        return
      }
      if (group === 'settings') {
        if (r.id === 'quick-capture') window.dispatchEvent(new CustomEvent('moonscribe:quick-capture-open'))
        else { openSettings(); window.dispatchEvent(new CustomEvent('moonscribe:settings-search', { detail: r.title })) }
        return
      }
      if (group === 'chapters') {
        navigate(`/novel/${r.novelId}`, { state: { chapterId: r.id } })
        return
      }
      if (group === 'media') {
        navigate(`/novel/${r.novelId}/media`)
        return
      }
      navigate(`/novel/${r.novelId}/${SECTION_FOR[group]}`)
    },
    [navigate, openSettings]
  )

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      const hit = flat[active]
      if (hit) go(hit.group, hit.r)
    }
  }

  if (!open) return null

  const total = flat.length
  const hasQuery = query.trim().length > 0

  return createPortal(
    <div className="palette-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search everything" onKeyDown={onKeyDown}>
        <div className="palette-input-row">
          <Icon icon="fa-solid fa-magnifying-glass" />
          <input
            ref={inputRef}
            className="palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chapters, characters, notes, worldbuilding…"
            aria-label="Search everything"
          />
          <kbd className="palette-kbd">Esc</kbd>
        </div>
        <div className="palette-body">
          {!hasQuery ? (
            <div className="palette-hint">
              Type to search across every novel. <kbd>↑</kbd><kbd>↓</kbd> to move, <kbd>Enter</kbd> to open.
            </div>
          ) : total === 0 ? (
            <div className="palette-hint">Nothing found for “{query}”.</div>
          ) : (
            <div className="palette-groups">
              {GROUPS.map((g) => {
                const groupItems = results?.[g.key] || []
                if (!groupItems.length) return null
                return (
                  <div className="palette-group" key={g.key}>
                    <div className="palette-group-label">
                      <Icon icon={g.icon} /> {g.label}
                    </div>
                    {groupItems.map((r) => {
                      const index = flat.findIndex((f) => f.group === g.key && f.r.id === r.id)
                      return (
                        <button
                          key={`${g.key}:${r.id}`}
                          className={`palette-item ${index === active ? 'active' : ''}`}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => go(g.key, r)}
                        >
                          <span className="palette-item-title">{r.title || 'Untitled'}</span>
                          {r.subtitle && <span className="palette-item-sub">{r.subtitle}</span>}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
