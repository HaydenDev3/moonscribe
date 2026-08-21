import { useEffect, useRef, useState } from 'react'
import { clearPresence, getConfig, listPresence, subscribePresence, updatePresence } from '../sync/engine'
import ProfileAvatar from './ProfileAvatar'
import Icon from './Icon'

const STATUS = {
  online: { label: 'Online', color: '#62c887' },
  idle: { label: 'Idle', color: '#d8a94c' },
  dnd: { label: 'Do not disturb', color: '#df6470' },
  offline: { label: 'Offline', color: '#747986' },
}

function cursorContext() {
  const selection = window.getSelection?.()
  const node = selection?.anchorNode
  const element = node instanceof Element ? node : node?.parentElement ?? null
  const root = element?.closest('.prose[contenteditable="true"], .ProseMirror') ?? null
  if (!root || !selection?.rangeCount) return { activity: 'viewing', lineNumber: null, cursorOffset: null }
  const before = document.createRange()
  before.selectNodeContents(root)
  try { before.setEnd(selection.anchorNode, selection.anchorOffset) } catch { return { activity: 'viewing', lineNumber: null, cursorOffset: null } }
  const text = before.toString()
  const blocks = root.querySelectorAll('p,h1,h2,h3,li,blockquote')
  let lineNumber = 1
  for (const element of blocks) {
    if (element.contains(selection.anchorNode)) break
    lineNumber += Math.max(1, Math.ceil((element.textContent?.length || 0) / 72))
  }
  return { activity: root === document.activeElement || root.contains(document.activeElement) ? 'writing' : 'viewing', lineNumber, cursorOffset: text.length }
}

export default function CollaborationPresence({ novelId, chapterId, chapterTitle, workspace = 'manuscript', onPresenceChange, onRecord }) {
  const [people, setPeople] = useState([])
  const accountIdRef = useRef(null)
  const allPeopleRef = useRef([])
  const [open, setOpen] = useState(false)
  const presenceMetaRef = useRef({ novelId: null, chapterId: null, chapterTitle: '', workspace: 'manuscript' })
  const [manualStatus, setManualStatus] = useState(() => {
    try {
      return globalThis.localStorage?.getItem('moonscribe.presence') || 'online'
    } catch {
      return 'online'
    }
  })
  const lastAction = useRef(Date.now())

  const applyPeople = (next) => {
    allPeopleRef.current = next || []
    const visible = allPeopleRef.current.filter((person) => person?.id && person.id !== accountIdRef.current)
    setPeople(visible)
    onPresenceChange?.(visible)
  }

  useEffect(() => {
    const active = () => { lastAction.current = Date.now() }
    window.addEventListener('pointerdown', active, { passive: true })
    window.addEventListener('keydown', active)
    return () => { window.removeEventListener('pointerdown', active); window.removeEventListener('keydown', active) }
  }, [])

  useEffect(() => {
    presenceMetaRef.current = { novelId, chapterId, chapterTitle, workspace }
    let live = true
    let selectionTimer
    let unsubscribe = () => {}
    const heartbeat = async () => {
      try {
        const inferred = manualStatus === 'dnd' ? 'dnd' : (document.hidden || Date.now() - lastAction.current > 5 * 60_000 ? 'idle' : 'online')
        await updatePresence(novelId, chapterId, { status: inferred, workspace, tabName: chapterTitle || workspace, ...cursorContext() })
        const result = await listPresence(novelId)
        if (live) {
          applyPeople(result.people || [])
        }
      } catch {
        if (live) {
          setPeople([])
          onPresenceChange?.([])
        }
      }
    }
    const selectionChanged = () => { clearTimeout(selectionTimer); selectionTimer = setTimeout(heartbeat, 350) }
    getConfig().then((config) => {
      accountIdRef.current = config.accountId || null
      applyPeople(allPeopleRef.current)
    }).catch(() => {})
    subscribePresence(novelId, {
      onMessage: (next) => {
        if (!live) return
        applyPeople(next)
      },
      onRecord
    }).then((cleanup) => {
      unsubscribe = cleanup
    }).catch(() => {})
    heartbeat()
    const timer = setInterval(heartbeat, 10_000)
    document.addEventListener('selectionchange', selectionChanged)
    document.addEventListener('input', selectionChanged, true)

    return () => {
      live = false
      clearInterval(timer)
      clearTimeout(selectionTimer)
      document.removeEventListener('selectionchange', selectionChanged)
      document.removeEventListener('input', selectionChanged, true)
      unsubscribe()
    }
  }, [novelId, chapterId, chapterTitle, workspace, manualStatus, onPresenceChange, onRecord])

  useEffect(() => {
    const leavePresence = () => {
      const { novelId: currentNovelId, chapterId: currentChapterId, chapterTitle: currentChapterTitle, workspace: currentWorkspace } = presenceMetaRef.current
      clearPresence(currentNovelId, currentChapterId, { workspace: currentWorkspace, tabName: currentChapterTitle || currentWorkspace }).catch(() => {})
    }
    window.addEventListener('pagehide', leavePresence, { passive: true })
    window.addEventListener('beforeunload', leavePresence, { passive: true })
    return () => {
      window.removeEventListener('pagehide', leavePresence)
      window.removeEventListener('beforeunload', leavePresence)
      leavePresence()
    }
  }, [])

  const chooseStatus = (status) => {
    try {
      globalThis.localStorage?.setItem('moonscribe.presence', status)
    } catch {
      // Storage can be disabled; presence still works for the current session.
    }
    setManualStatus(status)
  }
  if (!people.length) return null
  return <div className="collab-presence-wrap">
    <button className="collab-presence" onClick={() => setOpen((value) => !value)} aria-label={`${people.length} active writer${people.length === 1 ? '' : 's'}`} aria-expanded={open}>
      {people.slice(0, 4).map((person) => <span key={person.id} className={person.chapterId === chapterId ? 'same-chapter' : ''}><ProfileAvatar src={person.avatar} name={person.username} /><i style={{ background: STATUS[person.status]?.color }} /></span>)}
      <b>{people.length}</b>
    </button>
    {open && <div className="collab-presence-panel">
      <header><div><small>LIVE WORKSPACE</small><strong>{people.length} active now</strong></div><Icon icon="fa-solid fa-wave-square" /></header>
      <div className="collab-status-picker">{['online','idle','dnd'].map((status) => <button key={status} className={manualStatus === status ? 'active' : ''} onClick={() => chooseStatus(status)}><i style={{ background: STATUS[status].color }} />{STATUS[status].label}</button>)}</div>
      <div className="collab-live-list">{people.map((person) => <article key={person.id}><span><ProfileAvatar src={person.avatar} name={person.username} /><i style={{ background: STATUS[person.status]?.color }} /></span><div><strong>{person.username}</strong><small>{person.activity === 'writing' ? 'Writing' : 'Viewing'} · {person.tabName || person.workspace}</small>{person.lineNumber && <em>Line {person.lineNumber} · cursor {person.cursorOffset}</em>}</div><b>{STATUS[person.status]?.label || 'Online'}</b></article>)}</div>
    </div>}
  </div>
}
