import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { getDB } from '../src/db/db'
import { createNovel } from '../src/db/novels'
import { getWorkspacePreferences, updateWorkspacePreferences, resetWorkspacePreferences } from '../src/db/workspacePreferences'
import { createProjectFile, listProjectFiles, updateProjectFile } from '../src/db/projectFiles'
import { PRINT_VENDOR_PRESETS } from '../src/utils/pageSize'

beforeEach(async () => { const db = await getDB(); for (const store of ['novels', 'projectFiles', 'workspacePreferences']) await db.clear(store) })

describe('configurable workspaces', () => {
  it('keeps preferences isolated per novel and restores defaults', async () => {
    const a = await createNovel({ title: 'A' }); const b = await createNovel({ title: 'B' })
    await updateWorkspacePreferences(a.id, { enabled: ['write', 'files'], pinned: 'files' })
    expect((await getWorkspacePreferences(a.id)).pinned).toBe('files')
    expect((await getWorkspacePreferences(b.id)).pinned).toBe('write')
    expect((await resetWorkspacePreferences(a.id)).enabled).toContain('planning')
  })

  it('persists project defaults and export presets without leaking between novels', async () => {
    const a = await createNovel({ title: 'A' }); const b = await createNovel({ title: 'B' })
    await updateWorkspacePreferences(a.id, {
      defaultView: 'design',
      exportPresets: { paperback: { format: 'pdf', printPreset: 'kdp-paperback', lineSpacing: '1.5' } },
    })
    expect((await getWorkspacePreferences(a.id)).defaultView).toBe('design')
    expect((await getWorkspacePreferences(a.id)).exportPresets.paperback.printPreset).toBe('kdp-paperback')
    expect((await getWorkspacePreferences(b.id)).defaultView).toBe('write')
    expect((await getWorkspacePreferences(b.id)).exportPresets).toEqual({})
  })
})

describe('print vendor presets', () => {
  it('defines production trim and bleed defaults for KDP and IngramSpark', () => {
    expect(PRINT_VENDOR_PRESETS).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'kdp-paperback', pageSize: 'us-trade', bleed: 3.175 }),
      expect.objectContaining({ key: 'ingramspark-paperback', pageSize: 'us-trade', bleed: 3.175 }),
    ]))
  })
})

describe('project files', () => {
  it('creates, lists, updates and preserves imported metadata', async () => {
    const novel = await createNovel({ title: 'Files' }); const file = await createProjectFile(novel.id, { name: 'notes.txt', mimeType: 'text/plain', size: 12, content: 'hello' })
    expect((await listProjectFiles(novel.id))[0].content).toBe('hello')
    await updateProjectFile(file.id, { folderId: 'research', name: 'research.txt' })
    expect((await listProjectFiles(novel.id))[0]).toMatchObject({ name: 'research.txt', folderId: 'research' })
  })
})
