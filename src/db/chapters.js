import { getDB, uid, putRecord, removeRecord } from './db'
import { countWords } from '../utils/words'
import { composeMergedContent, tidyHtml } from '../utils/formatHtml'
import { KINDS, flatOrder } from '../utils/numbering'

export async function listChapters(novelId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('chapters', 'by-novel', novelId)
  return all.sort((a, b) => a.order - b.order)
}

export async function getChapter(id) {
  const db = await getDB()
  return db.get('chapters', id)
}

export async function createChapter(novelId, { title = '', part = '', content = '', kind = 'chapter', parentId = null } = {}) {
  const all = await listChapters(novelId)
  const order = all.length ? Math.max(...all.map((c) => c.order)) + 1 : 1
  const now = Date.now()
  const chapter = {
    id: uid(),
    novelId,
    title: title || '',
    part: part || (all.length ? all[all.length - 1].part : ''),
    kind: KINDS.includes(kind) ? kind : 'chapter',
    parentId: parentId || null,
    content,
    order,
    status: 'draft',
    wordCount: countWords(content),
    createdAt: now,
    updatedAt: now,
    versions: []
  }
  return putRecord('chapters', chapter)
}

export async function updateChapter(id, patch) {
  const db = await getDB()
  const chapter = await db.get('chapters', id)
  if (!chapter) return null
  const next = { ...chapter, ...patch, id: chapter.id }
  return putRecord('chapters', next)
}

export async function deleteChapter(id) {
  const db = await getDB()
  const ch = await db.get('chapters', id)
  await db.delete('chapters', id)
  await removeRecord('chapters', id, ch?.novelId)
}

// Recompute each chapter's order from the outline (parent/child) display
// sequence, so sibling moves never corrupt the global sort.
async function persistOutline(novelId, all) {
  const flat = flatOrder(all)
  const byId = new Map(all.map((c) => [c.id, c]))
  const changed = []
  flat.forEach((cid, idx) => {
    const c = byId.get(cid)
    if (c.order !== idx + 1) {
      c.order = idx + 1
      changed.push(c)
    }
  })
  await Promise.all(changed.map((c) => putRecord('chapters', c)))
}

function isAncestor(node, maybeDescendant, all) {
  const byId = new Map(all.map((c) => [c.id, c]))
  let cur = byId.get(maybeDescendant)
  while (cur) {
    if (cur.id === node.id) return true
    cur = cur.parentId ? byId.get(cur.parentId) : null
  }
  return false
}

// Move a chapter up/down within its siblings.
export async function moveChapter(novelId, id, dir) {
  const all = await listChapters(novelId)
  const target = all.find((c) => c.id === id)
  if (!target) return all
  const siblings = all
    .filter((c) => (c.parentId || null) === (target.parentId || null))
    .sort((a, b) => a.order - b.order)
  const si = siblings.findIndex((c) => c.id === id)
  const sj = si + dir
  if (sj < 0 || sj >= siblings.length) return all
  const swap = siblings[sj]
  ;[target.order, swap.order] = [swap.order, target.order]
  await Promise.all([putRecord('chapters', target), putRecord('chapters', swap)])
  await persistOutline(novelId, all)
  return listChapters(novelId)
}

// Drag-and-drop reordering: move `id` under `parentId` at `index` (defaults to
// the end). Refuses to move a node inside its own subtree.
export async function reorderChapter(novelId, id, { parentId = null, index = null } = {}) {
  const all = await listChapters(novelId)
  const target = all.find((c) => c.id === id)
  if (!target) return listChapters(novelId)
  const newParent = parentId ? all.find((c) => c.id === parentId) : null
  if (parentId && !newParent) return listChapters(novelId)
  if (isAncestor(target, parentId, all)) return listChapters(novelId)

  target.parentId = parentId || null
  const siblings = all
    .filter((c) => (c.parentId || null) === target.parentId)
    .sort((a, b) => a.order - b.order)
  const without = siblings.filter((c) => c.id !== id)
  const idx = index == null ? without.length : Math.min(Math.max(index, 0), without.length)
  without.splice(idx, 0, target)
  without.forEach((c, i) => {
    c.order = (i + 1) * 100
  })
  await Promise.all(without.map((c) => putRecord('chapters', c)))
  await persistOutline(novelId, all)
  return listChapters(novelId)
}

export async function partsOf(novelId) {
  const all = await listChapters(novelId)
  const seen = []
  for (const c of all) {
    if (c.part && !seen.includes(c.part)) seen.push(c.part)
  }
  return seen
}

export async function wordsAndChapters(novelId) {
  const all = await listChapters(novelId)
  return {
    words: all.reduce((s, c) => s + (c.wordCount || 0), 0),
    chapters: all.length
  }
}

// Merge two chapters: `absorb` flows into `keep` at a clean seam and is then
// deleted. `separator` is 'scene-break' (❦) or 'space' (one blank line).
export async function mergeChapters(novelId, keepId, absorbId, { separator = 'scene-break' } = {}) {
  const all = await listChapters(novelId)
  const keep = all.find((c) => c.id === keepId)
  const absorb = all.find((c) => c.id === absorbId)
  if (!keep || !absorb || keep.id === absorb.id) return null

  const { html, words, stats } = composeMergedContent(keep.content || '', absorb.content || '', separator)
  const now = Date.now()
  const versions = [...(keep.versions || []).slice(-19), { at: now, words, html }]
  await updateChapter(keepId, { content: html, wordCount: words, updatedAt: now, versions })
  await deleteChapter(absorbId)

  return { keep: await getChapter(keepId), absorb, after: await listChapters(novelId), stats }
}

// Auto-format a chapter's content. Returns null if the chapter vanished.
export async function tidyChapter(id, { detectHeadings = true } = {}) {
  const ch = await getChapter(id)
  if (!ch) return null
  const { html, stats } = tidyHtml(ch.content || '', { detectHeadings })
  if (html === (ch.content || '')) return { changed: false, stats, chapter: ch }
  const now = Date.now()
  await updateChapter(id, {
    content: html,
    wordCount: countWords(html),
    updatedAt: now,
    versions: [...(ch.versions || []).slice(-19), { at: now, words: countWords(html), html }]
  })
  return { changed: true, stats, chapter: await getChapter(id) }
}
