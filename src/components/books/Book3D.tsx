import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'

export type BookRecord = {
  id?: string; novelId?: string; title?: string; author?: string; blurb?: string; description?: string
  cover?: string; coverDesign?: { frontImage?: string; spineImage?: string; backImage?: string; frontColor?: string; spineColor?: string; backColor?: string }; coverStyle?: string; collection?: string; status?: string; series?: string | null
  genres?: string[]; updatedAt?: number; lastOpened?: number; words?: number; chapters?: number; url?: string
}

const COLORS: Record<string, string> = { moonstone: '#273845', night: '#22252d', rose: '#704c58', forest: '#334d46', amber: '#70522e' }

export function Book3D({ book, selected = false, expanded = false, variant = 'full', onSelect }: { book: BookRecord; selected?: boolean; expanded?: boolean; variant?: 'compact' | 'full'; onSelect?: () => void }) {
  const [cover, setCover] = useState(book.cover)
  useEffect(() => { setCover(book.cover) }, [book.cover])
  const color = COLORS[book.coverStyle || ''] || book.coverStyle || '#334452'
  const title = book.title || 'Untitled book'
  const author = book.author || 'MoonScribe author'
  const state = book.status || (book.collection === 'finished' ? 'Published' : book.collection === 'in-progress' ? 'In progress' : 'Draft')
  const aria = `Open ${title}${author ? ` by ${author}` : ''}`
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.() } }
  const coverStyle = useMemo(() => cover ? { backgroundImage: `linear-gradient(145deg,rgba(0,0,0,.05),rgba(0,0,0,.35)),url(${cover})` } : undefined, [cover])
  return <button type="button" className={`book3d-button ${selected ? 'is-selected' : ''} ${expanded ? 'is-expanded' : ''} ${variant === 'compact' ? 'is-compact' : ''}`} aria-label={aria} aria-pressed={selected} onClick={onSelect} onKeyDown={onKeyDown}>
    <span className="book3d" style={{ ['--book-color' as string]: color }}>
      <span className="book3d-pages" /><span className="book3d-back" />
      <span className="book3d-spine"><b>{title}</b><small>{book.series ? `${book.series} · ` : ''}{author}</small>{state === 'Draft' && <i className="book3d-marker marker-bookmark" />}{state === 'Completed' || state === 'Published' ? <i className="book3d-marker marker-ribbon" /> : null}</span>
      <span className="book3d-cover" style={coverStyle}><b>{title}</b><small>{author}</small>{!cover && <em>{(book.genres || ['Story'])[0]}</em>}</span>
    </span>
  </button>
}
