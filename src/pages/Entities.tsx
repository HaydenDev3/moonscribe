import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getNovel } from '../db/novels'
import {
  listEntities, createEntity, updateEntity, trashEntity,
  DEFAULTS, KIND_FIELDS, entityColors
} from '../db/entities'
import { useApp } from '../context/AppContext'
import SubPageTopbar from '../components/SubPageTopbar'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { useContextMenu } from '../components/ContextMenu'
import Icon from '../components/Icon'

const KINDS = ['faction', 'artefact', 'place']

function colorToGradient(hex) {
  if (!hex) return 'linear-gradient(135deg, #4a3f6b 0%, #2a1f4b 100%)'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const darker = `rgb(${Math.max(0, r - 60)},${Math.max(0, g - 60)},${Math.max(0, b - 60)})`
  return `linear-gradient(135deg, ${hex} 0%, ${darker} 100%)`
}

function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function EntityCard({ entity, kind, onClick, onContextMenu }) {
  const def = DEFAULTS[kind]
  return (
    <div
      className="char-card"
      onClick={onClick}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="char-card-banner" style={{ background: colorToGradient(entity.color) }} />
      <div className="char-card-avatar-wrap">
        <div className="char-card-avatar">
          {entity.portrait
            ? <img src={entity.portrait} alt={entity.name} className="char-card-avatar-img" />
            : (
              <div className="char-card-avatar-img" style={{ background: entity.color || '#7b6d9e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem' }}>
                <Icon icon={def.icon} />
              </div>
            )
          }
        </div>
      </div>
      <div className="char-card-body">
        <div className="char-card-name">{entity.name}</div>
        {entity.type && <div className="char-card-role">{entity.type}</div>}
        {(kind === 'faction' && entity.allegiance) && <div className="char-card-meta muted small">{entity.allegiance}</div>}
        {(kind === 'artefact' && entity.origin) && <div className="char-card-meta muted small">{entity.origin}</div>}
        {(kind === 'place' && entity.region) && <div className="char-card-meta muted small">{entity.region}</div>}
      </div>
    </div>
  )
}

function EntityModal({ open, onClose, entity, kind, onSave }) {
  const [form, setForm] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState(0)
  const fileRef = useRef(null)
  const colors = entityColors()
  const fields = KIND_FIELDS[kind] || []

  useEffect(() => {
    if (open) {
      setForm(entity ? { ...entity } : { color: DEFAULTS[kind]?.color || '#7B9EBF' })
      setActiveTab(0)
    }
  }, [open, entity, kind])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handlePortrait = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('portrait', reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <Modal open={open} onClose={onClose} title={entity ? `Edit ${DEFAULTS[kind]?.name || kind}` : `New ${kind}`} width={560}>
      <div className="char-modal-layout">
        {/* Left: avatar + colour */}
        <div className="char-modal-left">
          <div className="char-modal-avatar-wrap" onClick={() => fileRef.current?.click()} title="Change image">
            <div className="char-modal-avatar" style={{ background: colorToGradient(form.color) }}>
              {form.portrait
                ? <img src={form.portrait} alt={form.name} className="char-modal-avatar-img" />
                : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#fff', fontSize: '1.6rem' }}>
                    <Icon icon={DEFAULTS[kind]?.icon || 'fa-solid fa-star'} />
                  </div>
                )
              }
              <div className="char-modal-avatar-overlay"><Icon icon="fa-solid fa-camera" /></div>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePortrait} />
          <div className="char-color-grid">
            {colors.map((c) => (
              <button
                key={c}
                className={`char-color-dot ${form.color === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => set('color', c)}
                aria-label={`Colour ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Right: fields */}
        <div className="char-modal-right">
          <div className="field">
            <label>Name</label>
            <input value={form.name || ''} onChange={(e) => set('name', e.target.value)} autoFocus placeholder={DEFAULTS[kind]?.name} />
          </div>

          <div className="char-tabs">
            {['Details', 'Notes'].map((t, i) => (
              <button key={t} className={`char-tab ${activeTab === i ? 'active' : ''}`} onClick={() => setActiveTab(i)}>{t}</button>
            ))}
          </div>

          {activeTab === 0 && (
            <div className="char-tab-content">
              {fields.filter((f) => f.key !== 'description').map((f) => (
                <div className="field" key={f.key}>
                  <label>{f.label}</label>
                  <input value={form[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
                </div>
              ))}
              {fields.find((f) => f.multiline) && (
                <div className="field">
                  <label>Description</label>
                  <textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder={fields.find((f) => f.multiline)?.placeholder} rows={4} />
                </div>
              )}
            </div>
          )}

          {activeTab === 1 && (
            <div className="char-tab-content">
              <div className="field">
                <label>Notes</label>
                <textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="Private notes, ideas, reminders…" rows={6} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="modal-foot">
        <button className="button button-primary" onClick={() => onSave(form)} disabled={!form.name?.trim()}>Save</button>
      </div>
    </Modal>
  )
}

export default function Entities({ novelId, embedded }) {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const nid = novelId || id
  const { toast } = useApp()
  const { openContextMenu } = useContextMenu()
  const [novel, setNovel] = useState(null)
  const [data, setData] = useState({ faction: [], artefact: [], place: [] })
  const [editing, setEditing] = useState(null) // { entity, kind }
  const [kind, setKind] = useState(searchParams.get('kind') || 'faction')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setNovel(await getNovel(nid))
    const [factions, artefacts, places] = await Promise.all([
      listEntities(nid, 'faction'),
      listEntities(nid, 'artefact'),
      listEntities(nid, 'place'),
    ])
    setData({ faction: factions, artefact: artefacts, place: places })
  }, [nid])

  useEffect(() => { load() }, [load])

  const switchKind = (k) => {
    setKind(k)
    setSearchParams({ kind: k }, { replace: true })
  }

  const openNew = () => setEditing({ entity: null, kind })

  const openEdit = (entity) => setEditing({ entity, kind: entity.kind })

  const save = async (form) => {
    if (editing.entity) {
      await updateEntity(editing.entity.id, form)
      toast('Saved.')
    } else {
      await createEntity(nid, editing.kind, form)
      toast(`${editing.kind.charAt(0).toUpperCase() + editing.kind.slice(1)} added.`)
    }
    setEditing(null)
    load()
  }

  const cardMenu = (e, entity) => {
    e.preventDefault()
    openContextMenu(e, [
      { label: 'Edit', icon: 'fa-solid fa-pen', onClick: () => openEdit(entity) },
      'divider',
      { label: 'Delete', icon: 'fa-solid fa-trash', danger: true, onClick: async () => {
        await trashEntity(entity.id)
        toast('Moved to trash.')
        load()
      }},
    ])
  }

  const def = DEFAULTS[kind]
  const list = (data[kind] || []).filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()))

  const LABELS = { faction: 'Factions', artefact: 'Artefacts', place: 'Places' }

  return (
    <div className={embedded ? undefined : 'app'}>
      {!embedded && <SubPageTopbar novel={novel} title={LABELS[kind] || 'Entities'} />}
      <div className="page page-wide">
        <div className="chars-header">
          <div>
            <h2 style={{ margin: 0 }}>{LABELS[kind]}</h2>
            <p className="muted small" style={{ margin: '3px 0 0' }}>
              {kind === 'faction'  && 'Guilds, factions, organisations, cults — any group with a name.'}
              {kind === 'artefact' && 'Weapons, relics, tomes, and objects that matter to the story.'}
              {kind === 'place'    && 'Cities, realms, ruins, rooms — every location worth remembering.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="chars-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${LABELS[kind].toLowerCase()}…`}
              style={{ width: 180 }}
            />
            <button className="button button-primary" onClick={openNew}>
              <Icon icon="fa-solid fa-plus" style={{ marginRight: 6 }} />New {kind}
            </button>
          </div>
        </div>

        {/* Kind tabs */}
        <div className="entity-kind-tabs">
          {KINDS.map((k) => (
            <button
              key={k}
              className={`entity-kind-tab ${kind === k ? 'active' : ''}`}
              onClick={() => switchKind(k)}
            >
              <Icon icon={DEFAULTS[k].icon} style={{ marginRight: 6 }} />
              {LABELS[k]}
              <span className="entity-kind-count">{data[k]?.length || 0}</span>
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <EmptyState icon={def.icon} title={`No ${LABELS[kind].toLowerCase()} yet`}>
            Every world has its power structures, legendary objects, and storied places. Add the first one.
            <br />
            <button className="button button-primary" style={{ marginTop: 'var(--space-4)' }} onClick={openNew}>
              Add a {kind}
            </button>
          </EmptyState>
        ) : (
          <div className="chars-grid">
            {list.map((entity) => (
              <EntityCard
                key={entity.id}
                entity={entity}
                kind={kind}
                onClick={() => openEdit(entity)}
                onContextMenu={(e) => cardMenu(e, entity)}
              />
            ))}
            <button className="char-add-card" onClick={openNew} aria-label={`Add ${kind}`}>
              <Icon icon="fa-solid fa-plus" />
              <span>Add {kind}</span>
            </button>
          </div>
        )}
      </div>

      {editing && (
        <EntityModal
          open={true}
          onClose={() => setEditing(null)}
          entity={editing.entity}
          kind={editing.kind}
          onSave={save}
        />
      )}
    </div>
  )
}
