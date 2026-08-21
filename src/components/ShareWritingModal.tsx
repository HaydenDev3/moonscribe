import { useCallback, useEffect, useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import { acceptShareInvite, createShareInvite, listNovelMembers, revokeNovelMember, sync, updateShareRoom } from '../sync/engine'
import ProfileAvatar from './ProfileAvatar'
import Select from './Select'
import { useContextMenu } from './ContextMenu'

const SHARE_ROLES = [
  { value: 'editor', label: 'Can edit', hint: 'Write and revise' },
  { value: 'commenter', label: 'Can comment', hint: 'Review, highlight and comment without editing' },
  { value: 'viewer', label: 'Can read & proofread', hint: 'Read, highlight passages and leave comments' },
]
const ACCESS_DURATIONS = [
  { value: '3600000', label: '1 hour' },
  { value: '86400000', label: '24 hours' },
  { value: '604800000', label: '7 days' },
  { value: '2592000000', label: '30 days' },
  { value: '0', label: 'No access expiry' },
]

export default function ShareWritingModal({ open, onClose, novelId, novelTitle, toast }) {
  const { openContextMenu } = useContextMenu()
  const [details, setDetails] = useState(null)
  const [role, setRole] = useState('editor')
  const [invite, setInvite] = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [maxUsers, setMaxUsers] = useState(4)
  const [accessDuration, setAccessDuration] = useState('604800000')

  const load = useCallback(async () => {
    if (!open) return
    try { const result = await listNovelMembers(novelId); setDetails(result); setMaxUsers(result.room?.maxUsers || 4); setRole(result.room?.defaultRole || 'editor') } catch (error) { setDetails({ error: error.message }) }
  }, [open, novelId])

  useEffect(() => { load() }, [load])

  const createInvite = async () => {
    setBusy(true)
    try {
      await sync()
      const result = await createShareInvite(novelId, role, Number(accessDuration) || null)
      setInvite(result)
      await navigator.clipboard?.writeText(`${window.location.origin}/dashboard?share=${result.code}`)
      toast?.('Invitation copied.')
    } catch (error) { toast?.(error.message) } finally { setBusy(false) }
  }

  const join = async () => {
    setBusy(true)
    try {
      const result = await acceptShareInvite(joinCode.trim())
      await sync()
      toast?.('Shared novel joined and synced to this device.')
      setJoinCode('')
      window.dispatchEvent(new CustomEvent('moonscribe:synced'))
      if (result?.novelId && result.novelId !== novelId) window.location.hash = `#/novel/${result.novelId}`
      else await load()
    } catch (error) { toast?.(error.message) } finally { setBusy(false) }
  }

  const people = details ? [details.owner, ...(details.members || [])].filter(Boolean) : []
  const copyInviteLink = () => {
    if (!invite?.code) return
    navigator.clipboard?.writeText(`${window.location.origin}/dashboard?share=${invite.code}`)
    toast?.('Invitation link copied.')
  }
  const shareMenu = (event) => {
    openContextMenu(event, [
      { label: 'Copy invitation link', icon: 'fa-regular fa-copy', disabled: !invite?.code, onClick: copyInviteLink },
      { label: 'Copy novel name', icon: 'fa-solid fa-book', onClick: () => navigator.clipboard?.writeText(novelTitle || 'Untitled novel') },
      'divider',
      { label: 'Refresh collaborators', icon: 'fa-solid fa-rotate', onClick: load },
      { label: 'Close sharing', icon: 'fa-solid fa-xmark', onClick: onClose },
    ])
  }
  const saveRoom = async () => {
    setBusy(true)
    try { await updateShareRoom(novelId, { maxUsers, defaultRole: role }); toast?.('Collaborative room settings saved.'); await load() }
    catch (error) { toast?.(error.message) } finally { setBusy(false) }
  }
  return <Modal open={open} onClose={onClose} title={`Share “${novelTitle || 'novel'}”`} width={620} className="share-glass-modal">
    <span className="share-modal-aurora" aria-hidden="true" />
    <div className="share-writing" onContextMenu={shareMenu}>
      <section className="share-session-hero">
        <span className="share-room-mark"><Icon icon="fa-solid fa-user-group" /></span>
        <div><span className="share-kicker"><Icon icon="fa-solid fa-lock" /> Invite-only workspace</span><strong>Write together, privately.</strong><p>Give trusted collaborators access to this novel. Every invitation expires, and access can be revoked at any time.</p></div>
        <span className="share-room-status"><i aria-hidden="true" /> Private</span>
      </section>
      {details?.error ? <div className="share-signin-note"><Icon icon="fa-solid fa-lock" /> {details.error}</div> : <>
        <div className="share-people">
          <div className="share-section-heading"><div><span>Collaborators</span><h4>People with access</h4></div><b>{people.length}</b></div>
          <div className="share-member-list">
            {people.map((person) => <div className="share-person" key={person.id} onContextMenu={(event) => { event.stopPropagation(); openContextMenu(event, [
              { label: `Copy ${person.username}`, icon: 'fa-regular fa-copy', onClick: () => navigator.clipboard?.writeText(person.username) },
              { label: 'Refresh presence', icon: 'fa-solid fa-rotate', onClick: load },
              ...(details.role === 'owner' && person.role !== 'owner' ? ['divider', { label: `Remove ${person.username}`, icon: 'fa-solid fa-user-minus', danger: true, onClick: async () => { await revokeNovelMember(novelId, person.id); await load() } }] : [])
            ]) }}><span className="share-avatar"><ProfileAvatar src={person.avatar} name={person.username} /><i className={`presence-dot ${person.status || 'offline'}`} /></span><div><strong>{person.username}</strong><small><Icon icon={person.role === 'owner' ? 'fa-solid fa-crown' : 'fa-solid fa-pen-nib'} /> {person.role} · {person.status || 'offline'}{person.expiresAt ? ` · until ${new Date(person.expiresAt).toLocaleString()}` : ''}</small></div>{details.role === 'owner' && person.role !== 'owner' && <button className="share-remove" title={`Remove ${person.username}`} onClick={async () => { await revokeNovelMember(novelId, person.id); await load() }}><Icon icon="fa-solid fa-user-minus" /><span>Remove</span></button>}</div>)}
          </div>
        </div>
        {details?.role === 'owner' && <><section className="share-room-settings"><div className="share-section-heading"><div><span>Live room</span><h4>Capacity and default access</h4></div></div><div className="share-room-setting-row"><label><span>Maximum users</span><input type="number" min="2" max="12" value={maxUsers} onChange={(event) => setMaxUsers(Number(event.target.value))} /></label><div className="share-role-select"><Icon icon="fa-solid fa-key" /><Select className="share-permission-select" popClassName="share-permission-menu" ariaLabel="Default room permission" width="100%" value={role} onChange={setRole} options={SHARE_ROLES} renderLabel={(option) => <span><strong>{option.label}</strong><small>{option.hint}</small></span>} /></div><button className="button button-ghost" disabled={busy} onClick={saveRoom}>Save room</button></div><p><Icon icon="fa-solid fa-signal" /> Guests can connect only while the owner is live. Up to {maxUsers} people including the owner.</p></section><section className="share-invite"><div className="share-section-heading"><div><span>New invitation</span><h4>Invite with {SHARE_ROLES.find((item) => item.value === role)?.label.toLowerCase()}</h4></div></div><div className="share-expiry-row"><span><Icon icon="fa-regular fa-clock" /> Access expires</span><Select ariaLabel="Shared novel access expiry" width="100%" value={accessDuration} onChange={setAccessDuration} options={ACCESS_DURATIONS} /></div><div className="share-invite-row"><div className="share-invite-summary"><Icon icon="fa-solid fa-user-shield" /><span>{SHARE_ROLES.find((item) => item.value === role)?.hint} · {ACCESS_DURATIONS.find((item) => item.value === accessDuration)?.label}</span></div><button className="button button-primary" disabled={busy || people.length >= maxUsers} onClick={createInvite}><Icon icon="fa-solid fa-link" /> {busy ? 'Creating…' : people.length >= maxUsers ? 'Room full' : 'Create invite'}</button></div></section></>}
        {invite?.code && <div className="share-code"><span><Icon icon="fa-solid fa-circle-check" /></span><div><small>Invitation ready{invite.expiresAt ? ` · valid until ${new Date(invite.expiresAt).toLocaleString()}` : ''}{invite.accessExpiresAt ? ` · access until ${new Date(invite.accessExpiresAt).toLocaleString()}` : ''}</small><code>{invite.code}</code></div><button className="button button-ghost" onClick={copyInviteLink}><Icon icon="fa-regular fa-copy" /> Copy link</button></div>}
      </>}
      <div className="share-join"><div className="share-section-heading"><div><span>Joining someone else?</span><h4>Use an invitation</h4></div></div><div><label><Icon icon="fa-solid fa-ticket" /><input aria-label="Invitation code" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Paste invite code" /></label><button className="button button-ghost" disabled={busy || !joinCode.trim()} onClick={join}>Join room <Icon icon="fa-solid fa-arrow-right" /></button></div></div>
    </div>
  </Modal>
}
