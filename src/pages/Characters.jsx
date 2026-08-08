import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getNovel } from '../db/novels'
import { listChapters } from '../db/chapters'
import {
  listCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  characterColors
} from '../db/characters'
import { useApp } from '../context/AppContext'
import SubPageTopbar from '../components/SubPageTopbar'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import { useContextMenu } from '../components/ContextMenu'
import Icon from '../components/Icon'
import { autoChapterMentions } from '../utils/mentions'

function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function Characters({ novelId, embedded }) {
  const { id } = useParams()
  const nid = novelId || id
  const { toast } = useApp()
  const [novel, setNovel] = useState(null)
  const [characters, setCharacters] = useState([])
  const [chapters, setChapters] = useState([])
  const [editing, setEditing] = useState(null) // character object or {__new:true}
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setNovel(await getNovel(nid))
    setCharacters(await listCharacters(nid))
    setChapters(await listChapters(nid))
  }, [nid])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!editing) return
    if (editing.__new) {
      await createCharacter(nid, editing)
      toast(`${editing.name || 'A character'} joined the story.`)
    } else {
      await updateCharacter(editing.id, editing)
      toast('Character updated.')
    }
    setEditing(null)
    load()
  }

  const remove = async () => {
    await deleteCharacter(deleting.id)
    setDeleting(null)
    load()
    toast('Character set free.')
  }

  const chapterName = (cid) => chapters.find((c) => c.id === cid)?.title || 'Untitled'

  // Auto-detected appearances from the manuscript, merged with hand-pinned ones.
  const mentionMap = autoChapterMentions(chapters, characters)

  const { openContextMenu } = useContextMenu()
  const cardMenu = (e, c) =>
    openContextMenu(e, [
      { label: 'Edit character', icon: 'fa-solid fa-pen', onClick: () => setEditing({ ...c }) },
      { label: 'Delete character', icon: 'fa-solid fa-trash', danger: true, onClick: () => setDeleting(c) }
    ])

  return (
    <div className={embedded ? undefined : 'app'}>
      {!embedded && novel && <SubPageTopbar novel={novel} title="Characters" />}
      <div className="page page-wide">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
          <h2 style={{ margin: 0 }}>Characters</h2>
          <button className="button button-primary" onClick={() => setEditing({ __new: true, name: '', role: '', appearance: '', personality: '', notes: '', customFields: [], chapterIds: [], color: characterColors()[0] })}>
            <Icon icon="fa-solid fa-plus" style={{ marginRight: 6 }} /> Add character
          </button>
        </div>

        {characters.length === 0 ? (
          <EmptyState icon="fa-solid fa-user" title="Every story needs its people" action={<button className="button button-primary" onClick={() => setEditing({ __new: true, name: '', role: '', appearance: '', personality: '', notes: '', customFields: [], chapterIds: [], color: characterColors()[0] })}>Meet the first one</button>}>
            Names, faces, secrets — they’ll keep themselves here. Add a character when one walks in.
          </EmptyState>
        ) : (
          <div className="card-grid">
            {characters.map((c) => (
              <div className="card character-card" key={c.id} onContextMenu={(e) => cardMenu(e, c)}>
                <div className="name-row">
                  <span className="character-avatar" style={{ background: c.color || '#D4A5A5' }}>{initials(c.name)}</span>
                  <div>
                    <h3 style={{ margin: 0 }}>{c.name}</h3>
                    {c.role && <div className="sub">{c.role}</div>}
                  </div>
                </div>
                {c.appearance && <p className="body" style={{ marginTop: 'var(--space-3)' }}><span className="muted small">Looks: </span>{c.appearance}</p>}
                {c.personality && <p className="body"><span className="muted small">Soul: </span>{c.personality}</p>}
                {c.notes && <p className="body"><span className="muted small">Notes: </span>{c.notes}</p>}
                {c.customFields?.filter((f) => f.label && f.value).length > 0 && (
                  <div className="field-list">
                    {c.customFields.filter((f) => f.label && f.value).map((f, i) => (
                      <div className="kv" key={i}><b>{f.label}</b><span>{f.value}</span></div>
                    ))}
                  </div>
                )}
                {(mentionMap[c.id]?.length || 0) > 0 && (
                  <div className="character-tags">
                    {mentionMap[c.id].slice(0, 6).map((cid) => (
                      <span className="tag" key={cid} title={c.chapterIds?.includes(cid) ? 'Pinned by hand' : 'Found automatically in the text'}>{chapterName(cid)}</span>
                    ))}
                    {mentionMap[c.id].length > 6 && <span className="tag">+{mentionMap[c.id].length - 6} more</span>}
                  </div>
                )}
                {(c.chapterIds?.length || 0) > (mentionMap[c.id]?.length || 0) && (
                  <div className="small muted" style={{ marginTop: 4 }}>Auto-tracking stays in sync as you write.</div>
                )}
                <div className="card-actions">
                  <button className="button button-quiet" onClick={() => setEditing({ ...c })}>Edit</button>
                  <button className="button button-quiet" onClick={() => setDeleting(c)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <CharacterModal
          character={editing}
          chapters={chapters}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={save}
          isNew={!!editing.__new}
        />
      )}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="Let this character go?">
        “{deleting?.name}” will be removed from this novel’s world.
      </ConfirmDialog>
    </div>
  )
}

function CharacterModal({ character, chapters, onChange, onClose, onSave, isNew }) {
  const set = (patch) => onChange({ ...character, ...patch })

  const addField = () => set({ customFields: [...(character.customFields || []), { label: '', value: '' }] })

  return (
    <Modal open onClose={onClose} title={isNew ? 'A new character' : character.name} width={560}>
      <div className="field">
        <label>Name</label>
        <input value={character.name || ''} onChange={(e) => set({ name: e.target.value })} autoFocus />
      </div>
      <div className="field">
        <label>Role <span className="hint">(optional)</span></label>
        <input value={character.role || ''} onChange={(e) => set({ role: e.target.value })} placeholder="The lighthouse keeper’s daughter" />
      </div>
      <div className="field">
        <label>Appearance</label>
        <textarea value={character.appearance || ''} onChange={(e) => set({ appearance: e.target.value })} placeholder="What would you notice first?" />
      </div>
      <div className="field">
        <label>Personality</label>
        <textarea value={character.personality || ''} onChange={(e) => set({ personality: e.target.value })} placeholder="Quiet, stubborn, kind in private…" />
      </div>
      <div className="field">
        <label>Notes</label>
        <textarea value={character.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Their secret, their fear, what they want…" />
      </div>

      <div className="field">
        <label>Colour <span className="hint">(used for their name in the text)</span></label>
        <div className="swatch-row">
          {characterColors().map((c) => (
            <button key={c} className={`swatch ${character.color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => set({ color: c })} aria-label={c} />
          ))}
        </div>
      </div>

      <div className="field">
        <label>Appears in <span className="hint">(optional)</span></label>
        {chapters.length === 0 ? (
          <p className="small muted">No chapters yet — add some first.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {chapters.map((c) => {
              const on = (character.chapterIds || []).includes(c.id)
              return (
                <span key={c.id} className={`tag ${on ? 'tag-on' : ''}`} style={on ? { background: 'var(--accent-fill)', color: 'var(--accent-fg)', cursor: 'pointer' } : { cursor: 'pointer' }} onClick={() => {
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

      <div className="field">
        <label>Custom details</label>
        {(character.customFields || []).map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input style={{ flex: 1 }} value={f.label} placeholder="Label (e.g. Birthday)" onChange={(e) => {
              const arr = [...character.customFields]
              arr[i] = { ...arr[i], label: e.target.value }
              set({ customFields: arr })
            }} />
            <input style={{ flex: 2 }} value={f.value} placeholder="Value" onChange={(e) => {
              const arr = [...character.customFields]
              arr[i] = { ...arr[i], value: e.target.value }
              set({ customFields: arr })
            }} />
            <button className="button button-quiet" onClick={() => set({ customFields: character.customFields.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <button className="button button-ghost" onClick={addField}>+ Add a detail</button>
      </div>

      <div className="modal-foot">
        <button className="button button-ghost" onClick={onClose}>Cancel</button>
        <button className="button button-primary" onClick={onSave}>{isNew ? 'Welcome them in' : 'Save changes'}</button>
      </div>
    </Modal>
  )
}
