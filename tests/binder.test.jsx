// Inline section test: the binder lives inside the writer workspace now.
// Each section renders as a workspace mode with its heading always visible,
// no drawer overlay, and the legacy deep links still resolve.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from '../src/context/AppContext'
import { ContextMenuProvider } from '../src/components/ContextMenu'
import Novel from '../src/pages/Novel'
import { getDB } from '../src/db/db'

let container
let root

const waitFor = async (predicate, timeout = 1200) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (predicate()) return
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error('Timed out waiting for expected DOM state')
}

beforeEach(async () => {
  const db = await getDB()
  await Promise.all(['novels', 'chapters', 'characters', 'notes', 'relationships', 'stats', 'world', 'moodboard', 'tombstones', 'meta'].map((s) => db.clear(s)))
  await db.put('novels', {
    id: 'n1', title: 'Smoke', blurb: '', coverStyle: 'moonstone', goalWords: 500,
    layout: {}, createdAt: 1, updatedAt: 1, lastOpened: 1
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  root.unmount()
  container.remove()
})

const renderSection = async (path) => {
  root.render(
    <AppProvider>
      <ContextMenuProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/novel/:id" element={<Novel />} />
            <Route path="/novel/:id/:mode" element={<Novel />} />
            <Route path="/novel/:id/binder/:section" element={<Novel />} />
          </Routes>
        </MemoryRouter>
      </ContextMenuProvider>
    </AppProvider>
  )
  await waitFor(() => container.querySelector('.mode-body h2'))
}

describe('Inline binder sections', () => {
  it.each([
    ['characters', '/novel/n1/characters', 'Characters'],
    ['relationships', '/novel/n1/relationships', 'Relationships'],
    ['world', '/novel/n1/world', 'Worldbuilding'],
    ['moodboard', '/novel/n1/moodboard', 'Moodboard']
  ])('renders the %s section inline with its heading visible', async (_key, path, heading) => {
    await renderSection(path)
    const body = container.querySelector('.mode-body')
    expect(body).not.toBeNull()
    expect(body.querySelector('h2')?.textContent).toBe(heading)
    expect(container.querySelector('.binder-panel')).toBeNull()
  })

  it('resolves legacy binder deep links to the inline section', async () => {
    await renderSection('/novel/n1/binder/world')
    expect(container.querySelector('.mode-body h2')?.textContent).toBe('Worldbuilding')
  })
})
