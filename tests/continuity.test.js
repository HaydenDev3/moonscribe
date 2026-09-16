import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { getDB } from '../src/db/db'
import { createNovel } from '../src/db/novels'
import { createChapter, updateChapter } from '../src/db/chapters'
import { createCharacter } from '../src/db/characters'
import { continuityReport } from '../src/db/continuity'
import { updateWorkspacePreferences } from '../src/db/workspacePreferences'

beforeEach(async () => {
  const db = await getDB()
  await Promise.all(['novels', 'chapters', 'characters', 'world'].map((store) => db.clear(store)))
})

describe('continuity engine', () => {
  it('reports sparse scene context instead of returning an empty result', async () => {
    const novel = await createNovel({ title: 'Signals' })
    await createChapter(novel.id, { title: 'One', content: '<p>Mira opened the lighthouse door.</p>' })
    const report = await continuityReport(novel.id)
    expect(report.issues.some((issue) => issue.kind === 'scene-context')).toBe(true)
  })

  it('flags unknown places even when the world binder has no places', async () => {
    const novel = await createNovel({ title: 'Signals' })
    const chapter = await createChapter(novel.id, { title: 'One', content: '<p>Mira waited.</p>' })
    await updateChapter(chapter.id, { meta: { pov: 'Mira', location: 'Glass Harbour', timeOfDay: 'Night', beat: 'Arrival' } })
    await createCharacter(novel.id, { name: 'Mira' })
    const report = await continuityReport(novel.id)
    expect(report.issues.some((issue) => issue.kind === 'location')).toBe(true)
  })

  it('matches character aliases as whole names', async () => {
    const novel = await createNovel({ title: 'Signals' })
    const chapter = await createChapter(novel.id, { title: 'One', content: '<p>The Keeper crossed the room.</p>' })
    await updateChapter(chapter.id, { meta: { pov: 'Mira', location: '', timeOfDay: 'Night', beat: 'Arrival' } })
    await createCharacter(novel.id, { name: 'Mira', aliases: ['The Keeper'] })
    const report = await continuityReport(novel.id)
    expect(report.issues.some((issue) => issue.kind === 'pov')).toBe(false)
    expect(report.issues.some((issue) => issue.kind === 'unseen')).toBe(false)
  })

  it('matches a unique first name from a full character name', async () => {
    const novel = await createNovel({ title: 'First names' })
    const chapter = await createChapter(novel.id, { title: 'One', content: '<p>Lyra crossed the room.</p>' })
    await updateChapter(chapter.id, { meta: { pov: 'Lyra Vale', location: '', timeOfDay: 'Night', beat: 'Arrival' } })
    await createCharacter(novel.id, { name: 'Lyra Vale' })
    const report = await continuityReport(novel.id)
    expect(report.issues.some((issue) => issue.kind === 'unseen')).toBe(false)
  })

  it('honours configured fact types and severity', async () => {
    const novel = await createNovel({ title: 'Configured facts' })
    const one = await createChapter(novel.id, { title: 'One', content: '<p>Mira was 30 years old.</p>' })
    const two = await createChapter(novel.id, { title: 'Two', content: '<p>Mira was 31 years old.</p>' })
    await updateChapter(one.id, { meta: { pov: 'Mira', location: 'Room', timeOfDay: 'Night', beat: 'Start' } })
    await updateChapter(two.id, { meta: { pov: 'Mira', location: 'Room', timeOfDay: 'Night', beat: 'Change' } })
    await createCharacter(novel.id, { name: 'Mira' })
    await updateWorkspacePreferences(novel.id, { continuity: { factTypes: ['age'], severity: 'block' } })
    const report = await continuityReport(novel.id)
    const issue = report.issues.find((item) => item.kind === 'fact-conflict')
    expect(issue?.severity).toBe(2)
    expect(issue?.title).toContain('age')
  })
})
