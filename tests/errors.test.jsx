// Error handling: the on-brand 404 and the soft-landing error boundary.
import { describe, it, expect, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import NotFound from '../src/pages/NotFound'
import ErrorBoundary from '../src/components/ErrorBoundary'

let container
let root

afterEach(() => {
  root?.unmount()
  container?.remove()
})

const mount = (el) => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  root.render(el)
}

describe('NotFound', () => {
  it('offers a way back to the shelf', async () => {
    mount(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(container.textContent).toContain('404')
    const link = container.querySelector('a[href="/"]')
    expect(link?.textContent).toContain('Back to all novels')
  })
})

describe('ErrorBoundary', () => {
  it('catches render errors and lands softly instead of a blank screen', async () => {
    const Boom = () => {
      throw new Error('ink spilled')
    }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mount(
      <MemoryRouter>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </MemoryRouter>
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(container.textContent).toContain('Something slipped in the ink')
    expect(container.textContent).toContain('Reload the page')
    errSpy.mockRestore()
  })

  it('passes healthy children through untouched', async () => {
    mount(
      <MemoryRouter>
        <ErrorBoundary>
          <div>still writing</div>
        </ErrorBoundary>
      </MemoryRouter>
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(container.textContent).toBe('still writing')
  })
})
