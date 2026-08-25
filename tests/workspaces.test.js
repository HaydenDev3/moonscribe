import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { getDB } from '../src/db/db'
import { createNovel } from '../src/db/novels'
import { getWorkspacePreferences, updateWorkspacePreferences, resetWorkspacePreferences } from '../src/db/workspacePreferences'
import { createProjectFile, listProjectFiles, updateProjectFile } from '../src/db/projectFiles'

beforeEach(async () => { const db = await getDB(); for (const store of ['novels', 'projectFiles', 'workspacePreferences']) await db.clear(store) })

describe('configurable workspaces', () => {
  it('keeps preferences isolated per novel and restores defaults', async () => {
    const a = await createNovel({ title: 'A' }); const b = await createNovel({ title: 'B' })
    await updateWorkspacePreferences(a.id, { enabled: ['write', 'files'], pinned: 'files' })
    expect((await getWorkspacePreferences(a.id)).pinned).toBe('files')
    expect((await getWorkspacePreferences(b.id)).pinned).toBe('write')
    expect((await resetWorkspacePreferences(a.id)).enabled).toContain('planning')
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
