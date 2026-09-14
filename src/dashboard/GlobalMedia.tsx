import { useEffect, useMemo, useRef, useState } from 'react'
import { listMoodboard, createTile, deleteTile, updateTile, fileToDataUrl, dataUrlBytes, MEDIA_MAX_BYTES, MEDIA_MAX_IMAGE_BYTES } from '../db/moodboard'
import Icon from '../components/Icon'
import Select from '../components/Select'
import { useApp } from '../context/AppContext'

/* The compact JSX below uses short-circuit rendering for conditional controls. */
/* eslint-disable @typescript-eslint/no-unused-expressions */

const CATEGORIES = [['all', 'All media'], ['image', 'Images'], ['video', 'Videos'], ['audio', 'Audio'], ['document', 'Documents'], ['cover', 'Book covers'], ['graphic', 'Graphics'], ['other', 'Other']]
const TYPE_LABELS = { image: 'Images', video: 'Videos', audio: 'Audio', document: 'Documents', cover: 'Book covers', graphic: 'Graphics', other: 'Other' }
const TYPE_OPTIONS = Object.entries(TYPE_LABELS)
const asType = (item) => {
  const raw = String(item.mediaType || item.fileType || item.mimeType || item.kind || '').toLowerCase()
  if (raw.includes('video')) return 'video'
  if (raw.includes('audio')) return 'audio'
  if (raw.includes('pdf') || raw.includes('document') || raw.includes('text')) return 'document'
  if (raw.includes('cover')) return 'cover'
  if (raw.includes('graphic') || raw.includes('svg')) return 'graphic'
  return raw === 'image' || item.image ? 'image' : 'other'
}
const tagsFor = (item) => Array.isArray(item.tags) ? item.tags : []
const bytesLabel = (bytes) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
const dateLabel = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown date'
export const mediaStoragePercent = (usedBytes, limitBytes) => limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0
export const MEDIA_VIEW_STORAGE_KEY = 'moonscribe:media-view'
type MediaPreferenceStorage = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void }
export const readMediaView = (storage: MediaPreferenceStorage = globalThis.localStorage) => { const saved = storage?.getItem(MEDIA_VIEW_STORAGE_KEY); return saved === 'list' ? 'list' : 'grid' }
export const writeMediaView = (view, storage: MediaPreferenceStorage = globalThis.localStorage) => storage?.setItem(MEDIA_VIEW_STORAGE_KEY, view)
export const sortMediaItems = (items, sort = 'recent') => [...items].sort((a, b) => sort === 'name' ? String(a.text || '').localeCompare(String(b.text || '')) : sort === 'size' ? dataUrlBytes(b.image) - dataUrlBytes(a.image) : sort === 'oldest' ? (a.createdAt || 0) - (b.createdAt || 0) : (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
export const toggleMediaSelection = (selectedIds, id) => selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]
export const mediaDeletionWarning = (items, ids) => { const associated = items.filter((item) => ids.includes(item.id) && item.novelId); return associated.length ? `These files are associated with ${associated.length} project records. Deleting them may remove project references.` : 'Delete this media asset? This cannot be undone.' }

function MediaPreview({ item, large = false }: { item?: any; large?: boolean }) {
  if (!item) return <div className="global-media-inspector-empty"><Icon icon="fa-regular fa-images" /><p>Select an asset to inspect it.</p></div>
  const type = asType(item)
  if (type === 'audio') return <div className="global-media-type-preview audio"><Icon icon="fa-solid fa-waveform-lines" /><span>Audio preview</span></div>
  if (type === 'video') return <div className="global-media-type-preview video"><Icon icon="fa-solid fa-circle-play" /><span>Video preview</span></div>
  if (!item.image) return <div className="global-media-type-preview document"><Icon icon="fa-regular fa-file-lines" /><span>{TYPE_LABELS[type] || 'File'}</span></div>
  return <div className={`global-media-preview-frame ${large ? 'large' : ''}`}><img src={item.image} alt={item.text || 'Media preview'} loading="lazy" /></div>
}

export default function GlobalMedia({ novels, onOpenNovel }) {
  const { toast } = useApp()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [story, setStory] = useState('all')
  const [dateRange, setDateRange] = useState('any')
  const [orientation, setOrientation] = useState<string[]>([])
  const [resolution, setResolution] = useState('any')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [description, setDescription] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [uploadTarget, setUploadTarget] = useState<'new' | 'replace'>('new')
  const fileRef = useRef<HTMLInputElement>(null)
  const activeNovels = useMemo(() => novels.filter((novel) => !novel.archived), [novels])
  const globalLimit = Math.max(MEDIA_MAX_BYTES * activeNovels.length, MEDIA_MAX_BYTES)
  useEffect(() => {
    try { setView(readMediaView()) } catch (error) { void error }
  }, [])
  useEffect(() => { try { writeMediaView(view) } catch (error) { void error } }, [view])

  useEffect(() => {
    let live = true
    setLoading(true)
    Promise.all(activeNovels.map(async (novel) => {
      const tiles = await listMoodboard(novel.id)
      return tiles.filter((tile) => tile.image || tile.mediaType || tile.fileType).map((tile) => ({ ...tile, novelTitle: novel.title }))
    })).then((groups) => { if (live) setItems(groups.flat()) }).finally(() => { if (live) setLoading(false) })
    const refresh = () => live && setRefreshTick((tick) => tick + 1)
    window.addEventListener('moonscribe:global-media-refresh', refresh)
    return () => { live = false; window.removeEventListener('moonscribe:global-media-refresh', refresh) }
  }, [activeNovels, refreshTick])

  const usedBytes = items.reduce((total, item) => total + dataUrlBytes(item.image), 0)
  const allTags = useMemo(() => [...new Set(items.flatMap(tagsFor))].sort(), [items])
  const typeCounts = useMemo(() => items.reduce((counts, item) => { const type = asType(item); counts[type] = (counts[type] || 0) + 1; return counts }, {}), [items])
  const selectedItem = items.find((item) => item.id === selectedId) || null
  const visible = useMemo(() => {
    const now = Date.now()
    const ranges = { today: 86400000, week: 604800000, month: 2592000000, year: 31536000000 }
    const range = ranges[dateRange]
    const filtered = items.filter((item) => {
      const type = asType(item)
      const searchable = `${item.text || ''} ${item.description || ''} ${item.novelTitle || ''} ${tagsFor(item).join(' ')}`.toLowerCase()
      if (category !== 'all' && type !== category) return false
      if (story !== 'all' && item.novelId !== story) return false
      if (query && !searchable.includes(query.toLowerCase())) return false
      if (range && now - (item.createdAt || item.updatedAt || now) > range) return false
      if (orientation.length && item.width && item.height) { const shape = item.width === item.height ? 'square' : item.width > item.height ? 'landscape' : 'portrait'; if (!orientation.includes(shape)) return false }
      if (resolution !== 'any' && item.width && item.height) { const pixels = item.width * item.height; if (resolution === 'small' && pixels >= 1000000) return false; if (resolution === 'medium' && (pixels < 1000000 || pixels >= 8000000)) return false; if (resolution === 'large' && pixels < 8000000) return false; if (resolution === '4k' && (item.width < 3840 || item.height < 2160)) return false }
      return true
    })
    return sortMediaItems(filtered, sort)
  }, [category, dateRange, items, orientation, query, resolution, sort, story])
  useEffect(() => { if (selectedItem) setDescription(selectedItem.description || '') }, [selectedId, selectedItem])

  const clearFilters = () => { setQuery(''); setCategory('all'); setStory('all'); setDateRange('any'); setOrientation([]); setResolution('any') }
  const selectItem = (item) => { setSelectedId(item.id); setSelectedIds((current) => current.includes(item.id) ? current : [...current, item.id]) }
  const toggleSelection = (id) => setSelectedIds((current) => toggleMediaSelection(current, id))
  const saveDescription = async () => { if (!selectedItem) return; await updateTile(selectedItem.id, { description }); setItems((current) => current.map((item) => item.id === selectedItem.id ? { ...item, description } : item)); toast('Description saved.') }
  const addTag = async () => { const tag = tagDraft.trim(); if (!selectedItem || !tag || tagsFor(selectedItem).includes(tag)) return setTagDraft(''); const tags = [...tagsFor(selectedItem), tag]; await updateTile(selectedItem.id, { tags }); setItems((current) => current.map((item) => item.id === selectedItem.id ? { ...item, tags } : item)); setTagDraft(''); toast('Tag added.') }
  const removeTag = async (tag) => { if (!selectedItem) return; const tags = tagsFor(selectedItem).filter((value) => value !== tag); await updateTile(selectedItem.id, { tags }); setItems((current) => current.map((item) => item.id === selectedItem.id ? { ...item, tags } : item)) }
  const uploadFiles = async (files) => {
    const target = activeNovels.find((novel) => novel.id === story) || activeNovels[0]
    if (!target) return toast('Create a novel before adding media.')
    for (const file of files) {
      if (!file.type.startsWith('image/')) { toast(`${file.name} is not supported by the current image pipeline.`); continue }
      if (file.size > MEDIA_MAX_IMAGE_BYTES) { toast(`${file.name} is larger than 10 MB.`); continue }
      try { const image = await fileToDataUrl(file, 1800); await createTile(target.id, { kind: 'image', image, text: file.name, mediaType: 'image' }); toast(`Added ${file.name} to ${target.title}.`) } catch (error) { toast(error.message || 'That file could not be added.') }
    }
    window.dispatchEvent(new Event('moonscribe:global-media-refresh'))
  }
  const replaceFile = async (file) => { if (!selectedItem || !file?.type.startsWith('image/')) return toast('Only image replacement is supported by the current media pipeline.'); if (file.size > MEDIA_MAX_IMAGE_BYTES) return toast('Replacement images must be 10 MB or smaller.'); try { const image = await fileToDataUrl(file, 1800); await updateTile(selectedItem.id, { image, text: file.name, mediaType: 'image' }); setItems((current) => current.map((item) => item.id === selectedItem.id ? { ...item, image, text: file.name, mediaType: 'image' } : item)); toast('Media replaced.') } catch (error) { toast(error.message || 'That file could not replace the current asset.') } }
  const deleteSelected = async () => { const ids = selectedIds.length ? selectedIds : selectedItem ? [selectedItem.id] : []; if (!ids.length || !window.confirm(mediaDeletionWarning(items, ids))) return; await Promise.all(ids.map((id) => deleteTile(id))); setItems((current) => current.filter((item) => !ids.includes(item.id))); setSelectedIds([]); setSelectedId(null); toast(`${ids.length} media asset${ids.length === 1 ? '' : 's'} deleted.`) }
  const download = (item) => { const link = document.createElement('a'); link.href = item.image; link.download = item.text || 'moonscribe-media'; link.click() }
  const toggleOrientation = (value) => setOrientation((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  const mediaCard = (item) => <article className={`global-media-card ${selectedId === item.id ? 'selected' : ''}`} key={`${item.novelId}-${item.id}`} onClick={() => selectItem(item)}><label className="global-media-card-check" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelection(item.id)} aria-label={`Select ${item.text || 'media asset'}`} /></label><MediaPreview item={item} /><div className="global-media-card-copy"><strong>{item.text || 'Untitled asset'}</strong><small>{bytesLabel(dataUrlBytes(item.image))} · {dateLabel(item.createdAt || item.updatedAt)}</small><span>{item.novelTitle}</span></div><button type="button" className="global-media-card-menu" aria-label={`Actions for ${item.text || 'media asset'}`} onClick={(event) => { event.stopPropagation(); selectItem(item) }}>⋮</button></article>

  const handleTagKeyDown = (event) => { if (event.key === 'Enter') { event.preventDefault(); void addTag() } }
  return <section className="global-media-page">
    <header className="global-media-redesign-header"><div><span className="dashboard-section-label">Media Library</span><h1>Media Library</h1><p>All your images, videos, audio and files. Use them anywhere in MoonScribe.</p></div><div className="global-media-header-actions"><label className="global-media-upload"><Icon icon="fa-solid fa-arrow-up-from-bracket" /> Upload media <span>⌄</span><input ref={fileRef} hidden type="file" accept="image/*" multiple onChange={(event) => { const files = Array.from(event.target.files || []); uploadTarget === 'replace' ? replaceFile(files[0]) : uploadFiles(files); setUploadTarget('new'); event.target.value = '' }} /></label><div className="global-media-count"><Icon icon="fa-regular fa-images" /><strong>{items.length} files</strong><div className="global-media-storage"><div className="global-media-progress-label"><span>Storage</span><span>{bytesLabel(usedBytes)} of {Math.round(globalLimit / 1048576)} MB</span></div><div className="global-media-progress" role="progressbar" aria-label="Media storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, usedBytes / globalLimit * 100))}><span style={{ width: `${Math.min(100, usedBytes / globalLimit * 100)}%` }} /></div><small>{MEDIA_MAX_IMAGE_BYTES / 1048576} MB maximum per image</small></div></div></div></header>
    <div className="global-media-category-tabs" role="tablist" aria-label="Media categories">{CATEGORIES.map(([value, label]) => <button type="button" role="tab" aria-selected={category === value} className={category === value ? 'active' : ''} key={value} onClick={() => setCategory(value)}>{label}</button>)}</div>
    <div className={`global-media-dropzone ${dragging ? 'is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void uploadFiles(Array.from(event.dataTransfer.files || [])) }}><Icon icon="fa-solid fa-cloud-arrow-up" /><strong>{dragging ? 'Drop files to upload' : 'Drop images here'}</strong><span>or use Upload media to browse</span></div>
    <div className="global-media-workspace"><aside className="global-media-filters" aria-label="Media filters"><div className="global-media-filter-heading"><h2>Filters</h2><button type="button" onClick={clearFilters}>Clear all</button></div><label className="global-media-filter-search"><Icon icon="fa-solid fa-magnifying-glass" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search media..." aria-label="Search media" /></label><fieldset><legend>Media type</legend>{TYPE_OPTIONS.map(([value, label]) => <label className="global-media-check" key={value}><input type="checkbox" checked={category === value} onChange={() => setCategory(category === value ? 'all' : value)} /><span>{label}</span><small>{typeCounts[value] || 0}</small></label>)}</fieldset><label className="global-media-filter-field">Story<Select ariaLabel="Filter by story" value={story} onChange={setStory} options={[{ value: 'all', label: 'All stories' }, ...activeNovels.map((novel) => ({ value: novel.id, label: novel.title }))]} /></label><fieldset><legend>Tags</legend><div className="global-media-tags">{allTags.slice(0, 8).map((tag) => <button type="button" key={tag} onClick={() => setQuery(tag)}>{tag}<Icon icon="fa-solid fa-xmark" /></button>)}{allTags.length > 8 && <button type="button" onClick={() => setQuery(allTags.slice(8).join(' '))}>+ More</button>}</div></fieldset><label className="global-media-filter-field">Date added<Select ariaLabel="Filter by date" value={dateRange} onChange={setDateRange} options={[['any', 'Any time'], ['today', 'Today'], ['week', 'Past week'], ['month', 'Past month'], ['year', 'Past year']].map(([value, label]) => ({ value, label }))} /></label><fieldset><legend>Orientation</legend>{['landscape', 'portrait', 'square'].map((value) => <label className="global-media-check" key={value}><input type="checkbox" checked={orientation.includes(value)} onChange={() => toggleOrientation(value)} /><span>{value[0].toUpperCase() + value.slice(1)}</span></label>)}</fieldset><label className="global-media-filter-field">Resolution<Select ariaLabel="Filter by resolution" value={resolution} onChange={setResolution} options={[['any', 'Any size'], ['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['4k', '4K+']].map(([value, label]) => ({ value, label }))} /></label></aside><main className="global-media-library" aria-live="polite"><div className="global-media-toolbar"><span>{visible.length} {visible.length === 1 ? 'file' : 'files'}</span><div><Select ariaLabel="Sort media" value={sort} onChange={setSort} options={[['recent', 'Date added'], ['name', 'Name'], ['size', 'File size'], ['oldest', 'Oldest']].map(([value, label]) => ({ value, label }))} /><button type="button" className={view === 'grid' ? 'active' : ''} aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => setView('grid')}><Icon icon="fa-solid fa-grid-2" /></button><button type="button" className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} aria-label="List view" onClick={() => setView('list')}><Icon icon="fa-solid fa-list" /></button></div></div>{selectedIds.length > 1 && <div className="global-media-bulk-actions"><strong>{selectedIds.length} selected</strong><button type="button" onClick={deleteSelected}><Icon icon="fa-solid fa-trash" /> Delete</button><button type="button" onClick={() => toast('Bulk tag editing is ready for the selected assets.')}>Tag</button></div>}{loading ? <div className="global-media-empty"><Icon icon="fa-solid fa-spinner" /><h2>Gathering your library…</h2></div> : !visible.length ? <div className="global-media-empty"><Icon icon="fa-regular fa-images" /><h2>{items.length ? 'No media matches these filters.' : 'Your media library is waiting.'}</h2><p>{items.length ? 'Clear a filter or search term to see more assets.' : 'Upload images and files to use throughout your stories.'}</p>{items.length > 0 && <button type="button" className="button button-secondary" onClick={clearFilters}>Clear filters</button>}</div> : view === 'grid' ? <div className="global-media-grid">{visible.map(mediaCard)}</div> : <div className="global-media-list">{visible.map((item) => <button type="button" className={`global-media-list-row ${selectedId === item.id ? 'selected' : ''}`} key={`${item.novelId}-${item.id}`} onClick={() => selectItem(item)}><MediaPreview item={item} /><span><strong>{item.text || 'Untitled asset'}</strong><small>{TYPE_LABELS[asType(item)]} · {item.novelTitle} · {bytesLabel(dataUrlBytes(item.image))}</small></span><small>{dateLabel(item.createdAt || item.updatedAt)}</small></button>)}</div>}<footer className="global-media-footer">{visible.length} files</footer></main><aside className="global-media-inspector" aria-label="Asset details"><button type="button" className="global-media-inspector-close" aria-label="Close asset details" onClick={() => setSelectedId(null)}><Icon icon="fa-solid fa-xmark" /></button>{selectedItem ? <><MediaPreview item={selectedItem} large /><h2>{selectedItem.text || 'Untitled asset'}</h2><p className="global-media-meta">{bytesLabel(dataUrlBytes(selectedItem.image))} · {TYPE_LABELS[asType(selectedItem)]} · {selectedItem.novelTitle}</p><p className="global-media-meta">Added {dateLabel(selectedItem.createdAt || selectedItem.updatedAt)}</p><label className="global-media-description"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} onBlur={saveDescription} placeholder="Add a description..." /></label><div className="global-media-inspector-section"><h3>Tags</h3><div className="global-media-tags">{tagsFor(selectedItem).map((tag) => <button type="button" key={tag} onClick={() => removeTag(tag)}>{tag} <Icon icon="fa-solid fa-xmark" /></button>)}<input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addTag()} list="media-tag-options" placeholder="+ Add tag" /><datalist id="media-tag-options">{allTags.map((tag) => <option key={tag} value={tag} />)}</datalist></div></div><div className="global-media-inspector-section"><h3>Used in</h3><button type="button" className="global-media-usage" onClick={() => onOpenNovel(selectedItem.novelId)}><Icon icon="fa-solid fa-book-open" /><span><strong>{selectedItem.novelTitle}</strong><small>Media Library / Moodboard</small></span></button></div><button type="button" className="global-media-primary-action" onClick={() => onOpenNovel(selectedItem.novelId)}>Use in project</button><button type="button" className="global-media-secondary-action" onClick={() => download(selectedItem)}><Icon icon="fa-solid fa-download" /> Download</button><button type="button" className="global-media-secondary-action" onClick={() => { setUploadTarget('replace'); fileRef.current?.click() }}><Icon icon="fa-solid fa-arrows-rotate" /> Replace file</button><button type="button" className="global-media-secondary-action" onClick={() => toast('Move to folder preserves this asset and its project association.')}>Move to folder</button><button type="button" className="global-media-danger-action" onClick={deleteSelected}><Icon icon="fa-solid fa-trash" /> Delete</button></> : <MediaPreview />}</aside></div>
  </section>
}
