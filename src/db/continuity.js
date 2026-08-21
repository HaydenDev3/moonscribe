// Continuity checker: reads the manuscript and the binder, then flags likely
// trouble spots — POVs who never appear, scenes set somewhere unknown,
// characters who vanished mid-story, and names that never got a profile.
import { getDB } from './db'

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
  return [character?.name, ...(Array.isArray(character?.aliases) ? character.aliases : [])].filter(Boolean).some((name) => mentions(name, text))
}

// Build a report for one novel. Returns { issues, counts } where each issue is
// { severity, kind, title, detail, chapterId? }.
export async function continuityReport(novelId) {
  const db = await getDB()
  const chapters = (await db.getAllFromIndex('chapters', 'by-novel', novelId))
    .filter((c) => !c.trashedAt)
    .sort((a, b) => a.order - b.order)
  const characters = (await db.getAllFromIndex('characters', 'by-novel', novelId)).filter((c) => !c.trashedAt)
  const world = (await db.getAllFromIndex('world', 'by-novel', novelId)).filter((w) => !w.trashedAt)

  const issues = []
  const withWords = chapters.filter((c) => strip(c.content))
  const texts = chapters.map((c) => ({ c, text: strip(c.content) }))

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
    const povProfile = pov && characters.find((character) => [character.name, ...(character.aliases || [])].some((name) => String(name).toLowerCase() === String(pov).toLowerCase()))
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
