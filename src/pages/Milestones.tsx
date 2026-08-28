import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getNovel, updateNovel } from '../db/novels'
import { useApp } from '../context/AppContext'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icon'
import DatePicker from '../components/DatePicker'

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function fmt(dateStr) {
  if (!dateStr) return 'no date'
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Milestones({ novelId, embedded }) {
  const { id } = useParams()
  const nid = novelId || id
  const { toast } = useApp()
  const [novel, setNovel] = useState(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')

  const load = useCallback(async () => {
    setNovel(await getNovel(nid))
  }, [nid])

  useEffect(() => {
    load()
  }, [load])

  const milestones = novel?.milestones || []

  const save = async (next) => {
    await updateNovel(nid, { milestones: next })
    setNovel((n) => (n ? { ...n, milestones: next } : n))
  }

  const add = async () => {
    const t = title.trim()
    if (!t) return
    await save([...milestones, { id: uid(), title: t, date: date || null, done: false }])
    setTitle('')
    setDate('')
    toast('Milestone noted.')
  }

  const toggle = async (m) => {
    await save(milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)))
  }

  const remove = async (m) => {
    await save(milestones.filter((x) => x.id !== m.id))
    toast('Milestone set aside.')
  }

  const remaining = milestones.filter((m) => !m.done).length
  const sorted = [...milestones].sort((a, b) => (a.done === b.done ? (a.date || '').localeCompare(b.date || '') : a.done ? 1 : -1))

  return (
    <div className={embedded ? undefined : 'app'}>
      <div className="page page-wide">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>Milestones</h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              {milestones.length ? `${remaining} ahead of you` : 'Plots have turning points — name them so you can find them again.'}
            </p>
          </div>
          <div className="milestone-add">
            <DatePicker value={date} onChange={setDate} placeholder="Date (optional)" ariaLabel="Milestone date" />
          <input spellCheck className="text-field" style={{ flex: 1, minWidth: 180 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What happens next?" aria-label="Milestone title" onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button className="button button-primary" onClick={add} disabled={!title.trim()}>Add</button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <EmptyState icon="fa-solid fa-flag-checkered" title="No milestones yet">
            The reveal, the reunion, the turning point — jot them down as you plan, and they will wait here quietly.
          </EmptyState>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map((m) => (
              <div key={m.id} className={`milestone-row ${m.done ? 'done' : ''}`}>
                <button className={`milestone-check ${m.done ? 'checked' : ''}`} onClick={() => toggle(m)} aria-label={m.done ? 'Mark not done' : 'Mark done'} title={m.done ? 'Mark not done' : 'Mark done'}>
                  <Icon icon={m.done ? 'fa-solid fa-check' : ''} />
                </button>
                <span className="milestone-title">{m.title}</span>
                <span className="muted small">{fmt(m.date)}</span>
                <button className="button button-quiet" onClick={() => remove(m)} aria-label="Remove milestone">
                  <Icon icon="fa-solid fa-xmark" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
