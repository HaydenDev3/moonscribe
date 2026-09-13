import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Book3D, type BookRecord } from './Book3D'
import './books.css'
import BookShelf3D from './BookShelf3D'

export default function BookShelf({ books, counts = {}, compact = false, publicMode = false, initialView = 'shelf', showViewToggle = true }: { books: BookRecord[]; counts?: Record<string, any>; compact?: boolean; publicMode?: boolean; initialView?: 'shelf' | 'list'; showViewToggle?: boolean }) {
  const navigate = useNavigate(); const [active, setActive] = useState<string | null>(null); const [hovered, setHovered] = useState<string | null>(null); const [view, setView] = useState<'shelf' | 'list'>(initialView)
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === 'Escape' && setActive(null); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [])
  const normalized = useMemo(() => books.map((book) => { const key = book.id || book.novelId || ''; const count = counts[key] || counts[book.novelId || ''] || {}; return { ...book, id: key, words: Number(count.words ?? count.wordCount ?? book.words ?? 0), chapters: Number(count.chapters ?? count.chapterCount ?? book.chapters ?? 0) } }), [books, counts])
  const selected = normalized.find((book) => (book.id || book.novelId) === active) || null
  const open = (book: BookRecord) => { if (active === (book.id || book.novelId)) { if (publicMode && book.url) window.open(book.url, '_blank', 'noopener,noreferrer'); else if (publicMode && book.novelId) navigate(`/novel/${book.novelId}?mode=read`); else if (!publicMode && book.novelId) navigate(`/novel/${book.novelId}`) } else setActive(book.id || book.novelId || null) }
  const activeBook = selected || normalized.find((book) => (book.id || book.novelId) === hovered) || null
  return <div className={`book-shelf-shell ${compact ? 'is-compact' : ''} ${publicMode ? 'is-public' : ''}`}>
     <div className="book-shelf-toolbar" role="toolbar" aria-label="Library view">
       <span className="book-shelf-toolbar-label">{normalized.length} {normalized.length === 1 ? 'book' : 'books'}</span>
       {showViewToggle && <div className="book-shelf-view-toggle">
         <button type="button" className={view === 'shelf' ? 'active' : ''} onClick={() => setView('shelf')} aria-pressed={view === 'shelf'}><span aria-hidden="true">✦</span> Shelf</button>
         <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-pressed={view === 'list'}><span aria-hidden="true">☷</span> List</button>
       </div>}
    </div>
    {view === 'shelf' ? <><BookShelf3D books={normalized} activeId={active || hovered} onHover={setHovered} onSelect={open} /><div className="book-shelf-line" aria-hidden="true"><i /></div></> : <div className="book-library-list" aria-label="Book list">{normalized.map((book) => { const id = book.id || book.novelId || ''; return <button type="button" className={`book-library-list-item ${active === id ? 'active' : ''}`} key={id} onClick={() => open(book)}><span className="book-library-list-swatch" style={{ background: book.coverDesign?.frontColor || '#334452' }} /><span className="book-library-list-copy"><strong>{book.title || 'Untitled story'}</strong><small>{Number(book.words || 0).toLocaleString()} words · {book.chapters || 0} chapters</small></span><span className="book-library-list-status">{book.status || (book.collection === 'finished' ? 'Published' : 'Draft')}</span><span aria-hidden="true">→</span></button> })}</div>}
    {activeBook && <section className="book-detail" aria-live="polite"><div className="book-detail-object"><Book3D book={activeBook} selected={!!selected} expanded /></div><div className="book-detail-copy"><span className="eyebrow">{activeBook.series || (publicMode ? 'Featured publication' : 'From your library')}</span><h3>{activeBook.title}</h3><p className="book-detail-meta">{activeBook.author || 'Your manuscript'} · {activeBook.status || (activeBook.collection === 'finished' ? 'Published' : 'Draft')}</p><p>{activeBook.description || activeBook.blurb || 'A story in progress, waiting for its next page.'}</p><div className="book-detail-stats"><span>{Number(activeBook.words || 0).toLocaleString()} words</span><span>{activeBook.chapters || 0} chapters</span></div><button className="button button-primary" type="button" onClick={() => activeBook.novelId && navigate(`/novel/${activeBook.novelId}`)}>{publicMode ? 'Learn more' : 'Continue writing'}</button>{selected && <button className="button button-quiet" type="button" onClick={() => setActive(null)}>Return to shelf</button>}</div></section>}
  </div>
}
