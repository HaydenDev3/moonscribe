import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon'
import { formatWords } from '../utils/words'
import { createBranch, deleteBranch, listBranches, restoreBranch } from '../db/branches'

export default function ArchiveHub({ novelId, chapters, onOpenHistory, onBranchRestored }) {
  const [branches, setBranches] = useState([])
  const [busy, setBusy] = useState(false)
  const versions = useMemo(() => chapters.flatMap((chapter) => (chapter.versions || []).map((version) => ({ ...version, chapterId: chapter.id, chapterTitle: chapter.title }))).sort((a, b) => b.at - a.at), [chapters])
  const load = async () => setBranches(await listBranches(novelId))
  useEffect(() => { load() }, [novelId])

  const branch = async () => {
    const name = window.prompt('Name this manuscript branch (for example “Beta rewrite” or “Alternate ending”)')
    if (!name?.trim()) return
    setBusy(true)
    await createBranch(novelId, name.trim())
    await load()
    setBusy(false)
  }

  const restore = async (item) => {
    if (!window.confirm(`Switch the current manuscript to “${item.name}”? MoonScribe will save the current manuscript as a safety branch first.`)) return
    setBusy(true)
    await createBranch(novelId, `Before switching to ${item.name}`, { description: 'Automatic safety branch' })
    await restoreBranch(item.id)
    await load()
    await onBranchRestored?.()
    setBusy(false)
  }

  return <section className="studio-collection archive-hub"><header><div><span>Archive</span><h2>Drafts &amp; branches</h2><p>Preserve complete manuscript directions, compare chapter history, and return without losing the path you left.</p></div><button className="button button-primary" disabled={busy} onClick={branch}><Icon icon="fa-solid fa-code-branch"/> New branch</button></header><div className="archive-branch-grid">{branches.map((item) => <article key={item.id} className="archive-branch-card"><span className="archive-branch-icon"><Icon icon="fa-solid fa-code-branch"/></span><div><strong>{item.name}</strong><p>{item.description || `${item.chapters?.length || 0} chapter snapshots`}</p><small>{new Date(item.createdAt).toLocaleString()} · {formatWords((item.chapters || []).reduce((sum, chapter) => sum + (chapter.wordCount || 0), 0))} words</small></div><div className="archive-branch-actions"><button className="button button-ghost" disabled={busy} onClick={() => restore(item)}>Switch to branch</button><button className="button button-quiet" aria-label={`Delete ${item.name}`} onClick={async () => { if (window.confirm(`Delete the branch “${item.name}”?`)) { await deleteBranch(item.id); load() } }}><Icon icon="fa-solid fa-trash"/></button></div></article>)}{!branches.length && <div className="palette-hint">Create a branch before a rewrite, alternate ending, structural edit or beta-reader pass.</div>}</div><div className="settings-subheading">Chapter history</div><div className="archive-version-list">{versions.map((version, index) => <button key={`${version.chapterId}-${version.at}-${index}`} onClick={() => onOpenHistory(version.chapterId)}><Icon icon={version.label ? 'fa-solid fa-bookmark' : 'fa-regular fa-clock'}/><span><strong>{version.label || version.chapterTitle || 'Untitled chapter'}</strong><small>{version.chapterTitle} · {formatWords(version.words || 0)} words</small></span><time>{new Date(version.at).toLocaleDateString()}</time></button>)}{!versions.length && <div className="palette-hint">Saved chapter versions will collect here as the manuscript develops.</div>}</div></section>
}
