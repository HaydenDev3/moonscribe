import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listTrash, restoreTrashed, purgeTrashed, emptyTrash } from '../db/trash'
import { useApp } from '../context/AppContext'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'
import { timeAgo } from '../utils/dates'

const STORE_LABELS = {
  chapters: 'Chapter',
  characters: 'Character',
  notes: 'Note',
  world: 'Worldbuilding',
  glossary: 'Term'
}

function titleOf(store, rec) {
  if (store === 'chapters') return rec.title || 'Untitled chapter'
  if (store === 'characters') return rec.name || 'A character'
  if (store === 'notes') return rec.title || 'Untitled note'
  if (store === 'glossary') return rec.term || 'Untitled term'
  return rec.name || 'Untitled entry'
}

export default function Trash({ novelId, embedded }) {
  const { id } = useParams()
  const nid = novelId || id
  const { toast } = useApp()
  const [items, setItems] = useState([])
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [purgeTarget, setPurgeTarget] = useState(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')

  const load = useCallback(async () => {
    setItems(await listTrash(nid))
  }, [nid])

  useEffect(() => {
    load()
  }, [load])

  const restore = async (store, rec) => {
    await restoreTrashed(store, rec.id)
    setItems(await listTrash(nid))
    toast('Back on the shelf.')
  }

  const purge = async () => {
    if (!purgeTarget) return
    await purgeTrashed(purgeTarget.store, purgeTarget.rec.id)
    setPurgeTarget(null)
    setItems(await listTrash(nid))
    toast('Removed for good.')
  }

  const clearAll = async () => {
    const n = await emptyTrash(nid)
    setConfirmEmpty(false)
    setItems(await listTrash(nid))
    toast(n ? `Emptied ${n} ${n === 1 ? 'item' : 'items'}.` : 'The trash is already empty.')
  }
  const visible = items.filter(({ store, rec }) => (type === 'all' || store === type) && titleOf(store, rec).toLowerCase().includes(query.toLowerCase()))

  return (
    <div className={embedded ? undefined : 'app'}>
      <div className="page page-wide trash-studio">
        <div className="trash-hero">
          <div>
            <span className="eyebrow">Archive recovery</span><h2 style={{ margin: 0 }}>Trash</h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              Deleted chapters, characters, notes and worldbuilding — recoverable for 30 days.
            </p>
          </div>
          <div className="trash-meter"><Icon icon="fa-regular fa-clock"/><b>30</b><small>days protected</small></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="button button-ghost" onClick={load} title="Refresh">
              <Icon icon="fa-solid fa-arrows-rotate" />
            </button>
            {items.length > 0 && (
              <button className="button button-ghost" onClick={() => setConfirmEmpty(true)}>
                <Icon icon="fa-solid fa-trash-can" style={{ marginRight: 6 }} /> Empty trash
              </button>
            )}
          </div>
        </div>

        {items.length > 0 && <div className="trash-tools"><label><Icon icon="fa-solid fa-magnifying-glass"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search deleted items"/></label><div className="pill-toggle">{['all',...new Set(items.map((item) => item.store))].map((key) => <button key={key} className={`pill ${type === key ? 'active' : ''}`} onClick={() => setType(key)}>{key === 'all' ? 'Everything' : STORE_LABELS[key] || key}</button>)}</div></div>}

        {items.length === 0 ? (
          <EmptyState icon="fa-solid fa-trash-can" title="Nothing in the trash">
            Whatever you remove will wait here quietly for thirty days, in case you change your mind.
          </EmptyState>
        ) : (
          <div className="trash-grid">
            {visible.map(({ store, rec }) => (
              <div key={`${store}:${rec.id}`} className="trash-row">
                <span className="trash-item-icon"><Icon icon={store === 'chapters' ? 'fa-regular fa-file-lines' : store === 'characters' ? 'fa-regular fa-user' : 'fa-regular fa-note-sticky'}/></span><div className="trash-copy"><span className="tag">{STORE_LABELS[store] || store}</span><span className="trash-title">{titleOf(store, rec)}</span><span className="muted small">Deleted {timeAgo(rec.trashedAt)}</span></div>
                <div className="actions-row">
                  <button className="button button-ghost" onClick={() => restore(store, rec)}>
                    <Icon icon="fa-solid fa-arrow-rotate-left" style={{ marginRight: 6 }} /> Restore
                  </button>
                  <button className="button button-quiet" onClick={() => setPurgeTarget({ store, rec })}>
                    <Icon icon="fa-solid fa-trash" style={{ marginRight: 6 }} /> Delete forever
                  </button>
                </div>
              </div>
            ))}
            {!visible.length && <div className="palette-hint">No deleted items match this view.</div>}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!purgeTarget}
        onClose={() => setPurgeTarget(null)}
        onConfirm={purge}
        title="Delete this forever?"
      >
        “{purgeTarget ? titleOf(purgeTarget.store, purgeTarget.rec) : ''}” will be removed permanently and can’t be recovered.
      </ConfirmDialog>
      <ConfirmDialog open={confirmEmpty} onClose={() => setConfirmEmpty(false)} onConfirm={clearAll} title="Empty the trash?">
        Everything in the trash will be permanently deleted. This can’t be undone.
      </ConfirmDialog>
    </div>
  )
}
