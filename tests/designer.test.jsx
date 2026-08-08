// Smoke test for the Book Designer as a workspace mode: tabbed control rail,
// live cover preview, the Assets panel (templates, gallery, shapes), and the
// signature hand.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from '../src/context/AppContext'
import { ContextMenuProvider } from '../src/components/ContextMenu'
import BookDesigner from '../src/pages/BookDesigner'
import { getDB } from '../src/db/db'
import { DESIGNS } from '../src/designs/registry'
import { GALLERY } from '../src/designs/gallery'

let container
let root

beforeEach(async () => {
  const db = await getDB()
  await Promise.all(['novels', 'chapters', 'characters', 'notes', 'relationships', 'stats', 'world', 'moodboard', 'tombstones', 'meta'].map((s) => db.clear(s)))
  await db.put('novels', {
    id: 'n1',
    title: 'Design Me',
    blurb: '',
    coverStyle: 'moonstone',
    goalWords: 500,
    layout: {},
    createdAt: 1,
    updatedAt: 1,
    lastOpened: 1
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  root.unmount()
  container.remove()
})

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
  await new Promise((r) => setTimeout(r, 120))
}

const clickTab = async (label) => {
  const btn = [...container.querySelectorAll('.designer-tab')].find((b) => b.textContent.includes(label))
  expect(btn).not.toBeNull()
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 60))
}

describe('Book designer', () => {
  it('renders the tabbed workspace with a live cover preview', async () => {
    await renderDesigner()
    expect(container.querySelector('.designer-workspace')).not.toBeNull()
    const tabs = [...container.querySelectorAll('.designer-tab')].map((t) => t.textContent.trim())
    for (const label of ['Cover', 'Body text', 'Title page', 'Signature', 'Print & trim']) {
      expect(tabs.some((t) => t.includes(label))).toBe(true)
    }
    expect(tabs.some((t) => t.includes('Designs'))).toBe(false)
    expect(container.textContent).toContain('Cover preview')
    expect(container.querySelector('.designer-panel')).not.toBeNull()
  })

  it('opens the Assets panel with every premade design by default', async () => {
    await renderDesigner()
    const assets = container.querySelector('.designer-assets')
    expect(assets).not.toBeNull()
    expect(assets.classList.contains('open')).toBe(true)
    expect(assets.querySelectorAll('.design-card').length).toBe(DESIGNS.length)
    expect(assets.querySelector('.design-palette')).not.toBeNull()
  })

  it('toggles the Assets panel with the edge tab', async () => {
    await renderDesigner()
    const toggle = container.querySelector('.designer-assets-toggle')
    expect(toggle).not.toBeNull()
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 40))
    expect(container.querySelector('.designer-assets').classList.contains('open')).toBe(false)
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 40))
    expect(container.querySelector('.designer-assets').classList.contains('open')).toBe(true)
  })

  it('pages through the asset slides with the corner arrows', async () => {
    await renderDesigner()
    const slides = container.querySelector('.assets-slides')
    expect(slides).not.toBeNull()
    const [prev, next] = container.querySelectorAll('.assets-nav-btn')
    expect(prev).not.toBeNull()
    expect(next).not.toBeNull()
    expect(prev.disabled).toBe(true)
    expect(slides.style.transform).toMatch(/translateX\(-?0%\)/)
    next.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 40))
    expect(slides.style.transform).toBe('translateX(-100%)')
    expect(container.querySelectorAll('.assets-nav-dot')[1].classList.contains('active')).toBe(true)
    prev.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 40))
    expect(slides.style.transform).toMatch(/translateX\(-?0%\)/)
  })

  it('lists the built-in gallery and picks a backdrop for the cover', async () => {
    await renderDesigner()
    const grid = container.querySelector('.cover-pick-grid')
    expect(grid).not.toBeNull()
    expect(grid.querySelectorAll('.cover-pick').length).toBe(GALLERY.length + 2)
    const sea = [...grid.querySelectorAll('.cover-pick')].find((b) => b.textContent.includes('Sea glass'))
    expect(sea).not.toBeNull()
    sea.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 40))
    expect(sea.classList.contains('selected')).toBe(true)
  })

  it('picks ornaments and scene-break marks from the Shapes slide', async () => {
    await renderDesigner()
    const shapes = [...container.querySelectorAll('.assets-slide')].find((s) => s.textContent.includes('Cover ornament'))
    expect(shapes).not.toBeNull()
    const ornamentSwatches = [...shapes.querySelectorAll('.swatch')].filter((s) => s.textContent.trim().length > 0)
    const star = ornamentSwatches.find((s) => s.textContent.trim() === '✦')
    expect(star).not.toBeNull()
    star.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 40))
    expect(star.classList.contains('selected')).toBe(true)
  })

  it('offers the signature hand on the Signature tab', async () => {
    await renderDesigner()
    await clickTab('Signature')
    const input = container.querySelector('input[placeholder*="Storm Delacroix"]')
    expect(input).not.toBeNull()
  })
})
