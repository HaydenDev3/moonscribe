import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { mediaDeletionWarning, mediaStoragePercent, sortMediaItems, toggleMediaSelection, readMediaView, writeMediaView } from '../src/dashboard/GlobalMedia'
import { dataUrlBytes } from '../src/db/moodboard'

const image = (id: string, text: string, createdAt: number, size = 4) => ({ id, text, createdAt, updatedAt: createdAt, novelId: 'novel-1', image: `data:image/jpeg;base64,${'a'.repeat(size * 1024)}` })

describe('global media library rules', () => {
  it('sorts the shared media dataset by name, size, newest, and oldest', () => {
    const items = [image('a', 'zeta.jpg', 10, 2), image('b', 'alpha.jpg', 20, 1)]
    expect(sortMediaItems(items, 'name').map((item) => item.text)).toEqual(['alpha.jpg', 'zeta.jpg'])
    expect(sortMediaItems(items, 'size')[0].id).toBe('a')
    expect(sortMediaItems(items, 'recent')[0].id).toBe('b')
    expect(sortMediaItems(items, 'oldest')[0].id).toBe('a')
  })

  it('keeps selection toggles deterministic for single and multi-select', () => {
    expect(toggleMediaSelection([], 'a')).toEqual(['a'])
    expect(toggleMediaSelection(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleMediaSelection(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('calculates a capped real storage percentage', () => {
    expect(mediaStoragePercent(25, 100)).toBe(25)
    expect(mediaStoragePercent(150, 100)).toBe(100)
    expect(mediaStoragePercent(1, 0)).toBe(0)
    expect(dataUrlBytes(image('a', 'asset', 1).image)).toBeGreaterThan(0)
  })

  it('warns before deleting assets associated with a story', () => {
    const items = [image('a', 'castle.jpg', 1), { id: 'orphan', image: 'data:image/png;base64,a' }]
    expect(mediaDeletionWarning(items, ['a'])).toContain('project records')
    expect(mediaDeletionWarning(items, ['orphan'])).toContain('cannot be undone')
  })

  it('persists the grid/list preference per browser storage', () => {
    const storage = new Map<string, string>()
    const adapter = { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) }
    expect(readMediaView(adapter)).toBe('grid')
    writeMediaView('list', adapter)
    expect(readMediaView(adapter)).toBe('list')
  })

  it('keeps the mobile layout to two columns without introducing page-width overflow', async () => {
    const css = await readFile('src/styles/app.css', 'utf8')
    expect(css).toContain('@media (max-width: 700px)')
    expect(css).toContain('.global-media-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }')
    expect(css).toContain('.global-media-workspace { display: block;')
  })
})
