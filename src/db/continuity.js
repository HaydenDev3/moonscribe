// Continuity checker: reads the manuscript and the binder, then flags likely
// trouble spots — POVs who never appear, scenes set somewhere unknown,
// characters who vanished mid-story, and names that never got a profile.
import { getDB } from './db'
import { DEFAULT_CONTINUITY_SETTINGS, getWorkspacePreferences } from './workspacePreferences'
import { getMeta } from './meta'
import { listFactProvenance, saveContinuityConflict, saveFactProvenance } from './collaboration'

const SEVERITY = { hint: 0, watch: 1, flag: 2 }

function strip(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

function mentions(name, text) {
  if (!name || !text) return false
  const escaped = String(name).trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!escaped) return false
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?:['’]s|s)?(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(text)
}

function characterAppears(character, text) {
  const fullName = String(character?.name || '').trim()
  const firstName = fullName.split(/\s+/)[0]
  return [fullName, firstName, ...(Array.isArray(character?.aliases) ? character.aliases : [])].filter(Boolean).some((name) => mentions(name, text))
}

const FACT_PATTERNS = {
  age: (name) => new RegExp(`\\b${name}\\b[^.!?]{0,100}?\\b(?:is|was|turned|turns)\\s+(\\d{1,3})\\s+years?\\s+old\\b`, 'i'),
  eyeColor: (name) => new RegExp(`\\b${name}\\b[^.!?]{0,100}?\\b((?:bright|pale|dark|deep|light)?\\s*(?:blue|green|brown|grey|gray|hazel|amber|black))\\s+eyes?\\b`, 'i'),
  relationshipStatus: (name) => new RegExp(`\\b${name}\\b[^.!?]{0,100}?\\b(married|single|dating|engaged|divorced|widowed)\\b`, 'i'),
  aliases: (name) => new RegExp(`\\b${name}\\b[^.!?]{0,100}?\\b(?:known|referred)\\s+as\\s+["“']([^"”']+)["”']`, 'i')
}

function factValues(character, texts, factType) {
  const name = String(character?.name || '').trim().replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')
  const pattern = FACT_PATTERNS[factType]?.(name)
  if (!pattern) return []
  const values = []
  texts.forEach(({ c, text }) => {
    const match = text.match(pattern)
    if (match?.[1]) values.push({ value: match[1].trim().toLowerCase(), chapterId: c.id, chapterTitle: c.title || 'Untitled' })
  })
  return values
}

// Save/sync-boundary continuity pass. It records who introduced a fact before
// comparing it, so collaborators can review a durable diff even if the owner
// was offline when the edit arrived.
export async function syncChapterContinuity(novelId, chapterId, { content = '', revision = null, userId = null } = {}) {
  const db = await getDB()
  const chapter = await db.get('chapters', chapterId)
  if (!chapter || chapter.novelId !== novelId) return { facts: [], conflicts: [] }
  const preferences = await getWorkspacePreferences(novelId)
  const settings = { ...DEFAULT_CONTINUITY_SETTINGS, ...(preferences.continuity || {}) }
  const characters = (await db.getAllFromIndex('characters', 'by-novel', novelId)).filter((c) => !c.trashedAt)
  const actor = userId || await getMeta('syncAccountId', null)
  const facts = []
  for (const character of characters) {
    for (const factType of settings.factTypes || []) {
      const values = factValues(character, [{ c: chapter, text: strip(content || chapter.content) }], factType)
      for (const item of values) {
        const fact = await saveFactProvenance(novelId, {
          factKey: character.id || character.name,
          factType,
          normalizedValue: item.value,
          sourceChapterId: chapterId,
          introducingUserId: actor,
          sourceRevision: revision,
        })
        facts.push(fact)
      }
    }
  }
  const conflicts = []
  for (const fact of facts) {
    const prior = (await listFactProvenance(novelId, fact.factKey)).filter((item) => item.factType === fact.factType && item.normalizedValue !== fact.normalizedValue && item.id !== fact.id)
    for (const established of prior) {
      const conflict = await saveContinuityConflict(novelId, {
        identity: [novelId, fact.factKey, fact.factType, established.normalizedValue, fact.normalizedValue, established.sourceChapterId, fact.sourceChapterId].join(':'),
        factKey: fact.factKey,
        factType: fact.factType,
        establishedValue: established.normalizedValue,
        introducedValue: fact.normalizedValue,
        establishedChapterId: established.sourceChapterId,
        introducedChapterId: fact.sourceChapterId,
        introducedByUserId: fact.introducingUserId,
        ownerRecipientId: (await db.get('novels', novelId))?.ownerId || null,
        factOwnerId: established.introducingUserId || null,
        severity: settings.severity,
      })
      conflicts.push(conflict)
    }
  }
  return { facts, conflicts }
}

// Build a report for one novel. Returns { issues, counts } where each issue is
// { severity, kind, title, detail, chapterId? }.
export async function continuityReport(novelId) {
  const db = await getDB()
  const preferences = await getWorkspacePreferences(novelId)
  const continuity = { ...DEFAULT_CONTINUITY_SETTINGS, ...(preferences.continuity || {}) }
  const novel = await db.get('novels', novelId)
  const chapters = (await db.getAllFromIndex('chapters', 'by-novel', novelId))
    .filter((c) => !c.trashedAt)
    .sort((a, b) => a.order - b.order)
  const characters = (await db.getAllFromIndex('characters', 'by-novel', novelId)).filter((c) => !c.trashedAt)
  const world = (await db.getAllFromIndex('world', 'by-novel', novelId)).filter((w) => !w.trashedAt)

  const issues = []
  const withWords = chapters.filter((c) => strip(c.content))
  const texts = chapters.map((c) => ({ c, text: strip(c.content) }))

  // Compare explicit facts expressed in the manuscript. This deliberately
  // avoids guessing from prose: only clear statements are reported.
  const factLabels = { age: 'age', eyeColor: 'eye colour', relationshipStatus: 'relationship status', aliases: 'alias' }
  for (const character of characters) {
    for (const factType of continuity.factTypes || []) {
      const values = factValues(character, texts, factType)
      const distinct = [...new Set(values.map((item) => item.value))]
      if (distinct.length < 2) continue
      const first = values.find((item) => item.value === distinct[0])
      const latest = values.find((item) => item.value === distinct[distinct.length - 1])
      issues.push({
        severity: continuity.severity === 'block' ? SEVERITY.flag : SEVERITY.watch,
        kind: 'fact-conflict',
        title: `“${character.name}” has conflicting ${factLabels[factType] || factType}`,
        detail: `${first.value} appears in “${first.chapterTitle}”, while ${latest.value} appears in “${latest.chapterTitle}”. Review the wording or update the character profile.`,
        chapterId: latest.chapterId
      })
    }
  }

  // Design metadata is part of the finished book too. Keep these checks in
  // continuity so a manuscript can be reviewed before it reaches print.
  const layout = novel?.layout || {}
  if (!layout.editorDesign) issues.push({ severity: SEVERITY.hint, kind: 'design', title: 'No page design is selected', detail: 'Choose a page design from the Designs palette so the manuscript has a deliberate reading style.' })
  if (!layout.pageSize) issues.push({ severity: SEVERITY.hint, kind: 'design', title: 'Page size is using the default', detail: 'Confirm the intended trim size in Designer before export.' })
  if (!layout.coverDesign) issues.push({ severity: SEVERITY.watch, kind: 'design', title: 'Cover design is not assigned', detail: 'Choose a cover design in Designer so cover and interior production settings stay connected.' })

  // Missing scene context is still a continuity concern. Previously a sparse
  // binder produced an empty report, which made the checker look broken.
  for (const { c, text } of texts) {
    if (!text) continue
    const missing = [!c.meta?.pov && 'POV', !c.meta?.location && 'place', !c.meta?.timeOfDay && 'time', !c.meta?.beat && 'story beat'].filter(Boolean)
    if (missing.length) issues.push({
      severity: SEVERITY.hint,
      kind: 'scene-context',
      title: `“${c.title || 'Untitled'}” is missing ${missing.join(', ')}`,
      detail: 'Complete the scene context so timeline and continuity checks can compare this chapter properly.',
      chapterId: c.id
    })
  }

  // POV set in scene metadata but the character never appears in the scene.
  for (const { c, text } of texts) {
    const pov = c.meta?.pov
    const povProfile = pov && characters.find((character) => {
      const full = String(character.name || '').trim()
      const first = full.split(/\s+/)[0]
      return [full, first, ...(character.aliases || [])].some((name) => String(name).toLowerCase() === String(pov).toLowerCase())
    })
    if (pov && text && !(povProfile ? characterAppears(povProfile, text) : mentions(pov, text))) {
      issues.push({
        severity: SEVERITY.flag,
        kind: 'pov',
        title: `“${pov}” is the POV of “${c.title || 'Untitled'}” but never appears`,
        detail: 'A scene written from someone who is not in it — check the POV metadata or the text.',
        chapterId: c.id
      })
    }
    if (pov && characters.length && !povProfile) {
      issues.push({ severity: SEVERITY.watch, kind: 'unknown-pov', title: `POV “${pov}” has no character profile`, detail: 'Create the character or correct the POV spelling so MoonScribe can track them.', chapterId: c.id })
    }
  }

  // Scene location not in the worldbuilding binder (either add it there or fix the name).
  const placeNames = world.filter((w) => w.kind === 'place').map((w) => w.name?.toLowerCase())
  for (const { c } of texts) {
    const loc = c.meta?.location
    if (loc && !placeNames.some((p) => loc.toLowerCase().includes(p) || p.includes(loc.toLowerCase()))) {
      issues.push({
        severity: SEVERITY.watch,
        kind: 'location',
        title: `“${loc}” isn’t in your worldbuilding`,
        detail: placeNames.length ? `Known places: ${world.filter((w) => w.kind === 'place').slice(0, 5).map((w) => w.name).join(', ')}${placeNames.length > 5 ? '…' : ''}. Add it, or match the spelling.` : 'No places exist yet — add this one to Worldbuilding.',
        chapterId: c.id
      })
    }
  }

  // Characters who have a profile but never appear anywhere.
  for (const ch of characters) {
    if (withWords.length && !texts.some(({ text }) => characterAppears(ch, text))) {
      issues.push({
        severity: SEVERITY.watch,
        kind: 'unseen',
        title: `“${ch.name}” never appears in the manuscript`,
        detail: ch.role ? `Their role is “${ch.role}”. Introduce them, or note why they are absent.` : 'Give them a scene — or make them a background figure on purpose.'
      })
    }
  }

  // Characters who vanished: last seen more than 4 chapters ago.
  if (texts.length > 6) {
    for (const ch of characters) {
      let last = -1
      texts.forEach(({ text }, i) => {
        if (characterAppears(ch, text)) last = i
      })
      if (last !== -1 && last <= texts.length - 5) {
        const gap = texts.length - 1 - last
        issues.push({
          severity: SEVERITY.watch,
          kind: 'dormant',
          title: `“${ch.name}” hasn’t appeared in ${gap} chapter${gap === 1 ? '' : 's'}`,
          detail: 'If they matter, bring them back; if not, that is fine too.',
          chapterId: texts[last + 1]?.c.id
        })
      }
    }
  }

  return { issues, counts: { chapters: chapters.length, characters: characters.length, places: placeNames.length } }
}

export function severityLabel(severity) {
  return severity === SEVERITY.flag ? 'flag' : severity === SEVERITY.watch ? 'watch' : 'hint'
}
