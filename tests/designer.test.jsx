// Smoke test for the reimagined Book Designer ("cover studio"): a hero stage
// with the book, a single floating rail whose icons switch sections (cover
// text, full-wrap imagery, ornaments, body, title, signature, print),
// and a floating action bar that toggles the cover / page preview.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from '../src/context/AppContext'
import { ContextMenuProvider } from '../src/components/ContextMenu'
import BookDesigner from '../src/pages/BookDesigner'
import { getDB } from '../src/db/db'
import { GALLERY } from '../src/designs/gallery'

let container
let root

beforeEach(async () => {
  const db = await getDB()
  await Promise.all(['novels', 'chapters', 'characters', 'notes', 'relationships', 'stats', 'world', 'moodboard', 'tombstones', 'meta'].map((s) => db.clear(s)))
  await db.put('novels', {
    id: 'n1', title: 'Design Me', blurb: '', coverStyle: 'moonstone',
    goalWords: 500, layout: {}, createdAt: 1, updatedAt: 1, lastOpened: 1
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  root.unmount()
  container.remove()
})

const waitFor = async (predicate, timeout = 1200) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (predicate()) return
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error('Timed out waiting for expected DOM state')
}

const renderDesigner = async () => {
  root.render(
    <AppProvider>
      <ContextMenuProvider>
        <MemoryRouter initialEntries={['/novel/n1/design']}>
          <Routes>
            <Route path="/novel/:id/design" element={<BookDesigner />} />
          </Routes>
        </MemoryRouter>
      </ContextMenuProvider>
    </AppProvider>
  )
  await waitFor(() => container.querySelector('.cover-studio'))
}

const clickSection = async (label) => {
  const btn = container.querySelector(`.studio-rail-icon[aria-label="${label}"]`)
  expect(btn).not.toBeNull()
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 60))
}

describe('Book designer (cover studio)', () => {
  it('renders the hero stage, section rail and action bar', async () => {
    await renderDesigner()
    expect(container.querySelector('.cover-studio')).not.toBeNull()
    expect(container.querySelector('.studio-hero')).not.toBeNull()
    expect(container.querySelector('.studio-bar')).not.toBeNull()

    const labels = [...container.querySelectorAll('.studio-rail-icon')].map((b) => b.getAttribute('aria-label'))
    for (const l of ['Cover text', 'Cover image', 'Ornaments', 'Body text', 'Title page', 'Signature', 'Print & trim']) {
      expect(labels).toContain(l)
    }
    expect(labels).not.toContain('Design packs')
    expect(container.querySelector('.studio-rail-head strong').textContent).toContain('Cover text')
  })

  it('targets the front, spine and back from the book stage', async () => {
    await renderDesigner()
    const buttons = [...container.querySelectorAll('.ds-surface-switch button')]
    expect(buttons.map((button) => button.textContent)).toEqual(['front', 'spine', 'back'])
    buttons[2].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(buttons[2].classList.contains('active')).toBe(true)
  })

  it('lists the built-in gallery and picks a backdrop for the cover', async () => {
    await renderDesigner()
    await clickSection('Cover image')
    const grid = container.querySelector('.cover-pick-grid')
    expect(grid).not.toBeNull()
    expect(grid.querySelectorAll('.cover-pick').length).toBe(GALLERY.length)
    const sea = [...grid.querySelectorAll('.cover-pick')].find((b) => b.textContent.includes('Sea glass'))
    expect(sea).not.toBeNull()
    sea.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 40))
    expect(sea.classList.contains('selected')).toBe(true)
  })

  it('picks an ornament from the Ornaments section', async () => {
    await renderDesigner()
    await clickSection('Ornaments')
    const swatches = [...container.querySelectorAll('.studio-rail-scroll .swatch')].filter((s) => s.textContent.trim().length > 0)
    const star = swatches.find((s) => s.textContent.trim() === '✦')
    expect(star).not.toBeNull()
    star.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 40))
    expect(star.classList.contains('selected')).toBe(true)
  })

  it('offers the signature hand on the Signature section', async () => {
    await renderDesigner()
    await clickSection('Signature')
    expect(container.querySelector('input[placeholder*="Storm Delacroix"]')).not.toBeNull()
  })

  it('opens the unified print preview from the action bar', async () => {
    await renderDesigner()
    const [coverBtn, pageBtn] = container.querySelector('.studio-seg').querySelectorAll('button')
    expect(coverBtn.classList.contains('active')).toBe(true)
    pageBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(window.location.hash).toContain('/novel/n1/design/print')
  })
})
