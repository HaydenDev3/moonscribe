import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { formatWords } from '../utils/words'
import { timeAgo } from '../utils/dates'
import { useContextMenu } from '../components/ContextMenu'
import { useApp } from '../context/AppContext'
import { updateNovel } from '../db/novels'

function useCover(cover: unknown) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (typeof cover === 'string' && /^(data:|blob:|https?:)/i.test(cover)) { setUrl(cover); return }
    if (typeof Blob !== 'undefined' && cover instanceof Blob) { const next = URL.createObjectURL(cover); setUrl(next); return () => URL.revokeObjectURL(next) }
    setUrl(null)
  }, [cover])
  return url
}

export default function ContinueWriting({ novel, chapter, todayWords, onContinue, onOpenChapter, onFocus }: any) {
  const { openContextMenu } = useContextMenu()
  const { refreshNovels, toast } = useApp()
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(novel?.title || '')
  const cover = useCover(novel?.cover)
  const goal = Number(novel?.goalWords) || 0
  useEffect(() => { setTitle(novel?.title || '') }, [novel?.id, novel?.title])

  const saveTitle = async () => {
    const next = title.trim()
    if (!novel?.id) return
    if (!next) { setTitle(novel.title || ''); setEditingTitle(false); return }
    if (next !== novel.title) {
      await updateNovel(novel.id, { title: next })
      await refreshNovels()
      toast('Novel title updated.')
    }
    setEditingTitle(false)
  }

  return <section className="moon-continue-card" onContextMenu={(event) => openContextMenu(event, [{ label: 'Continue writing', icon: 'fa-solid fa-pen-nib', onClick: onContinue }, { label: 'Open chapter', icon: 'fa-solid fa-book-open', onClick: onOpenChapter }, { label: 'Focus mode', icon: 'fa-solid fa-expand', onClick: onFocus }])}>
    <div className="moon-cover">{cover ? <img src={cover} alt={`Cover of ${novel?.title || 'current story'}`} /> : <><span aria-hidden="true">☾</span><small>{(novel?.title || 'MoonScribe').slice(0, 1)}</small></>}</div>
    <div className="moon-continue-copy"><p className="moon-kicker">Continue writing</p>{editingTitle ? <input className="moon-continue-title-input" value={title} autoFocus aria-label="Novel title" onChange={(event) => setTitle(event.target.value)} onBlur={() => void saveTitle()} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } if (event.key === 'Escape') { setTitle(novel?.title || ''); setEditingTitle(false) } }} onClick={(event) => event.stopPropagation()} /> : <h2 className="moon-continue-title" onClick={(event) => { event.stopPropagation(); setEditingTitle(true) }} title="Edit novel title">{novel?.title || 'Untitled story'}</h2>}<h3>{chapter?.title || 'Begin the next chapter'}</h3><p>{chapter?.updatedAt ? `Last edited ${timeAgo(chapter.updatedAt)}` : 'Your story is waiting for its next line.'}</p>{goal > 0 && <div className="moon-continue-progress"><span>{formatWords(todayWords)} / {formatWords(goal)} words today</span><div className="moon-progress"><i style={{ width: `${Math.min(100, todayWords / goal * 100)}%` }} /></div></div>}<div className="moon-continue-actions"><button className="moon-primary-button" type="button" onClick={onContinue}>Continue writing <Icon icon="fa-solid fa-arrow-right" /></button><button type="button" onClick={onOpenChapter}>Open chapter</button><button type="button" onClick={onFocus}><Icon icon="fa-solid fa-expand" /> Focus mode</button></div></div>
    <span className="moon-orbit" aria-hidden="true" />
  </section>
}
