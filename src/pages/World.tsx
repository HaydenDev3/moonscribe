import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useDraftRecovery, readDraft, draftKey } from '../utils/draftRecovery'
import { useParams } from 'react-router-dom'
import { getNovel } from '../db/novels'
import { WORLD_KINDS, listWorld, createWorldItem, updateWorldItem, trashWorldItem } from '../db/world'
import { useApp } from '../context/AppContext'
import SubPageTopbar from '../components/SubPageTopbar'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import { timeAgo } from '../utils/dates'
import { useContextMenu } from '../components/ContextMenu'
import Icon from '../components/Icon'

const KIND_COLORS = { place: '#7BA3C9', faction: '#B49BCB', item: '#E3C18A', lore: '#A8C5A8', timeline: '#D8B48F' }

const compactText = (value = '', limit = 220) => {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text
}

export default function World({ novelId, embedded }) {
  const { id } = useParams()
  const nid = novelId || id
  const { toast } = useApp()
  const [novel, setNovel] = useState(null)
  const [items, setItems] = useState([])
  const [kind, setKind] = useState('place')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const worldDraftKey = (k) => draftKey(nid, 'world', `new-${k}`)

  const load = useCallback(async () => {
    setNovel(await getNovel(nid))
    setItems(await listWorld(nid))
  }, [nid])

  useEffect(() => {
    load()
  }, [load])

  const openNewItem = (k) => {
    const base = newItem(k)
    const saved = readDraft(worldDraftKey(k))
    if (saved && saved.name) {
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
      await createWorldItem(nid, editing)
      toast(`${editing.name || 'That place'} now exists.`)
    } else {
      await updateWorldItem(editing.id, editing)
      toast('Updated.')
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
    await trashWorldItem(deleting.id)
    setDeleting(null)
    load()
    toast('Moved to the Trash — recoverable for 30 days.')
  }

  const current = items.filter((i) => i.kind === kind)
  const active = WORLD_KINDS.find((k) => k.key === kind)

  const { openContextMenu } = useContextMenu()
  const worldMenu = (e, i) =>
    openContextMenu(e, [
      { label: 'Edit', icon: 'fa-solid fa-pen', onClick: () => setEditing({ ...i }) },
      { label: 'Duplicate', icon: 'fa-regular fa-copy', onClick: async () => {
        await createWorldItem(nid, { ...i, __new: true, id: undefined, name: `${i.name} copy` })
        load()
      } },
      { label: 'Delete', icon: 'fa-solid fa-trash', danger: true, onClick: () => setDeleting(i) }
    ])

  const newItem = (k) => ({
    __new: true,
    kind: k,
    name: '',
    summary: '',
    details: '',
    tags: [],
    color: KIND_COLORS[k] || '#7BA3C9'
  })

  return (
    <div className={embedded ? undefined : 'app'}>
      {!embedded && novel && <SubPageTopbar novel={novel} title="Worldbuilding" />}
      <div className="page page-wide world-library">
        <header className="world-hero">
          <div className="world-hero-mark" aria-hidden="true"><Icon icon="fa-solid fa-globe" /></div>
          <div className="world-hero-copy">
            <span className="world-eyebrow">Story atlas</span>
            <h2>Worldbuilding</h2>
            <p>The places, peoples and strange things your story leans on.</p>
          </div>
          <div className="world-hero-stat" aria-label={`${items.length} world entries`}>
            <strong>{items.length}</strong><span>entries</span>
          </div>
          <button className="button button-primary world-add-button" onClick={() => openNewItem(kind)}>
            <Icon icon="fa-solid fa-plus" style={{ marginRight: 6 }} /> Add {active?.label.toLowerCase().replace(/s$/, '')}
          </button>
        </header>

        <div className="kind-tabs world-kind-tabs" aria-label="Worldbuilding categories">
          {WORLD_KINDS.map((k) => (
            <button key={k.key} className={`kind-tab ${kind === k.key ? 'active' : ''}`} onClick={() => setKind(k.key)}>
              <span className="nav-icon"><Icon icon={k.icon} /></span>
              {k.label}
              <span className="kind-count">{items.filter((i) => i.kind === k.key).length}</span>
            </button>
          ))}
        </div>

        {current.length === 0 ? (
          <EmptyState icon={active?.icon} title={`No ${active?.label.toLowerCase()} yet`} action={<button className="button button-primary" onClick={() => openNewItem(kind)}>Create the first one</button>}>
            Every world needs its corners. Start with one detail — a name, a view, a smell.
          </EmptyState>
        ) : (
          <div className="world-card-grid">
            {current.map((i) => (
              <article
                className="world-glass-card"
                key={i.id}
                style={{ ['--world-color' as any]: i.color || KIND_COLORS[i.kind] } as CSSProperties}
                onContextMenu={(e) => worldMenu(e, i)}
                onClick={() => setEditing({ ...i })}
              >
                <div className="world-card-head">
                  <span className="world-card-icon"><Icon icon={WORLD_KINDS.find((entry) => entry.key === i.kind)?.icon || active?.icon} /></span>
                  <div>
                    <span className="world-card-kind">{WORLD_KINDS.find((entry) => entry.key === i.kind)?.label}</span>
                    <h3>{i.name}</h3>
                  </div>
                </div>
                <div className="world-card-content">
                  {i.summary && <p className="world-card-summary">{compactText(i.summary, 150)}</p>}
                  {i.details && <p className="world-card-details">{compactText(i.details)}</p>}
                  {!i.summary && !i.details && <p className="world-card-details">Open this entry to begin shaping its history and story purpose.</p>}
                </div>
                {i.tags?.length > 0 && (
                  <div className="world-card-tags">
                    {i.tags.slice(0, 3).map((t, idx) => (
                      <span className="tag" key={idx}>{t}</span>
                    ))}
                    {i.tags.length > 3 && <span className="tag">+{i.tags.length - 3}</span>}
                  </div>
                )}
                <div className="world-card-foot">
                  <span><Icon icon="fa-regular fa-clock" /> {timeAgo(i.updatedAt || i.createdAt)}</span>
                  <div className="world-card-actions">
                    <button className="button button-quiet" onClick={(e) => { e.stopPropagation(); setEditing({ ...i }) }}><Icon icon="fa-solid fa-pen" /> Edit</button>
                    <button className="button button-quiet world-delete" onClick={(e) => { e.stopPropagation(); setDeleting(i) }}><Icon icon="fa-solid fa-trash" /> Delete</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <WorldModal
          item={editing}
          onChange={setEditing}
          onClose={cancelEditing}
          onSave={save}
          isNew={!!editing.__new}
          draftKey={editing.__new ? worldDraftKey(editing.kind) : draftKey(nid, 'world', editing.id)}
          draftRestored={draftRestored && !!editing.__new}
        />
      )}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="Remove from the world?">
        “{deleting?.name}” will disappear from this world.
      </ConfirmDialog>
    </div>
  )
}

function WorldModal({ item, onChange, onClose, onSave, isNew, draftKey: dk, draftRestored }) {
  const { clearDraft } = useDraftRecovery(dk, item)
  const set = (patch) => onChange({ ...item, ...patch })

  return (
    <Modal open onClose={() => onClose(clearDraft)} title={isNew ? 'New world entry' : item.name} width={600} className="world-entry-modal">
      {draftRestored && (
        <div className="draft-restored-banner">
          <Icon icon="fa-solid fa-rotate-left" /> Draft recovered — your unsaved work is back.
        </div>
      )}
      <div className="field">
        <label>Name</label>
        <input value={item.name || ''} onChange={(e) => set({ name: e.target.value })} autoFocus placeholder="The Alder Canal…" />
      </div>
      <div className="field">
        <label>Kind</label>
        <div className="swatch-row" style={{ gap: 8 }}>
          {WORLD_KINDS.map((k) => (
            <button key={k.key} className={`tag ${item.kind === k.key ? 'tag-on' : ''}`} style={item.kind === k.key ? { background: 'var(--accent-fill)', color: 'var(--accent-fg)' } : {}} onClick={() => set({ kind: k.key, color: KIND_COLORS[k.key] })}>
              <Icon icon={k.icon} /> {k.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Summary <span className="hint">(what it is, in a line or two)</span></label>
        <textarea value={item.summary || ''} onChange={(e) => set({ summary: e.target.value })} placeholder="A slow canal that glows faintly at dusk…" />
      </div>
      <div className="field">
        <label>Details <span className="hint">(secrets, rules, history)</span></label>
        <textarea style={{ minHeight: 140 }} value={item.details || ''} onChange={(e) => set({ details: e.target.value })} placeholder="Who built it, what it costs to use, what it hides…" />
      </div>
      <div className="field">
        <label>Tags <span className="hint">(comma separated)</span></label>
        <input value={(item.tags || []).join(', ')} onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="canal, magic, borderland" />
      </div>
      <div className="modal-foot">
        <button className="button button-ghost" onClick={() => onClose(clearDraft)}>Cancel</button>
        <button className="button button-primary" onClick={() => onSave(clearDraft)}>{isNew ? 'Set it in the world' : 'Save changes'}</button>
      </div>
    </Modal>
  )
}
