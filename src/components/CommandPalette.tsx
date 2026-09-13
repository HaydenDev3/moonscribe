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
  { key: 'actions', label: 'Quick actions', icon: 'fa-solid fa-bolt' },
  { key: 'chapters', label: 'Chapters', icon: 'fa-solid fa-pen-nib' },
  { key: 'characters', label: 'Characters', icon: 'fa-solid fa-user' },
  { key: 'notes', label: 'Notes', icon: 'fa-regular fa-note-sticky' },
  { key: 'world', label: 'Worldbuilding', icon: 'fa-solid fa-globe' },
  { key: 'glossary', label: 'Glossary', icon: 'fa-solid fa-book-open' },
  { key: 'relationships', label: 'Relationships', icon: 'fa-regular fa-heart' },
  { key: 'novels', label: 'Novels', icon: 'fa-solid fa-book' }
  ,{ key: 'media', label: 'Media', icon: 'fa-regular fa-images' }
  ,{ key: 'website', label: 'Author Website', icon: 'fa-solid fa-globe' }
  ,{ key: 'settings', label: 'Settings', icon: 'fa-solid fa-sliders' }
]
const ACTIONS = [
  { id: 'dashboard', title: 'Open dashboard', subtitle: 'Return to your novel library', keywords: 'home library' },
  { id: 'quick-capture', title: 'Quick capture', subtitle: 'Save an idea without leaving your current workspace', keywords: 'idea note inbox' },
  { id: 'start-session', title: 'Start writing session', subtitle: 'Reset the session timer and begin a focused writing block', keywords: 'sprint focus timer words' },
  { id: 'sync', title: 'Sync now', subtitle: 'Push local changes and pull cloud updates', keywords: 'cloud refresh' },
  { id: 'settings', title: 'Open settings', subtitle: 'Configure your writing environment', keywords: 'preferences account' },
]
const SETTING_RESULTS = [
  ['themes','Themes and colour','Parchment, Midnight, AMOLED and accent colours'],['layout','App layout','Writer Studio, Visual Library or Compact'],['paper','Paper texture','Paper grain and intensity'],['font','Editor typography','Font size, line height and reading width'],['motion','Motion and animation','Reduce motion and interface effects'],['security','Lock & security','App lock, sessions and account security'],['sync','Sync','Cloud library, Discord and signed-in devices'],['keybinds','Keyboard shortcuts','View all MoonScribe keybinds'],['quick-capture','Quick capture','Save a note to a novel without leaving your current workspace'],['find-replace','Find and replace','Search and replace text in the active chapter']
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
  const { openSettings, settings, syncNow } = useApp()

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
     setResults({ actions: ACTIONS })
     setFlat(ACTIONS.map((r) => ({ group: 'actions', r })))
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
        setResults({ actions: ACTIONS })
        setFlat(ACTIONS.map((r) => ({ group: 'actions', r })))
        return
      }
      const res = await searchAll(query)
      res.actions = ACTIONS.filter((item) => `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase().includes(query.trim().toLowerCase()))
      res.settings = SETTING_RESULTS.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(query.trim().toLowerCase()))
      res.website = 'author website'.includes(query.trim().toLowerCase()) ? [{ id: 'author-website', title: 'Author Website', subtitle: 'Design and publish your public author profile' }] : []
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
       if (group === 'actions') {
         if (r.id === 'dashboard') navigate('/dashboard')
         else if (r.id === 'quick-capture') window.dispatchEvent(new CustomEvent('moonscribe:quick-capture-open'))
         else if (r.id === 'start-session') window.dispatchEvent(new CustomEvent('moonscribe:writing-session-start'))
         else if (r.id === 'sync') void syncNow?.()
         else openSettings()
         return
       }
      if (group === 'settings') {
        if (r.id === 'quick-capture') window.dispatchEvent(new CustomEvent('moonscribe:quick-capture-open'))
        else if (r.id === 'find-replace') window.dispatchEvent(new CustomEvent('moonscribe:find-replace-open'))
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
      if (group === 'website') { navigate('/author-website'); return }
      navigate(`/novel/${r.novelId}/${SECTION_FOR[group]}`)
    },
    [navigate, openSettings, syncNow]
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
    <div className="palette-overlay !items-start !bg-slate-950/70 !px-4 !pt-[12vh] backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="palette !w-full !max-w-2xl !overflow-hidden !rounded-2xl !border !border-white/10 !bg-[#15151b]/95 !shadow-[0_28px_100px_rgba(0,0,0,.55)]" role="dialog" aria-modal="true" aria-label="Search everything" onKeyDown={onKeyDown}>
        <div className="palette-input-row !h-16 !gap-3 !border-b !border-white/10 !px-5 !py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-300/10 text-amber-300"><Icon icon="fa-solid fa-wand-magic-sparkles" /></span>
          <input
            ref={inputRef}
            className="palette-input !h-10 !border-0 !bg-transparent !px-0 !text-base !text-stone-100 !shadow-none focus:!ring-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chapters, characters, notes, worldbuilding…"
            aria-label="Search everything"
          />
          <kbd className="palette-kbd !rounded-md !border !border-white/10 !bg-white/5 !px-2 !py-1 !text-[10px] !text-stone-400">Esc</kbd>
        </div>
        <div className="palette-body !max-h-[min(62vh,560px)] !space-y-4 !p-3">
           {!hasQuery && <div className="palette-hint !rounded-xl !border !border-amber-300/10 !bg-amber-300/[.04] !px-4 !py-3 !text-xs !text-stone-400"><Icon icon="fa-solid fa-lightbulb" className="mr-2 text-amber-300" /> Search your stories or choose an action. <kbd>↑</kbd><kbd>↓</kbd> to move, <kbd>Enter</kbd> to open.</div>}
           {hasQuery && total === 0 ? (
             <div className="palette-hint !rounded-xl !border !border-white/10 !bg-white/[.03] !px-4 !py-10 !text-center !text-sm !text-stone-400"><Icon icon="fa-solid fa-moon" className="mb-3 text-2xl text-amber-300/70" /><br />Nothing found for “{query}”.</div>
           ) : (
            <div className="palette-groups">
              {GROUPS.map((g) => {
                const groupItems = results?.[g.key] || []
                if (!groupItems.length) return null
                return (
                  <div className="palette-group !space-y-1" key={g.key}>
                    <div className="palette-group-label !px-3 !pb-1 !text-[10px] !font-semibold !uppercase !tracking-[.16em] !text-stone-500">
                      <Icon icon={g.icon} className="mr-2 !text-amber-300/80" /> {g.label}
                    </div>
                    {groupItems.map((r) => {
                      const index = flat.findIndex((f) => f.group === g.key && f.r.id === r.id)
                      return (
                        <button
                          key={`${g.key}:${r.id}`}
                          className={`palette-item !rounded-xl !border !border-transparent !px-3 !py-3 !transition-colors ${index === active ? 'active !border-amber-300/20 !bg-amber-300/[.08]' : 'hover:!border-white/10 hover:!bg-white/[.04]'}`}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => go(g.key, r)}
                        >
                          <span className="palette-item-title !text-sm !font-medium !text-stone-100">{highlight(r.title || 'Untitled', r.match || query)}</span>
                          {r.subtitle && <span className="palette-item-sub">{r.subtitle}</span>}
                          {r.preview && <span className="palette-item-preview">{highlight(r.preview, r.match || query)}</span>}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-2.5 text-[10px] uppercase tracking-[.12em] text-stone-500">
          <span><Icon icon="fa-solid fa-sparkles" className="mr-2 text-amber-300/70" />MoonScribe command centre</span>
          <span><kbd className="mr-1 rounded border border-white/10 px-1.5 py-0.5">↑↓</kbd> navigate <kbd className="ml-2 mr-1 rounded border border-white/10 px-1.5 py-0.5">↵</kbd> open</span>
        </div>
      </div>
    </div>,
    document.body
  )
}

function highlight(text, query) {
  const value = String(text || '')
  const q = String(query || '').trim()
  if (!q) return value
  const parts = value.split(new RegExp(`(${escapeRegExp(q)})`, 'ig'))
  return parts.map((part, index) => part.toLowerCase() === q.toLowerCase() ? <mark key={index}>{part}</mark> : part)
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
