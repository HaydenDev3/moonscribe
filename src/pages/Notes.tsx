import { useCallback, useEffect, useState } from 'react'
import { useDraftRecovery, readDraft, draftKey } from '../utils/draftRecovery'
import { useParams } from 'react-router-dom'
import { getNovel } from '../db/novels'
import { listChapters } from '../db/chapters'
import { listCharacters } from '../db/characters'
import { listNotes, createNote, updateNote, trashNote } from '../db/notes'
import { useApp } from '../context/AppContext'
import SubPageTopbar from '../components/SubPageTopbar'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import { timeAgo } from '../utils/dates'
import { useContextMenu } from '../components/ContextMenu'
import Icon from '../components/Icon'

export default function Notes({ novelId, embedded, moodboard = false }) {
  const { id } = useParams()
  const nid = novelId || id
  const { toast } = useApp()
  const [novel, setNovel] = useState(null)
  const [notes, setNotes] = useState([])
  const [chapters, setChapters] = useState([])
  const [characters, setCharacters] = useState([])
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const newNoteDraftKey = draftKey(nid, 'note', 'new')

  const load = useCallback(async () => {
    setNovel(await getNovel(nid))
    setNotes(await listNotes(nid))
    setChapters(await listChapters(nid))
    setCharacters(await listCharacters(nid))
  }, [nid])

  useEffect(() => {
    load()
  }, [load])

  const openNewNote = () => {
    const saved = readDraft(newNoteDraftKey)
    const base = { __new: true, title: '', content: '', link: null }
    if (saved && (saved.title || saved.content)) {
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
      await createNote(nid, editing)
      toast('Note tucked away.')
    } else {
      await updateNote(editing.id, editing)
      toast('Note updated.')
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
    await trashNote(deleting.id)
    setDeleting(null)
    load()
    toast('Moved to the Trash — recoverable for 30 days.')
  }

  const requestDelete = (n) => {
    setEditing(null)
    setDeleting(n)
  }

  const linkLabel = (link) => {
    if (!link) return null
    if (link.type === 'chapter') return `📖 ${chapters.find((c) => c.id === link.id)?.title || 'a chapter'}`
    if (link.type === 'character') return `◉ ${characters.find((c) => c.id === link.id)?.name || 'a character'}`
    return null
  }

  const { openContextMenu } = useContextMenu()
  const noteMenu = (e, n) =>
    openContextMenu(e, [
      { label: 'Edit note', icon: 'fa-solid fa-pen', onClick: () => setEditing({ ...n }) },
      { label: 'Delete note', icon: 'fa-solid fa-trash', danger: true, onClick: () => requestDelete(n) }
    ])

  return (
    <div className={embedded ? undefined : 'app'}>
      {!embedded && novel && <SubPageTopbar novel={novel} title="Notes" />}
      <div className={moodboard ? 'moodboard-notes' : 'page page-wide'}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
          <div>
            <h2 style={{ margin: 0 }}>{moodboard ? 'Writing notes' : 'Notes'}</h2>
            {moodboard && <p className="muted small" style={{ margin: '4px 0 0' }}>Keep chapter ideas and character reminders beside your visual references.</p>}
          </div>
          <button className="button button-primary" onClick={openNewNote}>
            <Icon icon="fa-solid fa-plus" style={{ marginRight: 6 }} /> Add note
          </button>
        </div>

        {notes.length === 0 ? (
          <EmptyState icon="fa-regular fa-note-sticky" title="A place for stray thoughts" action={<button className="button button-primary" onClick={openNewNote}>Write the first one</button>}>
            Ideas, fragments, the shape of a plot — write them here and pin them to a chapter or a character.
          </EmptyState>
        ) : (
          <div className="card-grid">
            {notes.map((n) => (
              <div className="card note-card" key={n.id} onClick={() => setEditing({ ...n })} onContextMenu={(e) => noteMenu(e, n)} style={{ cursor: 'pointer' }}>
                <h3 style={{ marginBottom: 2 }}>{n.title}</h3>
                {linkLabel(n.link) && <div className="note-link muted small">{linkLabel(n.link)}</div>}
                <p className="body" style={{ whiteSpace: 'pre-wrap', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' }}>
                  {n.content}
                </p>
                <div className="muted small" style={{ marginTop: 'auto', paddingTop: 12 }}>{timeAgo(n.updatedAt || n.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <NoteModal
          note={editing}
          chapters={chapters}
          characters={characters}
          onChange={setEditing}
          onClose={cancelEditing}
          onSave={save}
          onDelete={requestDelete}
          draftKey={editing.__new ? newNoteDraftKey : draftKey(nid, 'note', editing.id)}
          draftRestored={draftRestored && !!editing.__new}
        />
      )}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="Discard this note?">
        “{deleting?.title}” will be removed.
      </ConfirmDialog>
    </div>
  )
}

function NoteModal({ note, chapters, characters, onChange, onClose, onSave, onDelete, draftKey: dk, draftRestored }) {
  const { clearDraft } = useDraftRecovery(dk, note)
  const set = (patch) => onChange({ ...note, ...patch })

  return (
    <Modal open onClose={() => onClose(clearDraft)} title={note.__new ? 'New note' : 'Edit note'} width={560}>
      {draftRestored && (
        <div className="draft-restored-banner">
          <Icon icon="fa-solid fa-rotate-left" /> Draft recovered — your unsaved work is back.
        </div>
      )}
      <div className="field">
        <label>Title</label>
        <input spellCheck value={note.title || ''} onChange={(e) => set({ title: e.target.value })} autoFocus />
      </div>
      <div className="field">
        <label>Note</label>
        <textarea spellCheck style={{ minHeight: 160 }} value={note.content || ''} onChange={(e) => set({ content: e.target.value })} placeholder="Whatever you need to remember…" />
      </div>
      <div className="field">
        <label>Link to <span className="hint">(optional)</span></label>
        <select value={note.link ? `${note.link.type}:${note.link.id}` : ''} onChange={(e) => {
          const v = e.target.value
          if (!v) return set({ link: null })
          const [type, lid] = v.split(':')
          set({ link: { type, id: lid } })
        }}>
          <option value="">Nothing — a free thought</option>
          <optgroup label="Chapters">
            {chapters.map((c) => (
              <option key={`c-${c.id}`} value={`chapter:${c.id}`}>{c.title || 'Untitled'}</option>
            ))}
          </optgroup>
          <optgroup label="Characters">
            {characters.map((c) => (
              <option key={`p-${c.id}`} value={`character:${c.id}`}>{c.name}</option>
            ))}
          </optgroup>
        </select>
      </div>
      <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
        <div>
          {!note.__new && (
            <button className="button button-rose" onClick={() => onDelete?.(note)}>Delete</button>
          )}
        </div>
        <div className="actions-row">
          <button className="button button-ghost" onClick={() => onClose(clearDraft)}>Cancel</button>
          <button className="button button-primary" onClick={() => onSave(clearDraft)}>{note.__new ? 'Save note' : 'Save changes'}</button>
        </div>
      </div>
    </Modal>
  )
}
