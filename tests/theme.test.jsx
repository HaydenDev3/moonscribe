import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { createRoot } from 'react-dom/client'
import { AppProvider } from '../src/context/AppContext'

let container
let root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  root.unmount()
  container.remove()
  delete document.documentElement.dataset.theme
})

const render = () => {
  root.render(
    <AppProvider>
      <span>theme test</span>
    </AppProvider>
  )
}

describe('theme system', () => {
  it('defaults to light when no system preference is set', async () => {
    render()
    await new Promise((r) => setTimeout(r, 100))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('sets amoled on the html element when persisted', async () => {
    const { setMeta } = await import('../src/db/meta')
    await setMeta('settings', { theme: 'amoled', paperTexture: false })
    render()
    await new Promise((r) => setTimeout(r, 100))
    expect(document.documentElement.dataset.theme).toBe('amoled')
  })
})
