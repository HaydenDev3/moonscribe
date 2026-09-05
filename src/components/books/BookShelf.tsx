import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Book3D, type BookRecord } from './Book3D'
import './books.css'
import BookShelf3D from './BookShelf3D'

export default function BookShelf({ books, counts = {}, compact = false, publicMode = false }: { books: BookRecord[]; counts?: Record<string, any>; compact?: boolean; publicMode?: boolean }) {
  const navigate = useNavigate(); const [active, setActive] = useState<string | null>(null); const [hovered, setHovered] = useState<string | null>(null)
  const selected = books.find((book) => (book.id || book.novelId) === active) || null
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === 'Escape' && setActive(null); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [])
  const normalized = useMemo(() => books.map((book) => { const key = book.id || book.novelId || ''; const count = counts[key] || counts[book.novelId || ''] || {}; return { ...book, id: key, words: Number(count.words ?? count.wordCount ?? book.words ?? 0), chapters: Number(count.chapters ?? count.chapterCount ?? book.chapters ?? 0) } }), [books, counts])
  const open = (book: BookRecord) => { if (active === (book.id || book.novelId)) { if (publicMode && book.url) window.open(book.url, '_blank', 'noopener,noreferrer'); else if (publicMode && book.novelId) navigate(`/novel/${book.novelId}?mode=read`); else if (!publicMode && book.novelId) navigate(`/novel/${book.novelId}`) } else setActive(book.id || book.novelId || null) }
  const activeBook = selected || normalized.find((book) => (book.id || book.novelId) === hovered) || null
  return <div className={`book-shelf-shell ${compact ? 'is-compact' : ''} ${publicMode ? 'is-public' : ''}`}>
    <BookShelf3D books={normalized} activeId={active || hovered} onHover={setHovered} onSelect={open} />
    <div className="book-shelf-line" aria-hidden="true"><i /></div>
    {activeBook && <section className="book-detail" aria-live="polite"><div className="book-detail-object"><Book3D book={activeBook} selected={!!selected} expanded /></div><div className="book-detail-copy"><span className="eyebrow">{activeBook.series || (publicMode ? 'Featured publication' : 'From your library')}</span><h3>{activeBook.title}</h3><p className="book-detail-meta">{activeBook.author || 'Your manuscript'} · {activeBook.status || (activeBook.collection === 'finished' ? 'Published' : 'Draft')}</p><p>{activeBook.description || activeBook.blurb || 'A story in progress, waiting for its next page.'}</p><div className="book-detail-stats"><span>{Number(activeBook.words || 0).toLocaleString()} words</span><span>{activeBook.chapters || 0} chapters</span></div><button className="button button-primary" type="button" onClick={() => activeBook.novelId && navigate(`/novel/${activeBook.novelId}`)}>{publicMode ? 'Learn more' : 'Continue writing'}</button>{selected && <button className="button button-quiet" type="button" onClick={() => setActive(null)}>Return to shelf</button>}</div></section>}
  </div>
}
