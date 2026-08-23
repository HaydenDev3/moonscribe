import { useEffect, useRef, useState } from 'react'
import { listMoodboard, createTile, deleteTile, updateTile, fileToDataUrl, dataUrlBytes, MEDIA_MAX_BYTES, MEDIA_MAX_IMAGE_BYTES } from '../db/moodboard'
import { getNovel } from '../db/novels'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'

export default function MediaLibrary({ novelId, embedded = false }) {
  const { toast } = useApp()
  const [novel, setNovel] = useState<any>(null)
  const [media, setMedia] = useState<any[]>([])
  const [storageBytes, setStorageBytes] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [contextMenu, setContextMenu] = useState<any>(null)
  const [privacyBlur, setPrivacyBlur] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setNovel(await getNovel(novelId))
    const tiles = await listMoodboard(novelId)
    const images = tiles.filter((tile) => tile.kind === 'image' && tile.image)
    setMedia(images)
    setStorageBytes(images.reduce((total, tile) => total + dataUrlBytes(tile.image), 0))
  }
  useEffect(() => { load() }, [novelId])
  useEffect(() => {
    const hide = () => setPrivacyBlur(true)
    const show = () => { setPrivacyBlur(false); setContextMenu(null) }
    window.addEventListener('blur', hide)
    window.addEventListener('focus', show)
    const visibility = () => document.hidden ? hide() : show()
    document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('blur', hide); window.removeEventListener('focus', show); document.removeEventListener('visibilitychange', visibility) }
  }, [])

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
    const files = Array.from(event.dataTransfer?.files || []).filter((file: any) => file.type?.startsWith('image/'))
    for (const file of files) {
      if (file.size > MEDIA_MAX_IMAGE_BYTES) { toast(`${file.name} is larger than 10 MB.`); continue }
      try { await createTile(novelId, { kind: 'image', image: await fileToDataUrl(file, 1800), text: file.name }) } catch (error) { toast(error.message); break }
    }
    if (files.length) { await load(); toast('Media Library updated.') }
  }

  const cover = novel?.layout?.cover || {}
  const coverItems = [
    ['frontImage', 'Cover front'], ['backImage', 'Cover back'], ['spineImage', 'Cover spine']
  ].filter(([key]) => cover[key]).map(([key, label]) => ({ id: `cover-${key}`, image: cover[key], text: label, cover: true }))
  const openMenu = (event, item) => { event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY, item }) }
  const rename = async (item) => { const name = window.prompt('Rename image', item.text || 'Untitled image')?.trim(); if (name && name !== item.text) { await updateTile(item.id, { text: name }); await load(); toast('Image renamed.') } setContextMenu(null) }

  return <section className={`media-library ${embedded ? 'media-library-embedded' : ''} ${privacyBlur ? 'media-library-privacy-blur' : ''}`} onClick={() => setContextMenu(null)}>
    <header className="media-library-header"><div><span className="settings-panel-kicker">Craft</span><h2>Media Library</h2><p>Keep cover artwork and visual references together with this novel.</p><div className="media-storage"><span>Storage</span><b>{(storageBytes / 1048576).toFixed(1)} MB / 100 MB</b><i><em style={{ width: `${Math.min(100, storageBytes / MEDIA_MAX_BYTES * 100)}%` }} /></i><small>Maximum {MEDIA_MAX_IMAGE_BYTES / 1048576} MB per image</small></div></div><button className="button button-primary" onClick={() => fileRef.current?.click()}><Icon icon="fa-solid fa-arrow-up-from-bracket" /> Add image</button></header>
    <input ref={fileRef} hidden type="file" accept="image/*" onChange={upload} />
    <div className={`media-dropzone ${dragging ? 'is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={dropUpload}><Icon icon="fa-solid fa-cloud-arrow-up" /><strong>Drop images here</strong><span>or use Add image to browse your files</span></div>
    <div className="media-library-section"><div className="settings-subheading">Novel artwork</div><div className="media-library-grid">{coverItems.map((item) => <article className="media-card" key={item.id} onContextMenu={(event) => openMenu(event, item)} onDoubleClick={() => setPreview(item)}><img src={item.image} alt={item.text} /><footer><strong>{item.text}</strong><small>Saved in book design</small></footer></article>)}{!coverItems.length && <p className="muted">Cover artwork will appear here when you add it in Designer.</p>}</div></div>
    <div className="media-library-section"><div className="settings-subheading">Visual references</div><div className="media-library-grid">{media.map((item) => <article className="media-card" key={item.id} onContextMenu={(event) => openMenu(event, item)} onDoubleClick={() => setPreview(item)}><img src={item.image} alt={item.text || 'Visual reference'} /><footer><strong>{item.text || 'Untitled image'}</strong><button className="media-delete" onClick={async () => { await deleteTile(item.id); await load(); toast('Image removed.') }} aria-label={`Delete ${item.text || 'image'}`}><Icon icon="fa-solid fa-trash" /></button></footer></article>)}{!media.length && <p className="muted">Add images here for references, moodboards and inspiration.</p>}</div></div>
    {contextMenu && <div className="media-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}><button onClick={() => { setPreview(contextMenu.item); setContextMenu(null) }}><Icon icon="fa-solid fa-eye" /> Preview</button>{!contextMenu.item.cover && <button onClick={() => rename(contextMenu.item)}><Icon icon="fa-solid fa-pen" /> Rename</button>}{!contextMenu.item.cover && <button className="danger" onClick={async () => { await deleteTile(contextMenu.item.id); await load(); setContextMenu(null); toast('Image removed.') }}><Icon icon="fa-solid fa-trash" /> Delete</button>}</div>}
    {preview && <div className="media-preview-backdrop" onClick={() => setPreview(null)}><div className="media-preview-modal" onClick={(event) => event.stopPropagation()}><button className="media-preview-close" onClick={() => setPreview(null)} aria-label="Close preview"><Icon icon="fa-solid fa-xmark" /></button><img src={preview.image} alt={preview.text || 'Image preview'} /><strong>{preview.text || 'Untitled image'}</strong></div></div>}
    {privacyBlur && <div className="media-privacy-notice">Media hidden while MoonScribe is not active</div>}
  </section>
}
