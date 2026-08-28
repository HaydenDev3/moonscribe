import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getNovel } from '../db/novels'
import { listCharacters } from '../db/characters'
import { listRelationships, createRelationship, updateRelationship, deleteRelationship } from '../db/relationships'
import { useApp } from '../context/AppContext'
import SubPageTopbar from '../components/SubPageTopbar'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import { useContextMenu } from '../components/ContextMenu'
import Icon from '../components/Icon'

function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function Relationships({ novelId, embedded }) {
  const { id } = useParams()
  const nid = novelId || id
  const { toast } = useApp()
  const [novel, setNovel] = useState(null)
  const [relationships, setRelationships] = useState([])
  const [characters, setCharacters] = useState([])
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [mapView, setMapView] = useState(false)
  const [selectedChar, setSelectedChar] = useState(null)

  const load = useCallback(async () => {
    setNovel(await getNovel(nid))
    setRelationships(await listRelationships(nid))
    setCharacters(await listCharacters(nid))
  }, [nid])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!editing) return
    if (editing.__new) {
      await createRelationship(nid, editing)
      toast('A thread between them, noted.')
    } else {
      await updateRelationship(editing.id, editing)
      toast('Relationship updated.')
    }
    setEditing(null)
    load()
  }

  const remove = async () => {
    await deleteRelationship(deleting.id)
    setDeleting(null)
    load()
    toast('That thread was cut.')
  }

  const charName = (cid) => characters.find((c) => c.id === cid)?.name || 'Someone'
  const charColor = (cid) => characters.find((c) => c.id === cid)?.color || '#D4A5A5'

  const { openContextMenu } = useContextMenu()
  const relMenu = (e, r) =>
    openContextMenu(e, [
      { label: 'Edit relationship', icon: 'fa-solid fa-pen', onClick: () => setEditing({ ...r }) },
      { label: 'Unlink these two', icon: 'fa-solid fa-trash', danger: true, onClick: () => setDeleting(r) }
    ])

  return (
    <div className={embedded ? undefined : 'app'}>
      {!embedded && novel && <SubPageTopbar novel={novel} title="Relationships" />}
      <div className="page page-wide">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
          <h2 style={{ margin: 0 }}>Relationships</h2>
          <div className="actions-row">
            {characters.length > 0 && (
              <button className="button button-ghost" onClick={() => setMapView((v) => !v)}>
                <Icon icon={mapView ? 'fa-solid fa-heart' : 'fa-solid fa-diagram-project'} style={{ marginRight: 6 }} /> {mapView ? 'List view' : 'Constellation map'}
              </button>
            )}
            <button className="button button-primary" onClick={() => setEditing({ __new: true, a: characters[0]?.id || '', b: characters[1]?.id || '', description: '' })}>
              <Icon icon="fa-solid fa-plus" style={{ marginRight: 6 }} /> Add relationship
            </button>
          </div>
        </div>

        {mapView ? (
          <div className="constellation-panel">
            <ConstellationMap
              characters={characters}
              relationships={relationships}
              selectedId={selectedChar}
              onSelect={(cid) => setSelectedChar(cid)}
            />
          </div>
        ) : characters.length === 0 ? (
          <EmptyState icon="❧" title="Add characters first">
            Relationships need two people. Head to Characters and introduce them.
          </EmptyState>
        ) : relationships.length === 0 ? (
          <EmptyState icon="❧" title="No threads yet" action={<button className="button button-primary" onClick={() => setEditing({ __new: true, a: characters[0]?.id || '', b: characters[1]?.id || '', description: '' })}>Weave the first one</button>}>
            Who stands beside whom? A line is all it takes.
          </EmptyState>
        ) : (
          <div className="rel-list">
            {relationships.map((r) => (
              <div className="rel-item" key={r.id} onContextMenu={(e) => relMenu(e, r)}>
                <div className="rel-card-head">
                  <span className="rel-card-kicker"><Icon icon="fa-solid fa-link" /> STORY THREAD</span>
                  <span className="rel-card-index">{String(relationships.indexOf(r) + 1).padStart(2, '0')}</span>
                </div>
                <div className="names">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="rel-avatar" style={{ background: charColor(r.a) }}>{initials(charName(r.a))}</span>
                    <span className="rel-person-name">{charName(r.a)}</span>
                  </span>
                  <span className="rel-thread-line"><i /><span className="rel-symbol">❦</span><i /></span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="rel-avatar" style={{ background: charColor(r.b) }}>{initials(charName(r.b))}</span>
                    <span className="rel-person-name">{charName(r.b)}</span>
                  </span>
                </div>
                <div className="rel-card-body">
                  <div className="rel-desc">{r.description || 'This connection is waiting for its first note.'}</div>
                  {!r.description && <span className="rel-unwritten">Unwritten</span>}
                </div>
                {r.stages?.length > 0 && (
                  <ol className="rel-timeline">
                    {r.stages.map((s, i) => (
                      <li key={i}>
                        <span className="rel-stage-label">{s.label}</span>
                        {s.note && <span className="rel-stage-note">{s.note}</span>}
                      </li>
                    ))}
                  </ol>
                )}
                <div className="rel-card-footer">
                  <span className="rel-stage-count">{r.stages?.length || 0} {r.stages?.length === 1 ? 'chapter' : 'stages'} mapped</span>
                  <div className="actions-row">
                    <button className="button button-quiet" onClick={() => setEditing({ ...r })}><Icon icon="fa-solid fa-pen" /> Edit thread</button>
                    <button className="button button-quiet rel-delete" aria-label="Delete relationship" onClick={() => setDeleting(r)}><Icon icon="fa-solid fa-xmark" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <RelationshipModal
          rel={editing}
          characters={characters}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="Unlink these two?">
        The thread between {deleting ? charName(deleting.a) : ''} and {deleting ? charName(deleting.b) : ''} will be removed.
      </ConfirmDialog>
    </div>
  )
}

function ConstellationMap(props) {
  const [Comp, setComp] = useState(null)
  useEffect(() => {
    import('./ConstellationMap').then((m) => setComp(() => m.default))
  }, [])
  if (!Comp) {
    return <div className="constellation" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grey)', fontStyle: 'italic' }}>drawing the stars…</div>
  }
  return <Comp {...props} />
}

function RelationshipModal({ rel, characters, onChange, onClose, onSave }) {
  const set = (patch) => onChange({ ...rel, ...patch })

  return (
    <Modal open onClose={onClose} title={rel.__new ? 'New relationship' : 'Edit relationship'} width={480}>
      <div className="field">
        <label>First character</label>
        <select value={rel.a || ''} onChange={(e) => set({ a: e.target.value })}>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Second character</label>
        <select value={rel.b || ''} onChange={(e) => set({ b: e.target.value })}>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>What binds them <span className="hint">(a short line)</span></label>
        <textarea spellCheck value={rel.description || ''} onChange={(e) => set({ description: e.target.value })} placeholder="Sister and keeper of secrets…" />
      </div>
      <div className="field">
        <label>How it grew <span className="hint">(the road between them)</span></label>
        <StageEditor
          stages={rel.stages || []}
          onChange={(stages) => set({ stages })}
        />
      </div>
      <div className="modal-foot">
        <button className="button button-ghost" onClick={onClose}>Cancel</button>
        <button className="button button-primary" onClick={onSave}>{rel.__new ? 'Weave it' : 'Save changes'}</button>
      </div>
    </Modal>
  )
}

function StageEditor({ stages, onChange }) {
  const update = (i, patch) => onChange(stages.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const add = () => onChange([...stages, { label: '', note: '' }])
  const remove = (i) => onChange(stages.filter((_, idx) => idx !== i))

  return (
    <div className="stage-editor">
      {stages.map((s, i) => (
        <div className="stage-row" key={i}>
          <input
            value={s.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Stage — e.g. strangers, friends, lovers…"
          />
          <input
            value={s.note || ''}
            onChange={(e) => update(i, { note: e.target.value })}
            placeholder="a note…"
            className="stage-note"
          />
          <button className="button button-quiet" onClick={() => remove(i)} aria-label="Remove stage">✕</button>
        </div>
      ))}
      <button className="button button-ghost" onClick={add}>
        <Icon icon="fa-solid fa-plus" style={{ marginRight: 6 }} /> Add a stage
      </button>
    </div>
  )
}
