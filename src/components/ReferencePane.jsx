import { useCallback, useEffect, useState } from 'react'
import { listNotes } from '../db/notes'
import { listCharacters } from '../db/characters'
import { listWorld } from '../db/world'
import Icon from './Icon'
import { timeAgo } from '../utils/dates'
import { sanitizeStoredHtml } from '../utils/formatHtml'

const TABS = [
  { key: 'notes', label: 'Notes', icon: 'fa-regular fa-note-sticky' },
  { key: 'characters', label: 'Characters', icon: 'fa-solid fa-user' },
  { key: 'world', label: 'World', icon: 'fa-solid fa-globe' }
]

const KIND_LABEL = { place: 'Place', faction: 'Faction', item: 'Artefact', lore: 'Lore', timeline: 'Timeline' }

export default function ReferencePane({ novelId }) {
  const [tab, setTab] = useState('notes')
  const [data, setData] = useState({ notes: [], characters: [], world: [] })
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    const [notes, characters, world] = await Promise.all([listNotes(novelId), listCharacters(novelId), listWorld(novelId)])
    setData({ notes, characters, world })
  }, [novelId])

  useEffect(() => {
    load()
  }, [load])

  const pick = (item) => setSelected(item)

  const list = data[tab]
  const selectedKey = selected?.id || null

  const renderItem = (item) => {
    const title = item.title || item.name || 'Untitled'
    const sub =
      tab === 'notes'
        ? timeAgo(item.updatedAt || item.createdAt)
        : tab === 'characters'
          ? item.role || 'a character'
          : `${KIND_LABEL[item.kind] || item.kind}`
    return (
      <button
        key={item.id}
        className={`ref-item ${selectedKey === item.id ? 'active' : ''}`}
        onClick={() => pick(item)}
      >
        <span className="ref-item-title">{title}</span>
        <span className="ref-item-sub">{sub}</span>
      </button>
    )
  }

  const text = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const detail = sanitizeStoredHtml(selected
    ? tab === 'notes'
      ? selected.content || '<p class="muted">No words yet.</p>'
      : tab === 'characters'
        ? [selected.role && `<p><b>Role.</b> ${text(selected.role)}</p>`, selected.appearance && `<p><b>Appearance.</b> ${text(selected.appearance)}</p>`, selected.personality && `<p><b>Personality.</b> ${text(selected.personality)}</p>`, selected.notes && `<p>${text(selected.notes)}</p>`].filter(Boolean).join('') || '<p class="muted">No notes yet.</p>'
        : [selected.summary && `<p>${text(selected.summary)}</p>`, selected.details && `<p>${text(selected.details)}</p>`].filter(Boolean).join('') || '<p class="muted">No notes yet.</p>'
    : '')

  return (
    <aside className="reference-pane">
      <div className="ref-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`ref-tab ${tab === t.key ? 'active' : ''}`} onClick={() => { setTab(t.key); setSelected(null) }}>
            <Icon icon={t.icon} style={{ marginRight: 5 }} /> {t.label}
          </button>
        ))}
      </div>
      <div className="ref-body">
        {list.length === 0 ? (
          <p className="muted small" style={{ padding: 16 }}>Nothing here yet.</p>
        ) : (
          <div className="ref-list">{list.map(renderItem)}</div>
        )}
      </div>
      {selected && (
        <div className="ref-detail">
          <div className="ref-detail-head">
            <strong>{selected.title || selected.name}</strong>
            <button className="button button-quiet" onClick={() => setSelected(null)} aria-label="Close reference">
              <Icon icon="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="ref-detail-body" dangerouslySetInnerHTML={{ __html: detail }} />
        </div>
      )}
    </aside>
  )
}
