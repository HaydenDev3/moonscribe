import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getNovel } from '../db/novels'
import { WORLD_KINDS, listWorld, createWorldItem, updateWorldItem, deleteWorldItem } from '../db/world'
import { useApp } from '../context/AppContext'
import SubPageTopbar from '../components/SubPageTopbar'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import { timeAgo } from '../utils/dates'
import { useContextMenu } from '../components/ContextMenu'
import Icon from '../components/Icon'

const KIND_COLORS = { place: '#7BA3C9', faction: '#B49BCB', item: '#E3C18A', lore: '#A8C5A8', timeline: '#D8B48F' }

export default function World({ novelId, embedded }) {
  const { id } = useParams()
  const nid = novelId || id
  const { toast } = useApp()
  const [novel, setNovel] = useState(null)
  const [items, setItems] = useState([])
  const [kind, setKind] = useState('place')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setNovel(await getNovel(nid))
    setItems(await listWorld(nid))
  }, [nid])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!editing) return
    if (editing.__new) {
      await createWorldItem(nid, editing)
      toast(`${editing.name || 'That place'} now exists.`)
    } else {
      await updateWorldItem(editing.id, editing)
      toast('Updated.')
    }
    setEditing(null)
    load()
  }

  const remove = async () => {
    await deleteWorldItem(deleting.id)
    setDeleting(null)
    load()
    toast('Let go.')
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
      <div className="page page-wide">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>Worldbuilding</h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>The places, peoples and strange things your story leans on.</p>
          </div>
          <button className="button button-primary" onClick={() => setEditing(newItem(kind))}>
            <Icon icon="fa-solid fa-plus" style={{ marginRight: 6 }} /> Add {active?.label.toLowerCase().replace(/s$/, '')}
          </button>
        </div>

        <div className="kind-tabs">
          {WORLD_KINDS.map((k) => (
            <button key={k.key} className={`kind-tab ${kind === k.key ? 'active' : ''}`} onClick={() => setKind(k.key)}>
              <span className="nav-icon"><Icon icon={k.icon} /></span>
              {k.label}
              <span className="kind-count">{items.filter((i) => i.kind === k.key).length}</span>
            </button>
          ))}
        </div>

        {current.length === 0 ? (
          <EmptyState icon={active?.icon} title={`No ${active?.label.toLowerCase()} yet`} action={<button className="button button-primary" onClick={() => setEditing(newItem(kind))}>Create the first one</button>}>
            Every world needs its corners. Start with one detail — a name, a view, a smell.
          </EmptyState>
        ) : (
          <div className="card-grid">
            {current.map((i) => (
              <div className="card" key={i.id} style={{ borderTop: `3px solid ${i.color || KIND_COLORS[i.kind]}` }} onContextMenu={(e) => worldMenu(e, i)}>
                <h3 style={{ marginBottom: 2 }}>{i.name}</h3>
                {i.summary && <p className="body" style={{ marginTop: 'var(--space-2)', whiteSpace: 'pre-wrap' }}>{i.summary}</p>}
                {i.details && <p className="body muted small" style={{ whiteSpace: 'pre-wrap' }}>{i.details}</p>}
                {i.tags?.length > 0 && (
                  <div className="character-tags">
                    {i.tags.map((t, idx) => (
                      <span className="tag" key={idx}>{t}</span>
                    ))}
                  </div>
                )}
                <div className="muted small" style={{ marginTop: 'var(--space-2)' }}>{timeAgo(i.updatedAt || i.createdAt)}</div>
                <div className="card-actions">
                  <button className="button button-quiet" onClick={() => setEditing({ ...i })}>Edit</button>
                  <button className="button button-quiet" onClick={() => setDeleting(i)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <WorldModal item={editing} onChange={setEditing} onClose={() => setEditing(null)} onSave={save} isNew={!!editing.__new} />
      )}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="Remove from the world?">
        “{deleting?.name}” will disappear from this world.
      </ConfirmDialog>
    </div>
  )
}

function WorldModal({ item, onChange, onClose, onSave, isNew }) {
  const set = (patch) => onChange({ ...item, ...patch })

  return (
    <Modal open onClose={onClose} title={isNew ? 'New world entry' : item.name} width={560}>
      <div className="field">
        <label>Name</label>
        <input value={item.name || ''} onChange={(e) => set({ name: e.target.value })} autoFocus placeholder="The Alder Canal…" />
      </div>
      <div className="field">
        <label>Kind</label>
        <div className="swatch-row" style={{ gap: 8 }}>
          {WORLD_KINDS.map((k) => (
            <button key={k.key} className={`tag ${item.kind === k.key ? 'tag-on' : ''}`} style={item.kind === k.key ? { background: 'var(--accent-fill)', color: 'var(--accent-fg)' } : {}} onClick={() => set({ kind: k.key, color: KIND_COLORS[k.key] })}>
              {k.icon} {k.label}
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
        <button className="button button-ghost" onClick={onClose}>Cancel</button>
        <button className="button button-primary" onClick={onSave}>{isNew ? 'Set it in the world' : 'Save changes'}</button>
      </div>
    </Modal>
  )
}
