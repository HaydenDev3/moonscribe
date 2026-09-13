import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AdminDashboard from '../src/pages/AdminDashboard'
import {
  AdminOverview,
  AdminHealthPanel,
  AdminUsersPage,
} from '../src/components/admin/ControlRoom'
import { MemoryRouter } from 'react-router-dom'
vi.mock('../src/context/AppContext', () => ({ useApp: () => ({ hasRole: () => false }) }))
vi.mock('../src/components/ContextMenu', () => ({
  useContextMenu: () => ({ openContextMenu: vi.fn() }),
}))
describe('Admin control room data boundaries', () => {
  it('retains the admin authorization guard', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    )
    expect(html).toContain('Admin access required.')
    expect(html).not.toContain('Total users')
  })
  it('never reports uncompleted checks as healthy', () => {
    const html = renderToStaticMarkup(<AdminHealthPanel health={null} loading />)
    expect(html).toContain('Checking…')
    expect(html).not.toContain('Healthy')
    expect(html).not.toContain('Configured')
  })
  it('shows failed and unconfigured checks explicitly', () => {
    const html = renderToStaticMarkup(
      <AdminHealthPanel health={{ online: false, emailDelivery: false }} loading={false} />
    )
    expect(html).toContain('Unavailable')
    expect(html).toContain('Not configured')
    expect(html).toContain('Unknown')
  })
  it('renders genuine zero counts without fabricated historical trends', () => {
    const html = renderToStaticMarkup(
      <AdminOverview
        users={[]}
        health={{ online: true }}
        audit={[]}
        flags={[]}
        announcements={[]}
        loading={false}
        unavailable={false}
        username="Admin"
        server="http://localhost:3001"
        onNavigate={() => {}}
      />
    )
    expect(html).toContain('No recorded admin activity yet.')
    expect(html).toContain('Current presence')
    expect(html).not.toContain('last week')
    expect(html).not.toContain('<svg')
  })
  it('renders the real users directory with role and connection filters', () => {
    const html = renderToStaticMarkup(
      <AdminUsersPage
        users={[
          {
            id: '1',
            username: 'Hayden',
            email: 'h@example.com',
            roles: ['user', 'admin'],
            online: true,
          },
        ]}
        loading={false}
        query=""
        onQuery={() => {}}
        onNavigate={() => {}}
        onProfile={() => {}}
        onRole={() => {}}
        onDisable={() => {}}
        onDelete={() => {}}
      />
    )
    expect(html).toContain('Search users')
    expect(html).toContain('Hayden')
    expect(html).toContain('Admin')
    expect(html).toContain('Connected')
    expect(html).toContain('admin-users-hero')
  })
})
