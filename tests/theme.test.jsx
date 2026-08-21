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

async function waitForTheme(value, tries = 100) {
  for (let i = 0; i < tries; i++) {
    if (document.documentElement.dataset.theme === value) return
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error(`Timed out waiting for theme "${value}"`)
}

describe('theme system', () => {
  it('defaults to light (Parchment) when no preference is set', async () => {
    render()
    await waitForTheme('light')
  })

  it('sets amoled on the html element when persisted', async () => {
    const { setMeta } = await import('../src/db/meta')
    await setMeta('settings', { theme: 'amoled', paperTexture: false })
    render()
    await waitForTheme('amoled')
  })

  it('sets light on the html element when persisted', async () => {
    const { setMeta } = await import('../src/db/meta')
    await setMeta('settings', { theme: 'light', paperTexture: false })
    render()
    await waitForTheme('light')
  })

  it('coerces unsupported theme values to light', async () => {
    const { setMeta } = await import('../src/db/meta')
    await setMeta('settings', { theme: 'sepia', paperTexture: false })
    render()
    await waitForTheme('light')
  })
})
