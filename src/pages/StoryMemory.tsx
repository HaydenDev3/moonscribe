import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listChapters } from '../db/chapters'
import { listCharacters } from '../db/characters'
import { autoChapterMentions } from '../utils/mentions'
import Icon from '../components/Icon'

export default function StoryMemory({ novelId, embedded = false }) {
  const { id } = useParams()
  const nid = novelId || id
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const [chapters, characters] = await Promise.all([listChapters(nid), listCharacters(nid)])
    const mentions = autoChapterMentions(chapters, characters)
    const chapterIndex = new Map(chapters.map((chapter, index) => [chapter.id, { chapter, index }]))
    setRows(characters.map((character) => {
      const found = (mentions[character.id] || []).map((chapterId) => chapterIndex.get(chapterId)).filter(Boolean)
      return { character, count: found.length, first: found[0]?.chapter, last: found[found.length - 1]?.chapter, chapters: found.map((item) => item.chapter) }
    }).sort((a, b) => b.count - a.count || (a.character.name || '').localeCompare(b.character.name || '')))
    setLoading(false)
  }, [nid])

  useEffect(() => { void load() }, [load])
  const visibleRows = useMemo(() => rows.filter(({ character, count }) => {
    const matches = `${character.name || ''} ${character.role || ''} ${(character.aliases || []).join(' ')}`.toLowerCase().includes(query.toLowerCase())
    return matches && (filter === 'all' || filter === 'unseen' && count === 0 || filter === 'active' && count > 0)
  }), [filter, query, rows])
  const unseen = rows.filter((row) => row.count === 0).length

  return <div className={embedded ? undefined : 'app'}><div className="page page-wide story-memory-page">
    <header className="story-memory-header"><div><span className="eyebrow">Manuscript intelligence</span><h2>Story Memory</h2><p className="muted">A private, offline map of where your characters live in the manuscript.</p></div><button className="button button-ghost" onClick={() => void load()} disabled={loading}><Icon icon="fa-solid fa-rotate" /> {loading ? 'Reading…' : 'Refresh'}</button></header>
    {loading ? <p className="muted">Reading the manuscript…</p> : !rows.length ? <p className="muted">Add a character profile to begin building story memory.</p> : <><div className="story-memory-toolbar"><label><Icon icon="fa-solid fa-magnifying-glass" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search characters…" aria-label="Search Story Memory" /></label><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter Story Memory"><option value="all">All characters</option><option value="active">Seen in manuscript</option><option value="unseen">Not yet seen ({unseen})</option></select></div><div className="story-memory-grid">{visibleRows.map(({ character, count, first, last, chapters }) => <article className={`story-memory-card${count === 0 ? ' is-unseen' : ''}`} key={character.id}><div className="story-memory-card-head"><span className="story-memory-avatar">{(character.name || '?').slice(0, 2).toUpperCase()}</span><div><h3>{character.name || 'Unnamed character'}</h3><span className="muted small">{character.role || 'Role not set'}{character.aliases?.length ? ` · also ${character.aliases.join(', ')}` : ''}</span></div><strong>{count}<small> chapters</small></strong></div><div className="story-memory-meta"><span>First seen <b>{first?.title || 'Not in manuscript'}</b></span><span>Last seen <b>{last?.title || 'Not in manuscript'}</b></span></div><div className="story-memory-chapters">{chapters.slice(0, 6).map((chapter) => <button key={chapter.id} onClick={() => navigate(`/novel/${nid}`, { state: { chapterId: chapter.id } })}>{chapter.title || 'Untitled chapter'} <Icon icon="fa-solid fa-arrow-right" /></button>)}{!chapters.length && <span className="muted small">No chapter evidence yet.</span>}{chapters.length > 6 && <span className="muted small">+ {chapters.length - 6} more chapters</span>}</div></article>)}{!visibleRows.length && <p className="muted">No characters match this filter.</p>}</div></>}
  </div></div>
}
