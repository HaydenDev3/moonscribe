import { beforeEach, describe, expect, it, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from '../src/context/AppContext'
import InteriorLayoutPage from '../src/pages/InteriorLayoutPage'
import { getDB } from '../src/db/db'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  const db = await getDB()
  await Promise.all(['novels', 'chapters', 'meta'].map((store) => db.clear(store)))
  await db.put('novels', { id: 'n1', title: 'Interior test', layout: {}, updatedAt: 1 })
  await db.put('chapters', { id: 'c1', novelId: 'n1', title: 'Opening', content: '<p>Text</p>', order: 0, updatedAt: 1 })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  root.render(<AppProvider><MemoryRouter><InteriorLayoutPage novelId="n1" /></MemoryRouter></AppProvider>)
  const start = Date.now()
  while (!container.querySelector('.interior-layout') && Date.now() - start < 3000) await new Promise((resolve) => setTimeout(resolve, 20))
})

afterEach(() => { root.unmount(); container.remove() })

describe('Interior Layout desktop surface', () => {
  it('renders the page setup, preview, and book-style controls', () => {
    expect(container.querySelector('.interior-layout')).not.toBeNull()
    expect(container.querySelector('.interior-left-panel')).not.toBeNull()
    expect(container.querySelector('.interior-preview-column')).not.toBeNull()
    expect(container.querySelector('.interior-right-panel')).not.toBeNull()
    expect(container.textContent).toContain('Interior Layout')
    expect(container.textContent).toContain('Page Layout')
  })
})
