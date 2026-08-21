import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDraftRecovery, readDraft, draftKey } from '../utils/draftRecovery'
import { useParams } from 'react-router-dom'
import { getNovel } from '../db/novels'
import { listGlossary, createTerm, updateTerm, trashTerm } from '../db/glossary'
import { useApp } from '../context/AppContext'
import SubPageTopbar from '../components/SubPageTopbar'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import { useContextMenu } from '../components/ContextMenu'
import Icon from '../components/Icon'

const CATEGORIES = [
  ['term', 'Term'],
  ['place', 'Place'],
  ['name', 'Name'],
  ['faction', 'Faction'],
  ['item', 'Item'],
  ['other', 'Other']
]

const CAT_LABEL = Object.fromEntries(CATEGORIES)

export default function Glossary({ novelId, embedded }) {
  const { id } = useParams()
  const nid = novelId || id
  const { toast } = useApp()
  const [novel, setNovel] = useState(null)
  const [terms, setTerms] = useState([])
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('all')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const newTermDraftKey = draftKey(nid, 'term', 'new')

  const load = useCallback(async () => {
    setNovel(await getNovel(nid))
    setTerms(await listGlossary(nid))
  }, [nid])

  useEffect(() => {
    load()
  }, [load])

  const openNewTerm = () => {
    const base = { __new: true, term: '', definition: '', category: 'term', aliasText: '', pronunciation: '' }
    const saved = readDraft(newTermDraftKey)
    if (saved && (saved.term || saved.definition)) {
      setDraftRestored(true)
      setEditing({ ...base, ...saved, __new: true })
    } else {
      setDraftRestored(false)
      setEditing(base)
    }
  }

  const save = async (clearDraftFn) => {
    if (!editing) return
    if (!(editing.term || '').trim()) {
      toast('A term needs a word.')
      return
    }
    const payload = {
      ...editing,
      aliases: (editing.aliasText || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
    if (editing.__new) {
      await createTerm(nid, payload)
      toast('Term added to the glossary.')
    } else {
      await updateTerm(editing.id, payload)
      toast('Term updated.')
    }
    clearDraftFn?.()
    setEditing(null)
    setDraftRestored(false)
    load()
  }

  const cancelEditing = (clearDraftFn = () => {}) => {
    clearDraftFn()
    setEditing(null)
    setDraftRestored(false)
  }

  const remove = async () => {
    await trashTerm(deleting.id)
    setDeleting(null)
    load()
    toast('Moved to the Trash — recoverable for 30 days.')
  }

  const startEdit = (t) =>
    setEditing({ ...t, aliasText: (t.aliases || []).join(', ') })

  const { openContextMenu } = useContextMenu()
  const termMenu = (e, t) =>
    openContextMenu(e, [
      { label: 'Edit term', icon: 'fa-solid fa-pen', onClick: () => startEdit(t) },
      { label: 'Delete term', icon: 'fa-solid fa-trash', danger: true, onClick: () => setDeleting(t) }
    ])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return terms.filter((t) => {
      if (cat !== 'all' && (t.category || 'term') !== cat) return false
      if (!q) return true
      return (
        (t.term || '').toLowerCase().includes(q) ||
        (t.definition || '').toLowerCase().includes(q) ||
        (t.aliases || []).join(' ').toLowerCase().includes(q)
      )
    })
  }, [terms, query, cat])

  const counts = useMemo(() => {
    const m = { all: terms.length }
    for (const t of terms) {
      const k = t.category || 'term'
      m[k] = (m[k] || 0) + 1
    }
    return m
  }, [terms])

  return (
    <div className={embedded ? undefined : 'app'}>
      {!embedded && novel && <SubPageTopbar novel={novel} title="Glossary" />}
      <div className="page page-wide">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Glossary</h2>
          <button className="button button-primary" onClick={openNewTerm}>
            <Icon icon="fa-solid fa-plus" style={{ marginRight: 6 }} /> Add term
          </button>
        </div>

        {terms.length > 0 && (
          <>
            <div className="library-search" style={{ maxWidth: 420 }}>
              <Icon icon="fa-solid fa-magnifying-glass" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search terms and definitions…" />
            </div>
            <div className="kind-tabs">
              <button className={`kind-tab ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>
                All <span className="kind-count">{counts.all || 0}</span>
              </button>
              {CATEGORIES.map(([k, label]) => (
                <button key={k} className={`kind-tab ${cat === k ? 'active' : ''}`} onClick={() => setCat(k)}>
                  {label} <span className="kind-count">{counts[k] || 0}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {terms.length === 0 ? (
          <EmptyState icon="fa-solid fa-book-open" title="A living dictionary" action={<button className="button button-primary" onClick={openNewTerm}>Add the first term</button>}>
            Invented words, place names, house sigils — collect them here with definitions. They’ll gently underline in the read view, with the meaning a hover away.
          </EmptyState>
        ) : shown.length === 0 ? (
          <p className="muted" style={{ padding: 'var(--space-5) 0' }}>No terms match.</p>
        ) : (
          <div className="card-grid">
            {shown.map((t) => (
              <div className="card" key={t.id} onClick={() => startEdit(t)} onContextMenu={(e) => termMenu(e, t)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ marginBottom: 2 }}>{t.term}</h3>
                  <span className="tag" style={{ flex: 'none' }}>{CAT_LABEL[t.category] || 'Term'}</span>
                </div>
                {t.pronunciation && <div className="muted small" style={{ fontStyle: 'italic' }}>/{t.pronunciation}/</div>}
                <p className="body">{t.definition || <span className="muted">No definition yet.</span>}</p>
                {(t.aliases || []).length > 0 && (
                  <div className="character-tags">
                    {t.aliases.map((a) => (
                      <span key={a} className="tag">{a}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <TermModal
          term={editing}
          onChange={setEditing}
          onClose={cancelEditing}
          onSave={save}
          onDelete={(t) => { cancelEditing(); setDeleting(t) }}
          draftKey={editing.__new ? newTermDraftKey : draftKey(nid, 'term', editing.id)}
          draftRestored={draftRestored && !!editing.__new}
        />
      )}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="Delete this term?">
        “{deleting?.term}” will move to the Trash, recoverable for 30 days.
      </ConfirmDialog>
    </div>
  )
}

function TermModal({ term, onChange, onClose, onSave, onDelete, draftKey: dk, draftRestored }) {
  const { clearDraft } = useDraftRecovery(dk, term)
  const set = (patch) => onChange({ ...term, ...patch })
  return (
    <Modal open onClose={() => onClose(clearDraft)} title={term.__new ? 'New term' : 'Edit term'} width={560}>
      {draftRestored && (
        <div className="draft-restored-banner">
          <Icon icon="fa-solid fa-rotate-left" /> Draft recovered — your unsaved work is back.
        </div>
      )}
      <div className="field">
        <label>Term</label>
        <input value={term.term || ''} onChange={(e) => set({ term: e.target.value })} autoFocus placeholder="Aetherglass" />
      </div>
      <div className="actions-row" style={{ gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Category</label>
          <select value={term.category || 'term'} onChange={(e) => set({ category: e.target.value })}>
            {CATEGORIES.map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Pronunciation <span className="hint">(optional)</span></label>
          <input value={term.pronunciation || ''} onChange={(e) => set({ pronunciation: e.target.value })} placeholder="AY-ther-glass" />
        </div>
      </div>
      <div className="field">
        <label>Definition</label>
        <textarea style={{ minHeight: 120 }} value={term.definition || ''} onChange={(e) => set({ definition: e.target.value })} placeholder="What it means in your world…" />
      </div>
      <div className="field">
        <label>Also spelled <span className="hint">(comma-separated — these underline too)</span></label>
        <input value={term.aliasText || ''} onChange={(e) => set({ aliasText: e.target.value })} placeholder="aether-glass, aetherglas" />
      </div>
      <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
        <div>{!term.__new && <button className="button button-rose" onClick={() => onDelete?.(term)}>Delete</button>}</div>
        <div className="actions-row">
          <button className="button button-ghost" onClick={() => onClose(clearDraft)}>Cancel</button>
          <button className="button button-primary" onClick={() => onSave(clearDraft)}>{term.__new ? 'Save term' : 'Save changes'}</button>
        </div>
      </div>
    </Modal>
  )
}
