// Smoke test for the editor workspace: renders, carries the active design
// class, and exposes the Designs palette toggle.
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

beforeEach(async () => {
  const db = await getDB()
  await Promise.all(['novels', 'chapters', 'characters', 'notes', 'relationships', 'stats', 'world', 'moodboard', 'tombstones', 'meta'].map((s) => db.clear(s)))
  await db.put('novels', {
    id: 'n1', title: 'Workspace', blurb: '', coverStyle: 'moonstone', goalWords: 500,
    layout: { editorDesign: 'ember' }, createdAt: 1, updatedAt: 1, lastOpened: 1
  })
  await db.put('chapters', {
    id: 'c1', novelId: 'n1', title: 'Chapter One', content: '<p>Once there was a moon.</p>',
    wordCount: 6, status: 'draft', part: '', createdAt: 1, updatedAt: 1
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  root.unmount()
  container.remove()
})

const renderNovel = async (path = '/novel/n1') => {
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
  await new Promise((r) => setTimeout(r, 150))
}

describe('Novel workspace', () => {
  it('renders the editor and applies the saved design class', async () => {
    await renderNovel()
    const ws = container.querySelector('.workspace')
    expect(ws).not.toBeNull()
    expect(ws.className).toContain('design-ember')
    expect(container.querySelector('[contenteditable]')).not.toBeNull()
  })

  it('opens the Designs palette and lists premade packs', async () => {
    await renderNovel()
    const toggle = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Designs'))
    expect(toggle).not.toBeNull()
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 50))
    const cards = container.querySelectorAll('.design-card')
    expect(cards.length).toBeGreaterThan(0)
    expect(container.textContent).toContain('Drag a design onto the page')
  })

  it('renders a binder section inline for a binder route', async () => {
    await renderNovel('/novel/n1/binder/characters')
    expect(container.querySelector('.binder-panel')).toBeNull()
    const body = container.querySelector('.mode-body')
    expect(body).not.toBeNull()
    expect(body.querySelector('h2')?.textContent).toBe('Characters')
  })

  it('renders the designer as a workspace mode with its own control rail and the chapter sidebar', async () => {
    await renderNovel('/novel/n1/design')
    expect(container.querySelector('.designer-workspace')).not.toBeNull()
    expect(container.textContent).toContain('Cover preview')
    expect(container.querySelector('.sidebar')).not.toBeNull()
  })

  it('renders analytics as a workspace mode', async () => {
    await renderNovel('/novel/n1/analytics')
    expect(container.textContent).toContain('Total words')
    expect(container.querySelector('.mode-body h2')?.textContent).toBe('Analytics')
  })

  it('shows a soft not-found state for an unknown novel', async () => {
    await renderNovel('/novel/missing')
    expect(container.textContent).toContain('The book’s not here')
  })
})
