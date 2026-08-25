import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getNovel } from '../db/novels'
import { listChapters } from '../db/chapters'
import {
  listCharacters,
  createCharacter,
  updateCharacter,
  trashCharacter,
  characterColors
} from '../db/characters'
import { listRelationships } from '../db/relationships'
import { useApp } from '../context/AppContext'
import SubPageTopbar from '../components/SubPageTopbar'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import { useContextMenu } from '../components/ContextMenu'
import Icon from '../components/Icon'
import { autoChapterMentions } from '../utils/mentions'
import { useDraftRecovery, readDraft, draftKey } from '../utils/draftRecovery'

function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function colorToGradient(hex) {
  if (!hex) return 'linear-gradient(135deg, #4a3f6b 0%, #2a1f4b 100%)'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const darker = `rgb(${Math.max(0, r - 60)},${Math.max(0, g - 60)},${Math.max(0, b - 60)})`
  return `linear-gradient(135deg, ${hex} 0%, ${darker} 100%)`
}

const TABS = ['Profile', 'Description', 'Story', 'Details']

export default function Characters({ novelId, embedded }) {
  const { id } = useParams()
  const nid = novelId || id
  const { toast } = useApp()
  const [novel, setNovel] = useState(null)
  const [characters, setCharacters] = useState([])
  const [chapters, setChapters] = useState([])
  const [relationships, setRelationships] = useState([])
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const load = useCallback(async () => {
    setNovel(await getNovel(nid))
    const [nextCharacters, nextChapters, nextRelationships] = await Promise.all([listCharacters(nid), listChapters(nid), listRelationships(nid)])
    setCharacters(nextCharacters)
    setChapters(nextChapters)
    setRelationships(nextRelationships)
  }, [nid])

  useEffect(() => { load() }, [load])

  const newCharDraftKey = draftKey(nid, 'character', 'new')

  const blankChar = () => ({
    __new: true, name: '', aliases: [], role: '', age: '', gender: '', species: '',
    occupation: '', appearance: '', personality: '', bio: '', motivation: '', arc: '',
    notes: '', customFields: [], chapterIds: [], color: characterColors()[0], portrait: null,
  })

  const openNewCharacter = () => {
    const saved = readDraft(newCharDraftKey)
    const base = blankChar()
    if (saved && (saved.name || saved.role || saved.appearance || saved.personality || saved.notes)) {
      setDraftRestored(true)
      setEditing({ ...base, ...saved, __new: true })
    } else {
      setDraftRestored(false)
      setEditing(base)
    }
  }

  const save = async (clearDraftFn) => {
    if (!editing) return
    if (editing.__new) {
      await createCharacter(nid, editing)
      toast(`${editing.name || 'A character'} joined the story.`)
    } else {
      await updateCharacter(editing.id, editing)
      toast('Character updated.')
    }
    clearDraftFn?.()
    setEditing(null)
    setDraftRestored(false)
    load()
  }

  const cancelEditing = (clearDraftFn) => {
    clearDraftFn?.()
    setEditing(null)
    setDraftRestored(false)
  }

  const remove = async () => {
    await trashCharacter(deleting.id)
    setDeleting(null)
    load()
    toast('Moved to the Trash — recoverable for 30 days.')
  }

  const chapterName = (cid) => chapters.find((c) => c.id === cid)?.title || 'Untitled'
  const mentionMap = useMemo(() => autoChapterMentions(chapters, characters), [chapters, characters])
  const { openContextMenu } = useContextMenu()

  const cardMenu = (e, c) =>
    openContextMenu(e, [
      { label: 'Edit character',   icon: 'fa-solid fa-pen',   onClick: () => setEditing({ ...c }) },
      { label: 'Delete character', icon: 'fa-solid fa-trash', danger: true, onClick: () => setDeleting(c) }
    ])

  const roles = [...new Set(characters.map((c) => c.role).filter(Boolean))]

  const filtered = characters.filter((c) => {
    const q = search.toLowerCase()
    if (roleFilter && c.role !== roleFilter) return false
    if (!q) return true
    return (
      c.name?.toLowerCase().includes(q) ||
      c.role?.toLowerCase().includes(q) ||
      c.appearance?.toLowerCase().includes(q) ||
      c.personality?.toLowerCase().includes(q) ||
      c.bio?.toLowerCase().includes(q) ||
      c.notes?.toLowerCase().includes(q) ||
      c.motivation?.toLowerCase().includes(q) ||
      c.aliases?.some((a) => a.toLowerCase().includes(q))
    )
  })
  const pairedCharacters = useMemo(() => {
    const groups = new Map()
    relationships.forEach((relationship) => {
      if (!relationship.a || !relationship.b || relationship.a === relationship.b) return
      const current = [...(groups.get(relationship.a) || []), relationship.b, relationship.a]
      current.forEach((id) => groups.set(id, [...new Set(current)]))
    })
    return [...filtered].sort((a, b) => {
      const aGroup = groups.get(a.id)
      const bGroup = groups.get(b.id)
      if (!aGroup && !bGroup) return 0
      if (!aGroup) return 1
      if (!bGroup) return -1
      return filtered.findIndex((item) => item.id === aGroup[0]) - filtered.findIndex((item) => item.id === bGroup[0])
    })
  }, [filtered, relationships])

  return (
    <div className={embedded ? undefined : 'app'}>
      {!embedded && novel && <SubPageTopbar novel={novel} title="Characters" />}
      <div className="page page-wide">

        {/* Header */}
        <div className="chars-header">
          <div>
            <h2 style={{ margin: 0 }}>Characters</h2>
            <p className="muted small" style={{ margin: '3px 0 0' }}>
              {characters.length} character{characters.length !== 1 ? 's' : ''}
              {filtered.length !== characters.length ? ` · ${filtered.length} shown` : ''}
            </p>
          </div>
          <button className="button button-primary" onClick={openNewCharacter}>
            <Icon icon="fa-solid fa-plus" style={{ marginRight: 6 }} /> Add character
          </button>
        </div>

        {/* Search + filter bar */}
        {characters.length > 0 && (
          <div className="chars-toolbar">
            <div className="chars-search">
              <Icon icon="fa-solid fa-magnifying-glass" className="chars-search-icon" />
              <input
                className="chars-search-input"
                placeholder="Search by name, role, appearance, notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="chars-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                  <Icon icon="fa-solid fa-xmark" />
                </button>
              )}
            </div>
            {roles.length > 1 && (
              <div className="chars-role-pills">
                <button className={`chars-role-pill ${!roleFilter ? 'active' : ''}`} onClick={() => setRoleFilter('')}>All</button>
                {roles.map((r) => (
                  <button key={r} className={`chars-role-pill ${roleFilter === r ? 'active' : ''}`} onClick={() => setRoleFilter(roleFilter === r ? '' : r)}>{r}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {characters.length === 0 ? (
          <EmptyState icon="fa-solid fa-users" title="Every story needs its people"
            action={<button className="button button-primary" onClick={openNewCharacter}>Meet the first one</button>}>
            Names, faces, secrets — they'll keep themselves here.
          </EmptyState>
        ) : filtered.length === 0 ? (
          <div className="chars-no-results">
            <Icon icon="fa-solid fa-magnifying-glass" style={{ fontSize: '1.4rem', opacity: 0.3 }} />
            <p className="muted">No characters match "{search || roleFilter}"</p>
          </div>
        ) : (
          <div className="chars-grid">
            {pairedCharacters.map((c, index) => (
              <CharCard
                key={c.id}
                style={{ ['--char-card-delay' as any]: `${Math.min(index, 12) * 55}ms` }}
                character={c}
                mentions={mentionMap[c.id] || []}
                chapterName={chapterName}
                onEdit={() => setEditing({ ...c })}
                onDelete={() => setDeleting(c)}
                onContextMenu={(e) => cardMenu(e, c)}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <CharacterModal
          character={editing}
          chapters={chapters}
          onChange={setEditing}
          onClose={cancelEditing}
          onSave={save}
          isNew={!!editing.__new}
          draftKey={editing.__new ? newCharDraftKey : draftKey(nid, 'character', editing.id)}
          draftRestored={draftRestored && !!editing.__new}
        />
      )}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="Let this character go?">
        "{deleting?.name}" will be removed from this novel's world.
      </ConfirmDialog>
    </div>
  )
}

function CharCard({ character: c, mentions, chapterName, onEdit, onDelete, onContextMenu, style }) {
  const gradient = colorToGradient(c.color)
  const hasMentions = mentions.length > 0

  return (
    <div className="char-card" style={style} onContextMenu={onContextMenu} onClick={onEdit} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onEdit()}>
      {/* Banner */}
      <div className="char-card-banner" style={{ background: gradient }}>
        {c.portrait && <img src={c.portrait} alt="" className="char-card-banner-img" />}
      </div>

      {/* Avatar */}
      <div className="char-card-avatar-wrap">
        {c.portrait
          ? <img src={c.portrait} alt={c.name} className="char-card-avatar char-card-avatar-img" />
          : <div className="char-card-avatar" style={{ background: c.color || '#D4A5A5' }}>{initials(c.name)}</div>
        }
      </div>

      <div className="char-card-body">
        <div className="char-card-name">{c.name || 'Unnamed'}</div>
        {c.role && <div className="char-card-role">{c.role}</div>}
        {(c.age || c.gender || c.species) && (
          <div className="char-card-stats">
            {c.age && <span>{c.age}</span>}
            {c.gender && <span>{c.gender}</span>}
            {c.species && <span>{c.species}</span>}
          </div>
        )}

        {(c.appearance || c.personality || c.bio) && (
          <p className="char-card-excerpt">
            {(c.bio || c.appearance || c.personality).slice(0, 100)}
            {(c.bio || c.appearance || c.personality).length > 100 ? '…' : ''}
          </p>
        )}

        {hasMentions && (
          <div className="char-card-chapters">
            {mentions.slice(0, 4).map((cid) => (
              <span key={cid} className="char-tag">{chapterName(cid)}</span>
            ))}
            {mentions.length > 4 && <span className="char-tag char-tag-more">+{mentions.length - 4}</span>}
          </div>
        )}
      </div>

      <div className="char-card-foot">
        <button className="char-card-btn" onClick={(e) => { e.stopPropagation(); onEdit() }}>
          <Icon icon="fa-solid fa-pen" /> Edit
        </button>
        <button className="char-card-btn char-card-btn-del" onClick={(e) => { e.stopPropagation(); onDelete() }}>
          <Icon icon="fa-solid fa-trash" />
        </button>
      </div>
    </div>
  )
}

function CharacterModal({ character, chapters, onChange, onClose, onSave, isNew, draftKey: dk, draftRestored }) {
  const { clearDraft } = useDraftRecovery(dk, character)
  const [tab, setTab] = useState(0)
  const portraitRef = useRef(null)
  const set = (patch) => onChange({ ...character, ...patch })

  const addField = () => set({ customFields: [...(character.customFields || []), { label: '', value: '' }] })

  const handlePortrait = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => set({ portrait: ev.target.result })
    reader.readAsDataURL(file)
  }

  const aliasStr = (character.aliases || []).join(', ')

  return (
    <Modal open onClose={() => onClose(clearDraft)} title={null} width={700}>
      {draftRestored && (
        <div className="draft-restored-banner">
          <Icon icon="fa-solid fa-rotate-left" /> Draft recovered — your unsaved work is back.
        </div>
      )}

      {/* Profile preview banner inside modal */}
      <div className="char-modal-banner" style={{ background: colorToGradient(character.color) }}>
        <div className="char-modal-avatar-wrap">
          <div
            className="char-modal-avatar"
            style={{ background: character.portrait ? 'transparent' : (character.color || '#D4A5A5') }}
            onClick={() => portraitRef.current?.click()}
            title="Click to upload portrait"
          >
            {character.portrait
              ? <img src={character.portrait} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff' }}>{initials(character.name || '?')}</span>
            }
            <div className="char-modal-avatar-overlay"><Icon icon="fa-solid fa-camera" /></div>
          </div>
          <input ref={portraitRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePortrait} />
          {character.portrait && (
            <button className="char-modal-remove-portrait" onClick={() => set({ portrait: null })} title="Remove portrait">
              <Icon icon="fa-solid fa-xmark" />
            </button>
          )}
        </div>
        <div className="char-modal-banner-name">
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
            {character.name || 'New character'}
          </span>
          {character.role && <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem' }}>{character.role}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="char-modal-tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`char-modal-tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* Tab: Profile */}
      {tab === 0 && (
        <div className="char-modal-section">
          <div className="field-row">
            <div className="field" style={{ flex: 2 }}>
              <label>Name</label>
              <input value={character.name || ''} onChange={(e) => set({ name: e.target.value })} autoFocus placeholder="Full name" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Age</label>
              <input value={character.age || ''} onChange={(e) => set({ age: e.target.value })} placeholder="e.g. 28" />
            </div>
          </div>
          <div className="field">
            <label>Also known as <span className="hint">(aliases, comma-separated)</span></label>
            <input value={aliasStr} onChange={(e) => set({ aliases: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="Mira, The Keeper, Red" />
          </div>
          <div className="field-row">
            <div className="field" style={{ flex: 1 }}>
              <label>Role / archetype</label>
              <input value={character.role || ''} onChange={(e) => set({ role: e.target.value })} placeholder="The reluctant hero" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Occupation</label>
              <input value={character.occupation || ''} onChange={(e) => set({ occupation: e.target.value })} placeholder="Lighthouse keeper" />
            </div>
          </div>
          <div className="field-row">
            <div className="field" style={{ flex: 1 }}>
              <label>Gender</label>
              <input value={character.gender || ''} onChange={(e) => set({ gender: e.target.value })} placeholder="She/her" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Species / origin</label>
              <input value={character.species || ''} onChange={(e) => set({ species: e.target.value })} placeholder="Human, Fae…" />
            </div>
          </div>
          <div className="field">
            <label>Highlight colour <span className="hint">(name highlighting in the manuscript)</span></label>
            <div className="swatch-row">
              {characterColors().map((c) => (
                <button key={c} className={`swatch ${character.color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => set({ color: c })} aria-label={c} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Description */}
      {tab === 1 && (
        <div className="char-modal-section">
          <div className="field">
            <label>Bio <span className="hint">(who they are at a glance)</span></label>
            <textarea rows={3} value={character.bio || ''} onChange={(e) => set({ bio: e.target.value })} placeholder="A weather-worn keeper with a secret she's kept for twenty years…" />
          </div>
          <div className="field">
            <label>Appearance</label>
            <textarea rows={3} value={character.appearance || ''} onChange={(e) => set({ appearance: e.target.value })} placeholder="What would a stranger notice first?" />
          </div>
          <div className="field">
            <label>Personality</label>
            <textarea rows={3} value={character.personality || ''} onChange={(e) => set({ personality: e.target.value })} placeholder="Quiet, stubborn, kind in private…" />
          </div>
          <div className="field">
            <label>Writer's notes</label>
            <textarea rows={2} value={character.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Their secret, their fear, what they really want…" />
          </div>
        </div>
      )}

      {/* Tab: Story */}
      {tab === 2 && (
        <div className="char-modal-section">
          <div className="field">
            <label>Motivation</label>
            <textarea rows={2} value={character.motivation || ''} onChange={(e) => set({ motivation: e.target.value })} placeholder="What do they want more than anything?" />
          </div>
          <div className="field">
            <label>Character arc</label>
            <textarea rows={2} value={character.arc || ''} onChange={(e) => set({ arc: e.target.value })} placeholder="Where do they start, and where do they end up?" />
          </div>
          <div className="field">
            <label>Appears in chapters <span className="hint">(optional — auto-tracked from the text)</span></label>
            {chapters.length === 0 ? (
              <p className="small muted">No chapters yet.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {chapters.map((c) => {
                  const on = (character.chapterIds || []).includes(c.id)
                  return (
                    <span key={c.id}
                      className={`tag ${on ? 'tag-on' : ''}`}
                      style={{ cursor: 'pointer', ...(on ? { background: 'var(--accent-fill)', color: 'var(--accent-fg)' } : {}) }}
                      onClick={() => {
                        const ids = character.chapterIds || []
                        set({ chapterIds: on ? ids.filter((x) => x !== c.id) : [...ids, c.id] })
                      }}>
                      {c.title || 'Untitled'}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Details */}
      {tab === 3 && (
        <div className="char-modal-section">
          <div className="field">
            <label>Custom details</label>
            {(character.customFields || []).map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input style={{ flex: 1 }} value={f.label} placeholder="Label (e.g. Birthday)"
                  onChange={(e) => { const arr = [...character.customFields]; arr[i] = { ...arr[i], label: e.target.value }; set({ customFields: arr }) }} />
                <input style={{ flex: 2 }} value={f.value} placeholder="Value"
                  onChange={(e) => { const arr = [...character.customFields]; arr[i] = { ...arr[i], value: e.target.value }; set({ customFields: arr }) }} />
                <button className="button button-quiet" onClick={() => set({ customFields: character.customFields.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="button button-ghost" onClick={addField}>+ Add a detail</button>
          </div>
        </div>
      )}

      <div className="modal-foot">
        <button className="button button-ghost" onClick={() => onClose(clearDraft)}>Cancel</button>
        <button className="button button-primary" onClick={() => onSave(clearDraft)}>
          {isNew ? 'Welcome them in' : 'Save changes'}
        </button>
      </div>
    </Modal>
  )
}
