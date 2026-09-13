import { useCallback, useEffect, useState } from 'react'
import { listNotes } from '../db/notes'
import { listCharacters } from '../db/characters'
import { listWorld } from '../db/world'
import { listChapters } from '../db/chapters'
import { listRelationships } from '../db/relationships'
import { autoChapterMentions } from '../utils/mentions'
import Icon from './Icon'
import { timeAgo } from '../utils/dates'
import { sanitizeStoredHtml } from '../utils/formatHtml'

const TABS = [
  { key: 'notes', label: 'Notes', icon: 'fa-regular fa-note-sticky' },
  { key: 'characters', label: 'Characters', icon: 'fa-solid fa-user' },
  { key: 'world', label: 'World', icon: 'fa-solid fa-globe' },
  { key: 'connections', label: 'Links', icon: 'fa-solid fa-diagram-project' },
]

const KIND_LABEL = { place: 'Place', faction: 'Faction', item: 'Artefact', lore: 'Lore', timeline: 'Timeline' }

export default function ReferencePane({ novelId, chapterId = null }) {
  const [tab, setTab] = useState('notes')
  const [data, setData] = useState({ notes: [], characters: [], world: [], connections: [] })
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    const [notes, characters, world, chapters, relationships] = await Promise.all([listNotes(novelId), listCharacters(novelId), listWorld(novelId), listChapters(novelId), listRelationships(novelId)])
    const mentions = autoChapterMentions(chapters, characters)
    const current = chapters.find((chapter) => chapter.id === chapterId)
    const connections = characters.map((character) => ({
      ...character,
      connectionKind: 'Character',
      chapterCount: mentions[character.id]?.length || 0,
      relationshipCount: relationships.filter((link) => link.a === character.id || link.b === character.id).length,
      inCurrentChapter: !!current && (mentions[character.id] || []).includes(current.id),
    })).filter((character) => !current || character.inCurrentChapter || character.relationshipCount)
    setData({ notes, characters, world, connections })
  }, [novelId, chapterId])

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
          : tab === 'connections'
            ? `${item.chapterCount} chapter${item.chapterCount === 1 ? '' : 's'} · ${item.relationshipCount} relationship${item.relationshipCount === 1 ? '' : 's'}`
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
        : tab === 'connections'
          ? `<p><b>${text(selected.name)}</b> appears in ${selected.chapterCount} chapter${selected.chapterCount === 1 ? '' : 's'} and has ${selected.relationshipCount} relationship${selected.relationshipCount === 1 ? '' : 's'}.</p>${selected.inCurrentChapter ? '<p class="ref-connected">Appears in the current chapter.</p>' : ''}`
        : tab === 'characters'
        ? [selected.role && `<p><b>Role.</b> ${text(selected.role)}</p>`, selected.appearance && `<p><b>Appearance.</b> ${text(selected.appearance)}</p>`, selected.personality && `<p><b>Personality.</b> ${text(selected.personality)}</p>`, selected.notes && `<p>${text(selected.notes)}</p>`].filter(Boolean).join('') || '<p class="muted">No notes yet.</p>'
        : [selected.summary && `<p>${text(selected.summary)}</p>`, selected.details && `<p>${text(selected.details)}</p>`].filter(Boolean).join('') || '<p class="muted">No notes yet.</p>'
    : '')

  return (
    <aside className="reference-pane" aria-label="Story references">
      <div className="ref-pane-heading"><div><span>Story bible</span><strong>References</strong></div><span>{list.length} {list.length === 1 ? 'item' : 'items'}</span></div>
      <div className="ref-tabs" role="tablist" aria-label="Reference types">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`ref-tab ${tab === t.key ? 'active' : ''}`} onClick={() => { setTab(t.key); setSelected(null) }}>
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
             <div><span>Selected reference</span><strong>{selected.title || selected.name}</strong></div>
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
