import { useState } from 'react'
import Icon from '../components/Icon'

const TYPES = ['Note', 'Scene idea', 'Character', 'Worldbuilding', 'To-do']
export default function QuickCapture({ onSave, disabled = false }: { onSave: (value: string, type: string) => Promise<void>; disabled?: boolean }) {
  const [value, setValue] = useState('')
  const [type, setType] = useState('Note')
  const [saving, setSaving] = useState(false)
  const submit = async () => { if (!value.trim() || saving || disabled) return; setSaving(true); try { await onSave(value.trim(), type); setValue('') } finally { setSaving(false) } }
  return <section className="moon-quick-capture"><div><p className="moon-kicker"><Icon icon="fa-solid fa-sparkles" /> Quick capture</p><span>Capture something before it disappears.</span></div><textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder="The lighthouse should appear again in Part IV…" aria-label="Quick capture" rows={2} /><div className="moon-capture-footer"><div role="group" aria-label="Capture type">{TYPES.map((item) => <button type="button" key={item} className={type === item ? 'active' : ''} onClick={() => setType(item)}>{item}</button>)}</div><button className="moon-primary-button" type="button" disabled={!value.trim() || saving || disabled} onClick={submit}>{saving ? 'Saving…' : 'Save'}</button></div></section>
}
