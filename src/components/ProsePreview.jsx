import { useCallback, useMemo, useRef, useState } from 'react'
import { annotateProse } from '../utils/highlight'
import { sanitizeStoredHtml } from '../utils/formatHtml'
import Icon from './Icon'

// The read-view manuscript: character names and glossary terms are underlined
// and, on hover, reveal a compact card (bio + relationships + appearances for
// characters; definition for terms). Clicking a card opens the full entry.
export default function ProsePreview({
  html,
  characters = [],
  terms = [],
  relationships = [],
  mentionsMap = {},
  onOpenCharacter,
  onOpenTerm,
  className = 'preview-prose'
}) {
  const [hover, setHover] = useState(null) // { kind, id, x, y }
  const closeTimer = useRef(null)

  const annotated = useMemo(
    () => annotateProse(sanitizeStoredHtml(html), { characters, terms }),
    [html, characters, terms]
  )

  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])
  const termById = useMemo(() => new Map(terms.map((t) => [t.id, t])), [terms])

  const openFor = useCallback((el) => {
    clearTimeout(closeTimer.current)
    const r = el.getBoundingClientRect()
    const kind = el.classList.contains('hl-name') ? 'name' : 'term'
    const id = kind === 'name' ? el.dataset.charId : el.dataset.termId
    if (!id) return
    setHover({ kind, id, x: r.left + r.width / 2, y: r.top, bottom: r.bottom })
  }, [])

  const scheduleClose = useCallback(() => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setHover(null), 160)
  }, [])

  const onOver = useCallback((e) => {
    const el = e.target.closest?.('.hl-name, .hl-term')
    if (el) openFor(el)
  }, [openFor])

  const onOut = useCallback((e) => {
    if (e.target.closest?.('.hl-name, .hl-term')) scheduleClose()
  }, [scheduleClose])

  const character = hover?.kind === 'name' ? charById.get(hover.id) : null
  const term = hover?.kind === 'term' ? termById.get(hover.id) : null

  const relsFor = (c) =>
    relationships.filter((r) => r.a === c.name || r.b === c.name).slice(0, 4)

  return (
    <div style={{ position: 'relative' }}>
      <div
        className={className}
        onMouseOver={onOver}
        onMouseOut={onOut}
        dangerouslySetInnerHTML={{ __html: annotated }}
      />

      {hover && (character || term) && (
        <div
          className="prose-hovercard"
          style={cardStyle(hover)}
          onMouseEnter={() => clearTimeout(closeTimer.current)}
          onMouseLeave={scheduleClose}
        >
          {character && (
            <>
              <div className="phc-head">
                <span
                  className="phc-avatar"
                  style={{ background: character.color || 'var(--rose)' }}
                >
                  {(character.name || '?').trim().charAt(0).toUpperCase()}
                </span>
                <div className="phc-titles">
                  <strong>{character.name || 'Unnamed'}</strong>
                  {character.role && <span className="phc-sub">{character.role}</span>}
                </div>
              </div>
              {(character.appearance || character.personality) && (
                <p className="phc-bio">{snippet(character.appearance || character.personality)}</p>
              )}
              {relsFor(character).length > 0 && (
                <div className="phc-rels">
                  {relsFor(character).map((r) => (
                    <span key={r.id} className="phc-rel">
                      <Icon icon="fa-regular fa-heart" />{' '}
                      {r.a === character.name ? r.b : r.a}
                      {r.description ? ` · ${snippet(r.description, 40)}` : ''}
                    </span>
                  ))}
                </div>
              )}
              <div className="phc-foot">
                <span className="phc-count">
                  {(mentionsMap[character.id]?.length || 0)} chapter
                  {(mentionsMap[character.id]?.length || 0) === 1 ? '' : 's'}
                </span>
                <button className="phc-open" onClick={() => onOpenCharacter?.(character)}>
                  Open profile
                </button>
              </div>
            </>
          )}

          {term && (
            <>
              <div className="phc-head">
                <span className="phc-term-kind">{term.category || 'term'}</span>
                <div className="phc-titles">
                  <strong>{term.term}</strong>
                  {term.pronunciation && <span className="phc-sub">/{term.pronunciation}/</span>}
                </div>
              </div>
              {term.definition && <p className="phc-bio">{snippet(term.definition, 220)}</p>}
              <div className="phc-foot">
                <span className="phc-count">Glossary</span>
                <button className="phc-open" onClick={() => onOpenTerm?.(term)}>
                  Open term
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function snippet(text, max = 160) {
  const t = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

// Position the card just above the hovered mark, clamped to the viewport.
function cardStyle(hover) {
  const width = 260
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const left = Math.min(Math.max(hover.x - width / 2, 12), vw - width - 12)
  const openBelow = hover.y < 220
  return {
    position: 'fixed',
    left,
    width,
    zIndex: 90,
    ...(openBelow ? { top: hover.bottom + 8 } : { bottom: `calc(100vh - ${hover.y - 8}px)` })
  }
}
