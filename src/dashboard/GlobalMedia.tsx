import { useEffect, useState } from 'react'
import { listMoodboard, createTile, deleteTile, updateTile, fileToDataUrl, dataUrlBytes, MEDIA_MAX_IMAGE_BYTES } from '../db/moodboard'
import Icon from '../components/Icon'
import { useApp } from '../context/AppContext'

export default function GlobalMedia({ novels, onOpenNovel }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const [preview, setPreview] = useState<any>(null)
  const [menu, setMenu] = useState<any>(null)
  const [dragging, setDragging] = useState(false)
  const { toast } = useApp()
  const activeNovels = novels.filter((novel) => !novel.archived)
  const globalLimit = activeNovels.length * 100 * 1024 * 1024
  useEffect(() => {
    let live = true
    setLoading(true)
    Promise.all(novels.filter((novel) => !novel.archived).map(async (novel) => {
      const tiles = await listMoodboard(novel.id)
      return tiles.filter((tile) => tile.kind === 'image' && tile.image).map((tile) => ({ ...tile, novelTitle: novel.title }))
    })).then((groups) => { if (live) setItems(groups.flat().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))) }).finally(() => { if (live) setLoading(false) })
    const refresh = () => { if (live) setRefreshTick((tick) => tick + 1) }
    window.addEventListener('moonscribe:global-media-refresh', refresh)
    return () => { live = false; window.removeEventListener('moonscribe:global-media-refresh', refresh) }
  }, [novels, refreshTick])
  const usedBytes = items.reduce((total, item) => total + dataUrlBytes(item.image), 0)
  const visible = items.filter((item) => `${item.text || ''} ${item.novelTitle || ''}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'name' ? (a.text || '').localeCompare(b.text || '') : sort === 'size' ? dataUrlBytes(b.image) - dataUrlBytes(a.image) : (b.updatedAt || 0) - (a.updatedAt || 0))
  const uploadFiles = async (files) => {
    const target = activeNovels[0]
    if (!target) return toast('Create a novel before adding media.')
    for (const file of files) {
      if (!file.type?.startsWith('image/')) continue
      if (file.size > MEDIA_MAX_IMAGE_BYTES) { toast(`${file.name} is larger than 10 MB.`); continue }
      if (usedBytes + file.size > globalLimit) { toast('Global media storage is full. Remove an image before adding another.'); break }
      try { await createTile(target.id, { kind: 'image', image: await fileToDataUrl(file, 1800), text: file.name }) } catch (error) { toast(error.message || 'That image could not be added.') }
    }
    toast(`Media added to ${target.title}.`)
    window.dispatchEvent(new Event('moonscribe:global-media-refresh'))
  }
  const openMenu = (event, item) => {
    event.preventDefault()
    const menuWidth = 190
    const menuHeight = 190
    setMenu({
      item,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    })
  }
  const rename = async (item) => { const name = window.prompt('Rename image', item.text || 'Untitled image')?.trim(); if (name && name !== item.text) { await updateTile(item.id, { text: name }); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, text: name } : entry)); toast('Image renamed.') } setMenu(null) }
  return <section className="global-media-page" onClick={() => setMenu(null)}>
    <header className="global-media-heading"><div><span className="dashboard-section-label">Across your stories</span><h1>Media Library</h1><p>Every visual reference in one quiet place.</p></div><div className="global-media-count"><Icon icon="fa-regular fa-images" /><strong>{items.length}</strong><span>{(usedBytes / 1048576).toFixed(1)} MB · {Math.round(globalLimit / 1048576)} MB limit</span></div></header>
    <div className="global-media-toolbar"><label><Icon icon="fa-solid fa-magnifying-glass" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search images and novels…" /></label><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort media"><option value="recent">Recently added</option><option value="name">Name</option><option value="size">File size</option></select><label className="global-media-upload"><Icon icon="fa-solid fa-arrow-up-from-bracket" /> Add images<input hidden type="file" accept="image/*" multiple onChange={(event) => { uploadFiles(Array.from(event.target.files || [])); event.target.value = '' }} /></label></div>
    <div className={`global-media-dropzone ${dragging ? 'is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); uploadFiles(Array.from(event.dataTransfer.files || [])) }}><Icon icon="fa-solid fa-cloud-arrow-up" /><span>Drop images here to add them to {activeNovels[0]?.title || 'your first novel'}</span></div>
    {loading ? <div className="global-media-empty"><Icon icon="fa-solid fa-spinner" /><h2>Gathering your images…</h2></div> : !visible.length ? <div className="global-media-empty"><Icon icon="fa-regular fa-images" /><h2>{items.length ? 'No matching media' : 'Your visual library is empty'}</h2><p>{items.length ? 'Try a different search.' : 'Add images here or inside any novel’s Media Library.'}</p></div> : <div className="global-media-grid">{visible.map((item) => <article className="global-media-card" key={`${item.novelId}-${item.id}`} onContextMenu={(event) => openMenu(event, item)} onDoubleClick={() => setPreview(item)}><img src={item.image} alt={item.text || 'Media reference'} /><span><strong>{item.text || 'Untitled image'}</strong><small>{item.novelTitle} · {(dataUrlBytes(item.image) / 1024).toFixed(0)} KB</small></span>{menu?.item?.id === item.id && <div className="media-context-menu global-media-context" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}><button onClick={() => { setPreview(item); setMenu(null) }}><Icon icon="fa-solid fa-eye" /> Preview</button><button onClick={() => { onOpenNovel(item.novelId); setMenu(null) }}><Icon icon="fa-solid fa-folder-open" /> Manage novel</button><button onClick={() => rename(item)}><Icon icon="fa-solid fa-pen" /> Rename</button><button className="danger" onClick={async () => { await deleteTile(item.id); setItems((current) => current.filter((entry) => entry.id !== item.id)); setMenu(null); toast('Image deleted.') }}><Icon icon="fa-solid fa-trash" /> Delete</button></div>}</article>)}</div>}
    {preview && <div className="media-preview-backdrop" onClick={() => setPreview(null)}><div className="media-preview-modal" onClick={(event) => event.stopPropagation()}><button className="media-preview-close" onClick={() => setPreview(null)} aria-label="Close preview"><Icon icon="fa-solid fa-xmark" /></button><img src={preview.image} alt={preview.text || 'Image preview'} /><strong>{preview.text || 'Untitled image'}</strong><small>{preview.novelTitle} · {(dataUrlBytes(preview.image) / 1024).toFixed(0)} KB</small></div></div>}
  </section>
}
