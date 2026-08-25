import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getNovel } from '../db/novels'
import { listMoodboard, createTile, updateTile, deleteTile, fileToDataUrl } from '../db/moodboard'
import { useApp } from '../context/AppContext'
import SubPageTopbar from '../components/SubPageTopbar'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { useContextMenu } from '../components/ContextMenu'
import Icon from '../components/Icon'
import * as THREE from 'three'

const NOTE_COLORS = ['#FFF9E8', '#FBE3E3', '#E3EDF7', '#E8F1E8', '#F5EBFA', '#FDF0DB']
const NOTE_TEXT = '#3d3a36'

export default function Moodboard({ novelId, embedded }) {
  const { id } = useParams()
  const nid = novelId || id
  const { toast } = useApp()
  const [novel, setNovel] = useState(null)
  const [tiles, setTiles] = useState([])
  const [selected, setSelected] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [dragging, setDragging] = useState(null)
  const [linkDraft, setLinkDraft] = useState(null) // { url, text } or editing tile
  const [paletteDraft, setPaletteDraft] = useState(null) // { label, palette } or editing tile
  const [zoom, setZoom] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [connecting, setConnecting] = useState(null)
  const fileRef = useRef(null)
  const boardRef = useRef(null)
  const dragState = useRef(null)
  const panState = useRef(null)

  const load = useCallback(async () => {
    setNovel(await getNovel(nid))
    setTiles(await listMoodboard(nid))
  }, [nid])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const refreshSharedBoard = (event) => {
      if (String(event.detail?.novelId || '') === String(nid)) load()
    }
    window.addEventListener('moonscribe:shared-media-refresh', refreshSharedBoard)
    return () => window.removeEventListener('moonscribe:shared-media-refresh', refreshSharedBoard)
  }, [load, nid])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') setFullscreen(false)
      if ((event.key === 'f' || event.key === 'F') && !event.target.closest('input,textarea')) setFullscreen((value) => !value)
      if ((event.metaKey || event.ctrlKey) && event.key === '0') { event.preventDefault(); setZoom(1); setPan({ x: 0, y: 0 }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const paste = async (event) => {
      const file = [...(event.clipboardData?.files || [])].find((item) => item.type.startsWith('image/'))
      if (!file) return
      event.preventDefault()
      const image = await fileToDataUrl(file)
      await createTile(nid, { kind: 'image', x: rand(), y: rand(), image })
      setTiles(await listMoodboard(nid))
      toast('Image pasted onto the board.')
    }
    window.addEventListener('paste', paste)
    return () => window.removeEventListener('paste', paste)
  }, [nid, toast])

  const smartStack = async () => {
    const groups = ['note', 'image', 'link', 'palette']
    const next = tiles.map((tile) => {
      const column = Math.max(0, groups.indexOf(tile.kind))
      const row = tiles.filter((candidate) => candidate.kind === tile.kind).findIndex((candidate) => candidate.id === tile.id)
      return { ...tile, x: 42 + column * 250, y: 46 + row * 188, stack: tile.kind }
    })
    setTiles(next)
    await Promise.all(next.map((tile) => updateTile(tile.id, { x: tile.x, y: tile.y, stack: tile.stack })))
    toast('Smart stacks arranged by type.')
  }

  const connectTile = async (target) => {
    if (!connecting) { setConnecting(target.id); toast('Choose another tile to connect.'); return }
    if (connecting === target.id) { setConnecting(null); return }
    const source = tiles.find((tile) => tile.id === connecting)
    await updateTile(source.id, { links: [...new Set([...(source.links || []), target.id])] })
    setConnecting(null)
    setTiles(await listMoodboard(nid))
  }

  const addNote = async (color = NOTE_COLORS[0]) => {
    const tile = await createTile(nid, { kind: 'note', x: rand(), y: rand(), color, text: '' })
    setTiles(await listMoodboard(nid))
    setSelected(tile.id)
    toast('A note to pin.')
  }

  const addImage = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await fileToDataUrl(file)
      const tile = await createTile(nid, { kind: 'image', x: rand(), y: rand(), image: dataUrl })
      setTiles(await listMoodboard(nid))
      setSelected(tile.id)
      toast('Pinned to the board.')
    } catch (err) {
      toast(err.message)
    }
  }

  const clearBoard = async () => {
    for (const t of tiles) await deleteTile(t.id)
    setConfirmClear(false)
    setSelected(null)
    setTiles([])
    toast('A blank board again.')
  }

  // ---- drag ----
  const onPointerDown = (e, tile) => {
    if (e.button === 2) return
    e.preventDefault()
    e.stopPropagation()
    setSelected(tile.id)
    const rect = boardRef.current?.getBoundingClientRect()
    const localX = rect ? (e.clientX - rect.left) / zoom : e.clientX
    const localY = rect ? (e.clientY - rect.top) / zoom : e.clientY
    dragState.current = { id: tile.id, dx: localX - (tile.x || 0), dy: localY - (tile.y || 0), moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(tile.id)
  }

  const { openContextMenu } = useContextMenu()
  const tileMenu = (e, t) => {
    setSelected(t.id)
    openContextMenu(e, [
      ...(t.kind === 'note' ? [{ label: 'Edit note', icon: 'fa-solid fa-pen', onClick: () => setSelected(t.id) }] : []),
      ...(t.kind === 'link' ? [{ label: 'Open link', icon: 'fa-solid fa-arrow-up-right-from-square', onClick: () => openLink(t) }] : []),
      ...(t.kind === 'link' ? [{ label: 'Edit link', icon: 'fa-solid fa-pen', onClick: () => setLinkDraft(t) }] : []),
      ...(t.kind === 'palette' ? [{ label: 'Edit palette', icon: 'fa-solid fa-pen', onClick: () => setPaletteDraft(t) }] : []),
      {
        label: 'Duplicate',
        icon: 'fa-regular fa-copy',
        onClick: async () => {
          await createTile(nid, { kind: t.kind, x: (t.x || 0) + 28, y: (t.y || 0) + 28, color: t.color, text: t.text, image: t.image, url: t.url, palette: t.palette, w: t.w, h: t.h })
          setTiles(await listMoodboard(nid))
          toast('Copied.')
        }
      },
      { label: 'Remove tile', icon: 'fa-solid fa-trash', danger: true, onClick: async () => {
        await deleteTile(t.id)
        if (selected === t.id) setSelected(null)
        setTiles(await listMoodboard(nid))
        toast('Taken down.')
      } }
      ,{ label: connecting ? 'Connect here' : 'Start connection', icon: 'fa-solid fa-share-nodes', onClick: () => connectTile(t) }
    ])
  }

  const openLink = (t) => {
    const url = /^https?:\/\//i.test(t.url) ? t.url : `https://${t.url}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const saveLink = async () => {
    if (!linkDraft) return
    const url = (linkDraft.url || '').trim()
    if (!url) return
    if (linkDraft.id) {
      await updateTile(linkDraft.id, { url, text: (linkDraft.text || '').trim() })
      toast('Link updated.')
    } else {
      await createTile(nid, { kind: 'link', x: rand(), y: rand(), url, text: (linkDraft.text || '').trim() })
      toast('A reference to keep close.')
    }
    setLinkDraft(null)
    setTiles(await listMoodboard(nid))
  }

  const savePalette = async () => {
    if (!paletteDraft) return
    const palette = (paletteDraft.palette || []).filter(Boolean).map((c) => c.trim())
    if (!palette.length) return
    if (paletteDraft.id) {
      await updateTile(paletteDraft.id, { palette, text: (paletteDraft.label || '').trim() })
      toast('Palette tuned.')
    } else {
      await createTile(nid, { kind: 'palette', x: rand(), y: rand(), palette, text: (paletteDraft.label || '').trim() })
      toast('A palette to match the mood.')
    }
    setPaletteDraft(null)
    setTiles(await listMoodboard(nid))
  }

  const onPointerMove = (e, tile) => {
    if (dragState.current?.id !== tile.id) return
    const { dx, dy } = dragState.current
    const rect = boardRef.current?.getBoundingClientRect()
    const localX = rect ? (e.clientX - rect.left) / zoom : e.clientX
    const localY = rect ? (e.clientY - rect.top) / zoom : e.clientY
    dragState.current.moved = true
    const x = Math.max(0, localX - dx)
    const y = Math.max(0, localY - dy)
    setTiles((prev) => prev.map((t) => (t.id === tile.id ? { ...t, x, y } : t)))
  }

  const onPointerUp = (tile) => {
    const st = dragState.current
    dragState.current = null
    setDragging(null)
    if (!st || !st.moved) return
    const moved = tiles.find((t) => t.id === tile.id)
    if (moved) updateTile(tile.id, { x: moved.x, y: moved.y })
  }

  const onBoardWheel = (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      setZoom((value) => Math.min(1.8, Math.max(.5, value - event.deltaY * .001)))
    }
  }

  const onBoardPointerDown = (event) => {
    if (event.target !== event.currentTarget || event.button !== 0) return
    panState.current = { x: event.clientX, y: event.clientY, pan }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onBoardPointerMove = (event) => {
    if (!panState.current) return
    setPan({ x: panState.current.pan.x + event.clientX - panState.current.x, y: panState.current.pan.y + event.clientY - panState.current.y })
  }
  const onBoardPointerUp = () => { panState.current = null }

  const saveText = async (tile, text) => {
    if (text !== tile.text) {
      await updateTile(tile.id, { text })
      toast('Note pinned.')
    }
    setTiles(await listMoodboard(nid))
  }

  const removeSelected = async () => {
    if (!selected) return
    await deleteTile(selected)
    setSelected(null)
    setTiles(await listMoodboard(nid))
    toast('Taken down.')
  }

  if (!novel) {
    return <div style={{ padding: 'var(--space-7)', textAlign: 'center', color: 'var(--grey)' }}>Unrolling the board…</div>
  }

  return (
    <div className={`${embedded ? '' : 'app'} ${fullscreen ? 'moodboard-fullscreen' : ''}`}>
      {!embedded && <SubPageTopbar novel={novel} title="Moodboard" />}
      <div className="page page-wide moodboard-page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>Moodboard</h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>Images and notes, scattered like a desk in full swing. Drag them anywhere.</p>
          </div>
          <div className="actions-row">
            <button className="button button-ghost" onClick={() => addNote(NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)])}>
              <Icon icon="fa-solid fa-pen" style={{ marginRight: 6 }} /> Add note
            </button>
            <button className="button button-ghost" onClick={() => fileRef.current?.click()}>
              <Icon icon="fa-regular fa-image" style={{ marginRight: 6 }} /> Add image
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={addImage} />
            <button className="button button-ghost" onClick={() => setLinkDraft({})}>
              <Icon icon="fa-solid fa-link" style={{ marginRight: 6 }} /> Add link
            </button>
            <button className="button button-ghost" onClick={() => setPaletteDraft({})}>
              <Icon icon="fa-solid fa-palette" style={{ marginRight: 6 }} /> Add palette
            </button>
            <button className="button button-ghost" onClick={smartStack}><Icon icon="fa-solid fa-layer-group" style={{ marginRight: 6 }} /> Smart stack</button>
            <div className="mb-zoom" aria-label="Moodboard zoom controls">
              <button onClick={() => setZoom((value) => Math.max(.5, value - .1))} aria-label="Zoom out">−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((value) => Math.min(1.8, value + .1))} aria-label="Zoom in">+</button>
            </div>
            <button className="button button-ghost" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>Fit board</button>
            <button className="button button-ghost" onClick={() => setFullscreen((value) => !value)}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button>
            {selected && (
              <button className="button button-rose" onClick={removeSelected}>Remove selected</button>
            )}
            {tiles.length > 0 && (
              <button className="button button-quiet" onClick={() => setConfirmClear(true)}>Clear board</button>
            )}
          </div>
        </div>

          <div ref={boardRef} className="moodboard moodboard-spatial" onClick={() => setSelected(null)} onWheel={onBoardWheel} onPointerDown={onBoardPointerDown} onPointerMove={onBoardPointerMove} onPointerUp={onBoardPointerUp}>
            <MoodboardScene3D />
            {tiles.length === 0 && <div className="mb-empty-overlay">
              <Icon icon="fa-regular fa-images" />
              <h3>Build the world around your story</h3>
              <p>Drop or paste an image, pin a thought, then drag everything into place.</p>
              <div className="actions-row"><button className="button button-primary" onClick={(e) => { e.stopPropagation(); addNote() }}>Pin a note</button><button className="button button-ghost" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}>Add an image</button></div>
            </div>}
            <div className="moodboard-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <svg className="mb-connections" aria-hidden="true">
              {tiles.flatMap((source) => (source.links || []).map((targetId) => {
                const target = tiles.find((tile) => tile.id === targetId)
                if (!target) return null
                return <line key={`${source.id}-${targetId}`} x1={(source.x || 0) + (source.w || 200) / 2} y1={(source.y || 0) + (source.h || 150) / 2} x2={(target.x || 0) + (target.w || 200) / 2} y2={(target.y || 0) + (target.h || 150) / 2} />
              }))}
            </svg>
            {tiles.map((t) => (
              <Tile
                key={t.id}
                tile={t}
                selected={selected === t.id}
                dragging={dragging === t.id}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onSaveText={saveText}
                onSelect={() => setSelected(t.id)}
                onContextMenu={(e) => tileMenu(e, t)}
              />
            ))}
            </div>
          </div>
      </div>

      <ConfirmDialog open={confirmClear} onClose={() => setConfirmClear(false)} onConfirm={clearBoard} title="Clear the whole board?">
        Every pinned image and note on this board will be removed.
      </ConfirmDialog>
      <LinkModal draft={linkDraft} onClose={() => setLinkDraft(null)} onSave={saveLink} />
      <PaletteModal draft={paletteDraft} onChange={setPaletteDraft} onClose={() => setPaletteDraft(null)} onSave={savePalette} />
    </div>
  )
}

function MoodboardScene3D() {
  const ref = useRef(null)
  useEffect(() => {
    const mount = ref.current
    if (!mount) return
    let renderer
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }) } catch { return }
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 100)
    camera.position.set(0, 5.6, 8)
    camera.lookAt(0, 0, 0)
    const grid = new THREE.GridHelper(18, 36, 0x8ba7c4, 0x3d4858)
    grid.material.transparent = true; grid.material.opacity = .22
    scene.add(grid)
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5))
    mount.appendChild(renderer.domElement)
    const resize = () => { const rect = mount.getBoundingClientRect(); renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / Math.max(1, rect.height); camera.updateProjectionMatrix() }
    const observer = new ResizeObserver(resize); observer.observe(mount); resize()
    let frame
    const draw = () => { grid.rotation.y += .00035; renderer.render(scene, camera); frame = requestAnimationFrame(draw) }
    draw()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.dispose(); grid.geometry.dispose(); grid.material.dispose(); mount.replaceChildren() }
  }, [])
  return <div ref={ref} className="moodboard-three" aria-hidden="true" />
}

function LinkModal({ draft, onClose, onSave }) {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  useEffect(() => {
    if (draft) {
      setUrl(draft.url || '')
      setText(draft.text || '')
    }
  }, [draft])
  if (!draft) return null
  return (
    <Modal open onClose={onClose} title={draft.id ? 'Edit link' : 'Pin a reference'} width={440}>
      <div className="field">
        <label>URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="pinterest.com/board/cape-light" autoFocus onKeyDown={(e) => e.key === 'Enter' && url.trim() && onSave()} />
      </div>
      <div className="field">
        <label>Label <span className="hint">(optional)</span></label>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Cape storm references" />
      </div>
      <div className="modal-foot">
        <button className="button button-ghost" onClick={onClose}>Cancel</button>
        <button className="button button-primary" disabled={!url.trim()} onClick={onSave}>Pin link</button>
      </div>
    </Modal>
  )
}

const DEFAULT_PALETTE = ['#7BA3C9', '#D4A5A5', '#A8C5A8', '#E3C18A', '#3d3a36']

function PaletteModal({ draft, onChange, onClose, onSave }) {
  const palette = draft?.palette?.length ? draft.palette : DEFAULT_PALETTE
  const setSwatch = (i, value) => {
    const next = [...palette]
    next[i] = value
    onChange({ ...draft, palette: next })
  }
  if (!draft) return null
  return (
    <Modal open onClose={onClose} title={draft.id ? 'Edit palette' : 'A palette for the mood'} width={440}>
      <div className="field">
        <label>Label <span className="hint">(optional)</span></label>
        <input value={draft.label || ''} onChange={(e) => onChange({ ...draft, label: e.target.value })} placeholder="Sea-glass dusk" />
      </div>
      <div className="field">
        <label>Colours <span className="hint">click a swatch to change it</span></label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {palette.map((c, i) => (
            <label key={i} className="palette-swatch" style={{ background: c || '#ffffff' }} title={c}>
              <input type="color" value={/^#([0-9a-f]{6})$/i.test(c || '') ? c : '#7BA3C9'} onChange={(e) => setSwatch(i, e.target.value)} />
            </label>
          ))}
          {palette.length < 8 && (
            <button className="button button-quiet" onClick={() => onChange({ ...draft, palette: [...palette, '#ffffff'] })}>+</button>
          )}
        </div>
        <div className="small muted" style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {palette.map((c, i) => (
            <span key={i} style={{ fontVariantNumeric: 'tabular-nums' }}>{c || '—'}</span>
          ))}
        </div>
      </div>
      <div className="modal-foot">
        <button className="button button-ghost" onClick={onClose}>Cancel</button>
        <button className="button button-primary" disabled={!palette.some(Boolean)} onClick={onSave}>Save palette</button>
      </div>
    </Modal>
  )
}

function Tile({ tile, selected, dragging, onPointerDown, onPointerMove, onPointerUp, onSaveText, onSelect, onContextMenu }) {
  const [draft, setDraft] = useState(tile.text)
  useEffect(() => setDraft(tile.text), [tile.text])

  const tileLabel =
    tile.kind === 'image' ? 'Moodboard image'
    : tile.kind === 'link' ? (tile.text ? `Link: ${tile.text}` : 'Link tile')
    : tile.kind === 'palette' ? (tile.text ? `Palette: ${tile.text}` : 'Palette tile')
    : (tile.text ? `Note: ${tile.text}` : 'Note tile')
  const keyProps = {
    tabIndex: 0,
    role: 'button',
    'aria-label': tileLabel,
    onKeyDown: (e) => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect()
      }
    }
  }

  if (tile.kind === 'image') {
    return (
      <div
        {...keyProps}
        className={`mb-tile mb-image ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''}`}
        style={{ left: tile.x, top: tile.y, width: tile.w, height: tile.h }}
        onPointerDown={(e) => onPointerDown(e, tile)}
        onPointerMove={(e) => onPointerMove(e, tile)}
        onPointerUp={() => onPointerUp(tile)}
        onClick={(e) => { e.stopPropagation(); onSelect() }}
        onContextMenu={onContextMenu}
      >
        <img src={tile.image} alt="" draggable={false} />
        <span className="mb-handle">⋮⋮</span>
      </div>
    )
  }

  if (tile.kind === 'link') {
    return (
      <div
        {...keyProps}
        className={`mb-tile mb-link ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''}`}
        style={{ left: tile.x, top: tile.y, width: tile.w, height: tile.h }}
        onPointerDown={(e) => onPointerDown(e, tile)}
        onPointerMove={(e) => onPointerMove(e, tile)}
        onPointerUp={() => onPointerUp(tile)}
        onClick={(e) => { e.stopPropagation(); onSelect() }}
        onContextMenu={onContextMenu}
      >
        <div className="mb-link-body">
          <div className="mb-link-icon"><Icon icon="fa-solid fa-link" /></div>
          <div>
            <div className="mb-link-title">{tile.text || 'A reference'}</div>
            <div className="mb-link-url">{tile.url || ''}</div>
          </div>
        </div>
        <span className="mb-handle">⋮⋮</span>
      </div>
    )
  }

  if (tile.kind === 'palette') {
    return (
      <div
        {...keyProps}
        className={`mb-tile mb-palette ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''}`}
        style={{ left: tile.x, top: tile.y, width: tile.w, height: tile.h }}
        onPointerDown={(e) => onPointerDown(e, tile)}
        onPointerMove={(e) => onPointerMove(e, tile)}
        onPointerUp={() => onPointerUp(tile)}
        onClick={(e) => { e.stopPropagation(); onSelect() }}
        onContextMenu={onContextMenu}
      >
        <div className="mb-palette-label">{tile.text || 'Palette'}</div>
        <div className="mb-palette-row">
          {(tile.palette || []).map((c, i) => (
            <span key={i} className="mb-palette-swatch" style={{ background: c }} title={c} />
          ))}
        </div>
        <span className="mb-handle">⋮⋮</span>
      </div>
    )
  }

  return (
    <div
      {...keyProps}
      className={`mb-tile mb-note ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''}`}
      style={{ left: tile.x, top: tile.y, width: tile.w, height: tile.h, background: tile.color, color: NOTE_TEXT }}
      onPointerDown={(e) => onPointerDown(e, tile)}
      onPointerMove={(e) => onPointerMove(e, tile)}
      onPointerUp={() => onPointerUp(tile)}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onContextMenu={onContextMenu}
    >
      <textarea
        className="mb-note-input"
        value={draft}
        placeholder="a thought…"
        onFocus={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onSaveText(tile, draft)}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <span className="mb-handle">⋮⋮</span>
    </div>
  )
}

function rand() {
  return Math.floor(30 + Math.random() * 200)
}
