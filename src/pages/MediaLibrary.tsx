import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { listMoodboard, createTile, deleteTile, updateTile, fileToDataUrl, dataUrlBytes, MEDIA_MAX_BYTES, MEDIA_MAX_IMAGE_BYTES } from '../db/moodboard'
import { getNovel } from '../db/novels'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import { ASSET_MIME } from '../designs/assets'
import { PAGE_TEMPLATES, TEMPLATE_MIME } from '../designs/pageTemplates'
import { DESIGN_MIME } from '../designs/registry'

const TEMPLATE_ASSETS = [
  { id: 'divider-stars', category: 'Dividers', title: 'Star dividers', glyph: '✦  ───  ✦', tone: 'moonlight' },
  { id: 'divider-ornament', category: 'Dividers', title: 'Ornament dividers', glyph: '❦  ───  ❦', tone: 'parchment' },
  { id: 'corner-classic', category: 'Corners & flourishes', title: 'Classic corners', glyph: '╔        ╗', tone: 'parchment' },
  { id: 'corner-moon', category: 'Corners & flourishes', title: 'Moon corners', glyph: '☾        ✧', tone: 'midnight' },
  { id: 'icon-moon', category: 'Icons', title: 'Moon icon', glyph: '☾', tone: 'moonlight' },
  { id: 'icon-stars', category: 'Icons', title: 'Star cluster', glyph: '✦ ✧ ✦', tone: 'celestial' },
  { id: 'badge-moon', category: 'Badges', title: 'Moon badge', glyph: '☾', tone: 'midnight' },
  { id: 'badge-seal', category: 'Badges', title: 'Author seal', glyph: '✧', tone: 'parchment' },
  { id: 'label-genre', category: 'Labels', title: 'Genre labels', glyph: 'FANTASY  ·  ROMANCE', tone: 'modern' },
  { id: 'label-status', category: 'Labels', title: 'Status labels', glyph: 'DRAFT  ·  REVISED', tone: 'celestial' },
  { id: 'placeholder-mountain', category: 'Placeholder art', title: 'Mountain placeholder', glyph: '△  △  △', tone: 'moonlight' },
  { id: 'placeholder-constellation', category: 'Placeholder art', title: 'Constellation placeholder', glyph: '·✦·  ·☾·', tone: 'celestial' },
]

const ASSET_DRAG_PROPS = (asset) => ({ draggable: true, onDragStart: (event) => { event.dataTransfer.setData(ASSET_MIME, JSON.stringify(asset)); event.dataTransfer.effectAllowed = 'copy' } })
const PageTemplateCards = () => <section className="media-library-section media-page-templates"><div className="settings-subheading">Page templates</div><p className="muted">These use the same design system as Designs. Drag one into the Editor or choose it from Designs.</p><div className="media-page-template-grid">{PAGE_TEMPLATES.map((template) => <button type="button" draggable key={template.id} onDragStart={(event) => { event.dataTransfer.setData(DESIGN_MIME, `page-${template.id.replace('chapter-opening', 'chapter').replace('map-notes', 'map')}`); event.dataTransfer.effectAllowed = 'copy' }}><span>{template.icon}</span><strong>{template.title}</strong><small>{template.description}</small></button>)}</div></section>

const TEMPLATE_PACKS = [
  { id: 'moonlight-minimal', title: 'Moonlight Minimal', description: 'Ivory, midnight blue, silver', tone: 'moonlight', assets: 'Cover · chapters · dashboard · dividers' },
  { id: 'celestial-glass', title: 'Celestial Glass', description: 'Translucent navy, cyan, violet', tone: 'celestial', assets: 'Dashboard · cards · icons · thumbnails' },
  { id: 'dark-academia', title: 'Dark Academia', description: 'Charcoal, oxblood, antique gold', tone: 'academia', assets: 'Covers · lore notes · labels · seals' },
  { id: 'fantasy-parchment', title: 'Fantasy Parchment', description: 'Parchment, ink, muted teal', tone: 'parchment', assets: 'Manuscript · locations · timeline · corners' },
  { id: 'modern-editorial', title: 'Modern Editorial', description: 'White, deep navy, cobalt', tone: 'modern', assets: 'Project pages · research · dashboard · mobile' },
]

export default function MediaLibrary({ novelId, embedded = false }) {
  const { toast } = useApp()
  const [novel, setNovel] = useState<any>(null)
  const [media, setMedia] = useState<any[]>([])
  const [storageBytes, setStorageBytes] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [contextMenu, setContextMenu] = useState<any>(null)
  const [tab, setTab] = useState<'assets' | 'templates'>('assets')
  const [sort, setSort] = useState<'updated' | 'abc' | 'cba'>('updated')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setNovel(await getNovel(novelId))
    const tiles = await listMoodboard(novelId)
    const images = tiles.filter((tile) => tile.kind === 'image' && tile.image)
    setMedia(images.sort((a, b) => sort === 'abc' ? String(a.text || '').localeCompare(String(b.text || '')) : sort === 'cba' ? String(b.text || '').localeCompare(String(a.text || '')) : (b.updatedAt || 0) - (a.updatedAt || 0)))
    setStorageBytes(images.reduce((total, tile) => total + dataUrlBytes(tile.image), 0))
  }, [novelId, sort])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (tab !== 'templates') return undefined
    const buttons = [...document.querySelectorAll('.media-template-asset')]
    const cleanups = buttons.map((button, index) => {
      const asset = TEMPLATE_ASSETS[index]
      button.setAttribute('draggable', 'true')
      const drag = (event) => { event.dataTransfer.setData(ASSET_MIME, JSON.stringify(asset)); event.dataTransfer.effectAllowed = 'copy' }
      button.addEventListener('dragstart', drag)
      return () => button.removeEventListener('dragstart', drag)
    })
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [tab])
  const upload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > MEDIA_MAX_IMAGE_BYTES) { toast('Images must be 10 MB or smaller.'); return }
    try {
      const image = await fileToDataUrl(file, 1800)
      await createTile(novelId, { kind: 'image', image, text: file.name })
      await load()
      toast('Image added to your Media Library.')
    } catch (error) { toast(error.message || 'That image could not be added.') }
  }

  const dropUpload = async (event) => {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer?.files || []) as File[]
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    for (const file of imageFiles) {
      if (file.size > MEDIA_MAX_IMAGE_BYTES) { toast(`${file.name} is larger than 10 MB.`); continue }
      try { await createTile(novelId, { kind: 'image', image: await fileToDataUrl(file, 1800), text: file.name }) } catch (error) { toast(error.message); break }
    }
    if (imageFiles.length) { await load(); toast('Media Library updated.') }
  }

  const cover = novel?.layout?.cover || {}
  const coverItems = [
    ['frontImage', 'Cover front'], ['backImage', 'Cover back'], ['spineImage', 'Cover spine']
  ].filter(([key]) => cover[key]).map(([key, label]) => ({ id: `cover-${key}`, image: cover[key], text: label, cover: true }))
  const openMenu = (event, item) => { event.preventDefault(); const width = 190; const height = 150; setContextMenu({ x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)), item }) }
  const rename = async (item) => { const name = window.prompt('Rename image', item.text || 'Untitled image')?.trim(); if (name && name !== item.text) { await updateTile(item.id, { text: name }); await load(); toast('Image renamed.') } setContextMenu(null) }

  return <section className={`media-library ${embedded ? 'media-library-embedded' : ''}`} onClick={() => setContextMenu(null)}>
    <header className="media-library-header"><div><span className="settings-panel-kicker">Craft</span><h2>Media Library</h2><p>Keep cover artwork, visual references, and MoonScribe design assets together.</p><div className="media-storage"><span>Storage</span><b>{(storageBytes / 1048576).toFixed(1)} MB / 100 MB</b><i><em style={{ width: `${Math.min(100, storageBytes / MEDIA_MAX_BYTES * 100)}%` }} /></i><small>Maximum {MEDIA_MAX_IMAGE_BYTES / 1048576} MB per image</small></div></div><div className="media-library-header-actions"><button className="button button-secondary" onClick={() => document.querySelector('.media-library')?.requestFullscreen?.()}><Icon icon="fa-solid fa-expand" /> Full screen</button>{tab === 'assets' && <button className="button button-primary" onClick={() => fileRef.current?.click()}><Icon icon="fa-solid fa-arrow-up-from-bracket" /> Add image</button>}</div></header>
    <input ref={fileRef} hidden type="file" accept="image/*" onChange={upload} />
    <div className="media-library-tabs" role="tablist" aria-label="Media Library sections"><button type="button" role="tab" aria-selected={tab === 'assets'} className={tab === 'assets' ? 'active' : ''} onClick={() => setTab('assets')}><Icon icon="fa-regular fa-images" /> Your Assets</button><button type="button" role="tab" aria-selected={tab === 'templates'} className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}><Icon icon="fa-solid fa-swatchbook" /> Templates</button></div>
    {tab === 'templates' && <PageTemplateCards />}
    {tab === 'assets' ? <><div className="media-folder-shelf"><button className="media-folder-card active" type="button"><Icon icon="fa-solid fa-folder-open" /><span><strong>Media</strong><small>{media.length} files</small></span></button><button className="media-folder-card" type="button" onClick={() => toast('Cover artwork is managed from Book Designer.') }><Icon icon="fa-solid fa-folder" /><span><strong>Cover artwork</strong><small>{coverItems.length} files</small></span></button><button className="media-folder-card media-folder-add" type="button" onClick={() => fileRef.current?.click()}><Icon icon="fa-solid fa-plus" /><span><strong>Add files</strong><small>Upload to Media</small></span></button></div><div className={`media-dropzone ${dragging ? 'is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={dropUpload}><Icon icon="fa-solid fa-cloud-arrow-up" /><strong>Drop images here</strong><span>or use Add image to browse your files</span></div><div className="media-library-section"><div className="media-folder-toolbar"><div className="settings-subheading">Recent files</div><select aria-label="Sort media" value={sort} onChange={(event) => setSort(event.target.value as any)}><option value="updated">Recently added</option><option value="abc">A–Z</option><option value="cba">Z–A</option></select></div><div className="media-library-grid">{media.map((item) => <article className="media-card" key={item.id} draggable onDragStart={() => setDraggingId(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={async (event) => { event.preventDefault(); if (!draggingId || draggingId === item.id) return; const from = media.findIndex((entry) => entry.id === draggingId); const to = media.findIndex((entry) => entry.id === item.id); const next = [...media]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); setMedia(next); setDraggingId(null); await Promise.all(next.map((entry, index) => updateTile(entry.id, { order: index }))) }} onDragEnd={() => setDraggingId(null)} onContextMenu={(event) => openMenu(event, item)} onDoubleClick={() => setPreview(item)}><img src={item.image} alt={item.text || 'Visual reference'} /><footer><strong>{item.text || 'Untitled image'}</strong><button className="media-delete" onClick={async () => { await deleteTile(item.id); await load(); toast('Image removed.') }} aria-label={`Delete ${item.text || 'image'}`}><Icon icon="fa-solid fa-trash" /></button></footer></article>)}{!media.length && <p className="muted">Add images here for references, moodboards and inspiration.</p>}</div></div></> : <div className="media-template-library"><section><div className="settings-subheading">MoonScribe template packs</div><p className="muted">Complete visual systems based on the MoonScribe design language.</p><div className="media-template-packs">{TEMPLATE_PACKS.map((pack) => <article className={`media-template-pack tone-${pack.tone}`} key={pack.id}><div className="media-template-preview"><span>☾</span><strong>{pack.title}</strong><small>{pack.assets}</small></div><footer><strong>{pack.title}</strong><span>{pack.description}</span><button type="button" onClick={() => toast(`${pack.title} template selected. Open Book Designer to apply it.`)}>Use template</button></footer></article>)}</div></section><section><div className="settings-subheading">Decorative assets &amp; components</div><div className="media-template-assets">{TEMPLATE_ASSETS.map((asset) => <button type="button" className={`media-template-asset tone-${asset.tone}`} key={asset.id} onClick={() => toast(`${asset.title} selected.`)}><span>{asset.glyph}</span><strong>{asset.title}</strong><small>{asset.category}</small></button>)}</div></section></div>}
    {contextMenu && createPortal(<div className="media-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}><button onClick={() => { setPreview(contextMenu.item); setContextMenu(null) }}><Icon icon="fa-solid fa-eye" /> Preview</button>{!contextMenu.item.cover && <button onClick={() => rename(contextMenu.item)}><Icon icon="fa-solid fa-pen" /> Rename</button>}{!contextMenu.item.cover && <button className="danger" onClick={async () => { await deleteTile(contextMenu.item.id); await load(); setContextMenu(null); toast('Image removed.') }}><Icon icon="fa-solid fa-trash" /> Delete</button>}</div>, document.body)}
    {preview && <div className="media-preview-backdrop" onClick={() => setPreview(null)}><div className="media-preview-modal" onClick={(event) => event.stopPropagation()}><button className="media-preview-close" onClick={() => setPreview(null)} aria-label="Close preview"><Icon icon="fa-solid fa-xmark" /></button><img src={preview.image} alt={preview.text || 'Image preview'} /><strong>{preview.text || 'Untitled image'}</strong></div></div>}
  </section>
}
