import {
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import Select from '../Select'
import ProfilePopover from '../ProfilePopover'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../ui/sheet'
import '../../styles/control-room.css'

const navigation = [
  ['Dashboard', 'Overview', 'house'],
  ['Users', 'People', 'users'],
  ['Health', 'System', 'heart-pulse'],
  ['Audit log', 'System', 'list-check'],
  ['Feature flags', 'Releases', 'flag'],
  ['Announcements', 'Releases', 'bullhorn'],
  ['Email', 'Releases', 'envelope'],
]
const card =
  'relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0b0d]/95 shadow-[0_16px_45px_rgba(0,0,0,0.22)]'
const muted = 'text-[#f2ede4]/55'
const gold = 'text-primary'
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <i aria-hidden="true" className={`fa-solid fa-${name} ${className}`} />
}
export function AdminEnvironmentBadge({ server }: { server: string }) {
  let environment = 'NOT CONNECTED'
  try {
    const host = new URL(server).hostname
    environment =
      host === 'moonscribe.cc' || host.endsWith('.moonscribe.cc') ? 'PRODUCTION' : 'LOCAL / STAGING'
  } catch {
    /* No configured server. */
  }
  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-2 text-[9px] tracking-wider text-primary">
      <span className="size-1.5 rounded-full bg-primary" />
      {environment}
      <span className="ml-1 tracking-normal">Admin verified</span>
    </div>
  )
}
export function AdminShell({
  section,
  onNavigate,
  username,
  server,
  avatarUrl,
  onAccountCentre,
  onSettings,
  onSync,
  onSignOut,
  children,
}: {
  section: string
  onNavigate: (section: string) => void
  username: string
  server: string
  avatarUrl?: string | null
  bannerUrl?: string | null
  displayName?: string | null
  writerName?: string | null
  profileBio?: string | null
  onAccountCentre?: () => void
  onSettings?: () => void
  onSync?: () => void
  onSignOut?: () => void
  children: ReactNode
}) {
  const [menu, setMenu] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const opener = useRef<HTMLButtonElement | null>(null)
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null)
  const openProfile = (event: ReactMouseEvent<HTMLButtonElement>) => {
    setProfileAnchor(event.currentTarget)
    setProfileOpen(true)
  }
  const openMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget
    setMenu(true)
  }
  const navigate = (value: string) => {
    onNavigate(value)
    setMenu(false)
    window.scrollTo({ top: 0 })
  }
  const navItem = (label: string, icon: string) => (
    <button
      type="button"
      key={label}
      aria-current={section === label ? 'page' : undefined}
      onClick={() => navigate(label)}
      className={`relative flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm transition-colors duration-150 ${section === label ? 'border-primary/25 bg-primary/[0.07] text-[#f2ede4]' : 'border-transparent text-[#f2ede4]/55 hover:bg-white/5'}`}
    >
      <Icon name={icon} className={`w-4 text-center ${section === label ? gold : ''}`} />
      {label}
    </button>
  )
  return (
    <main
      id="main-content"
      className="control-room min-h-dvh bg-[#050506] text-[#f2ede4] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]"
    >
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-white/[0.07] bg-[#0a0b0d] px-5 py-8 lg:flex">
        <Link to="/admin" className="mb-8 px-3 font-heading text-3xl text-[#f2ede4] no-underline">
          MoonScribe
          <span className="mt-1 block font-sans text-[9px] uppercase tracking-[0.25em] text-primary">
            Admin
          </span>
        </Link>
        <nav aria-label="Admin sections" className="space-y-6">
          {['Overview', 'People', 'System', 'Releases'].map((group) => (
            <div key={group}>
              <div className="mb-2 px-3 text-[9px] uppercase tracking-[0.2em] text-[#f2ede4]/35">
                {group}
              </div>
              {navigation
                .filter(([, value]) => value === group)
                .map(([label, , icon]) => navItem(label, icon))}
            </div>
          ))}
        </nav>
        <div className="mt-auto pt-8">
          <Link
            to="/dashboard"
            className="flex min-h-11 items-center gap-3 px-3 text-sm text-[#f2ede4]/60 no-underline"
          >
            <Icon name="arrow-left" />
            Return to studio
          </Link>
          <div className="mt-4 flex items-center gap-3 border-t border-white/[0.07] px-3 pt-5">
            <button
              type="button"
              onClick={openProfile}
              aria-label="Open account menu"
              className="admin-account-trigger size-9 shrink-0 overflow-hidden rounded-full border border-primary/25 font-heading text-xl text-primary"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                username[0].toUpperCase()
              )}
            </button>
            <div className="min-w-0">
              <div className="truncate text-xs">{username}</div>
              <div className="mt-1 text-[10px] text-[#f2ede4]/40">Administrator</div>
            </div>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-3 border-b border-white/[0.06] bg-black/80 px-4 backdrop-blur-xl lg:h-[100px] lg:px-8 xl:px-12">
          <button
            onClick={openMenu}
            aria-label="Open admin navigation"
            className="flex size-11 items-center justify-center rounded-lg text-[#f2ede4] lg:hidden"
          >
            <Icon name="bars" />
          </button>
          <div className="text-center lg:text-left">
            <div className="hidden text-[9px] uppercase tracking-[0.23em] text-[#f2ede4]/40 lg:block">
              MoonScribe control room
            </div>
            <h1 className="m-0 font-heading text-[26px] font-normal lg:mt-1 lg:text-3xl">
              <span className="lg:hidden">{section === 'Dashboard' ? 'MoonScribe' : section}</span>
              <span className="hidden lg:inline">{section}</span>
            </h1>
            <div className="text-[9px] tracking-[0.25em] text-primary lg:hidden">
              {section === 'Dashboard' ? 'ADMIN' : 'Admin Control Room'}
            </div>
          </div>
          <div className="hidden lg:block">
            <AdminEnvironmentBadge server={server} />
          </div>
          <button
            type="button"
            onClick={openProfile}
            aria-label="Open account menu"
            className="admin-account-trigger size-11 shrink-0 overflow-hidden rounded-full border border-primary/25 bg-primary/5 font-heading text-2xl text-[#f2ede4] lg:hidden"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              username[0].toUpperCase()
            )}
          </button>
        </header>
        <div className="mx-auto max-w-[1600px] px-4 pt-5 pb-[calc(92px+env(safe-area-inset-bottom))] md:px-7 lg:px-8 lg:py-7 xl:px-12">
          {children}
        </div>
      </div>
      <ProfilePopover
        open={profileOpen}
        anchor={profileAnchor}
        onClose={() => setProfileOpen(false)}
        profile={{
          username,
          avatarUrl: avatarUrl || undefined,
          presence: 'online',
          showActivity: false,
        }}
        actions={[
          {
            label: 'Account Centre',
            icon: 'fa-solid fa-user-shield',
            onClick: () => onAccountCentre?.(),
          },
          { label: 'Settings', icon: 'fa-solid fa-gear', onClick: () => onSettings?.() },
          { label: 'Sync now', icon: 'fa-solid fa-rotate', onClick: () => onSync?.() },
          {
            label: 'Sign out',
            icon: 'fa-solid fa-right-from-bracket',
            onClick: () => onSignOut?.(),
          },
        ]}
      />
      <nav
        aria-label="Primary admin navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid h-[74px] grid-cols-5 border-t border-white/[0.07] bg-black/90 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {[
          ['Dashboard', 'house'],
          ['Users', 'users'],
          ['Health', 'database'],
          ['Audit log', 'list-check'],
          ['More', 'ellipsis'],
        ].map(([label, icon]) => {
          const active =
            label === 'More'
              ? !['Dashboard', 'Users', 'Health', 'Audit log'].includes(section)
              : section === label
          return (
            <button
              type="button"
              key={label}
              aria-current={active ? 'page' : undefined}
              onClick={label === 'More' ? openMenu : () => navigate(label)}
              className={`relative flex h-full min-h-0 flex-col items-center justify-center gap-1 text-[10px] ${active ? 'text-primary' : 'text-[#f2ede4]/45'}`}
            >
              {active && <span className="absolute top-0 h-0.5 w-9 rounded-full bg-primary" />}
              <Icon name={icon} className="text-lg" />
              {label === 'Health' ? 'System' : label}
            </button>
          )
        })}
      </nav>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent
          className="control-room overflow-y-auto bg-[#0a0b0d]"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            opener.current?.focus()
          }}
        >
          <div className="flex items-center justify-between">
            <SheetTitle className="font-heading text-2xl">MoonScribe studio</SheetTitle>
            <button
              aria-label="Close navigation"
              onClick={() => setMenu(false)}
              className="size-11"
            >
              <Icon name="xmark" />
            </button>
          </div>
          <SheetDescription className="text-sm text-[#f2ede4]/55">
            Global app menu · signed in as {username}
          </SheetDescription>
          <nav
            aria-label="Studio navigation"
            className="mt-4 space-y-1 border-b border-white/[0.07] pb-4"
          >
            {[
              ['Home', 'house'],
              ['Library', 'book-open'],
              ['Media', 'images'],
              ['Journal', 'book'],
              ['Insights', 'chart-line'],
              ['Author website', 'globe'],
              ['Settings', 'gear'],
            ].map(([label, icon]) => (
              <Link
                key={label}
                to={
                  label === 'Home'
                    ? '/dashboard'
                    : label === 'Author website'
                      ? '/author-website'
                      : '/dashboard'
                }
                onClick={() => setMenu(false)}
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-[#f2ede4]/70 hover:bg-white/5"
              >
                <Icon name={icon} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mb-2 mt-4 px-3 text-[9px] uppercase tracking-[0.2em] text-[#f2ede4]/35">
            Admin control room
          </div>
          <nav aria-label="All admin sections" className="space-y-2">
            {navigation.map(([label, , icon]) => navItem(label, icon))}
          </nav>
          <Link to="/dashboard" className="flex min-h-11 items-center gap-3 text-sm text-primary">
            <Icon name="arrow-left" />
            Return to studio
          </Link>
          <AdminEnvironmentBadge server={server} />
        </SheetContent>
      </Sheet>
    </main>
  )
}
type Health = {
  online?: boolean
  emailDelivery?: boolean
  emailAuth?: boolean
  database?: string
  activeSessions?: number
}
function status(value: boolean | undefined, loading: boolean, yes = 'Healthy', no = 'Unavailable') {
  return value === undefined ? (loading ? 'Checking…' : 'Unknown') : value ? yes : no
}
export function AdminHealthPanel({ health, loading }: { health: Health | null; loading: boolean }) {
  const rows = [
    ['API', status(health?.online, loading)],
    ['Authentication', status(health?.emailAuth, loading, 'Enabled', 'Disabled')],
    ['Resend', status(health?.emailDelivery, loading, 'Configured', 'Not configured')],
    ['Database', health?.database ? `${health.database} · Connected` : 'Unknown'],
  ]
  return (
    <article className={card}>
      <div className="flex items-center gap-3 p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-300/5 text-emerald-300">
          <Icon name="heart-pulse" className="text-xl" />
        </span>
        <div>
          <h2 className="m-0 font-heading text-2xl font-normal">System health</h2>
          <p className={`mt-1 mb-0 text-xs ${muted}`}>Live checks from the account service.</p>
        </div>
      </div>
      <div className="px-5">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex min-h-14 items-center justify-between gap-3 border-t border-white/[0.06] text-xs"
          >
            <span>{label}</span>
            <span
              className={`flex items-center gap-2 ${['Healthy', 'Enabled', 'Configured'].includes(value) || value.includes('Connected') ? 'text-emerald-300' : value === 'Unavailable' ? 'text-red-300' : value.includes('configured') || value === 'Disabled' ? 'text-amber-200' : muted}`}
            >
              <span className="size-1.5 shrink-0 rounded-full bg-current" />
              {value}
            </span>
          </div>
        ))}
      </div>
    </article>
  )
}
function AdminMetricCard({
  title,
  value,
  icon,
  note,
  semantic = false,
}: {
  title: string
  value: ReactNode
  icon: string
  note: string
  semantic?: boolean
}) {
  return (
    <article className={`${card} admin-metric-card p-5 lg:p-6`}>
      <div className={`flex min-h-6 items-center gap-2 text-xs ${muted}`}>
        <Icon name={icon} />
        {title}
      </div>
      <div
        className={`mt-5 font-heading ${semantic ? 'text-[23px] lg:text-[28px]' : 'text-4xl lg:text-[42px]'} leading-none ${semantic && (value === 'Healthy' || value === 'Configured') ? 'text-emerald-300' : ''}`}
      >
        {value}
      </div>
      <p className={`mt-3 mb-0 text-[10px] ${muted}`}>{note}</p>
    </article>
  )
}
export function AdminOverview({
  users,
  health,
  audit,
  flags,
  announcements,
  loading,
  unavailable,
  username,
  server,
  onNavigate,
}: {
  users: { online?: boolean; roles: string[] }[] | null
  health: Health | null
  audit: {
    id: number
    action: string
    actor: string
    target?: string
    detail: string
    createdAt: number
  }[]
  flags: { enabled: boolean }[] | null
  announcements: { title: string }[]
  loading: boolean
  unavailable: boolean
  username: string
  server: string
  onNavigate: (section: string) => void
}) {
  const pending = loading ? (
    <span
      className="inline-block h-7 w-14 animate-pulse rounded bg-white/10 motion-reduce:animate-none"
      aria-label="Loading"
    />
  ) : (
    'Unknown'
  )
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const active = users?.filter((user) => user.online).length
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden py-2 lg:pb-4">
        <div className="pointer-events-none absolute -top-24 right-0 size-64 rounded-full bg-primary/[0.035] blur-3xl" />
        <span className="hidden text-[9px] uppercase tracking-[0.22em] text-primary lg:block">
          Your instance, at a glance
        </span>
        <h2 className="admin-greeting mt-2 mb-2 break-words font-heading text-[32px] leading-[1.1] font-normal lg:text-[38px]">
          {greeting},<br className="lg:hidden" /> <span>{username}</span>
        </h2>
        <p className={`mt-3 mb-5 max-w-lg text-sm leading-relaxed ${muted}`}>
          Here’s what’s happening with your MoonScribe instance.
        </p>
        <div className="lg:hidden">
          <AdminEnvironmentBadge server={server} />
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
        <AdminMetricCard
          title="Total users"
          icon="users"
          value={users ? users.length : pending}
          note="Registered accounts"
        />
        <AdminMetricCard
          title="Admins"
          icon="shield-halved"
          value={users ? users.filter((user) => user.roles.includes('admin')).length : pending}
          note="Administrative access"
        />
        <AdminMetricCard
          title="API status"
          icon="cloud"
          value={status(health?.online, loading)}
          note="Account service"
          semantic
        />
        <AdminMetricCard
          title="Resend"
          icon="envelope"
          value={status(health?.emailDelivery, loading, 'Configured', 'Not configured')}
          note="Email delivery"
          semantic
        />
      </div>
      <button
        onClick={() => onNavigate('Users')}
        className="admin-operations flex w-full items-center gap-4 rounded-2xl border border-primary/30 bg-linear-to-r from-primary/[0.08] to-[#0a0b0d] p-5 text-left transition-colors hover:border-primary/50"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary">
          <Icon name="users" className="text-xl" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#f2ede4]/65">
            Active writers now
          </div>
          <div className="mt-1 font-heading text-3xl">{active ?? pending}</div>
        </div>
        <div className="hidden text-right sm:block">
          <div className="font-heading text-2xl">{health?.activeSessions ?? '—'}</div>
          <div className={`mt-1 text-[10px] ${muted}`}>Unexpired sessions</div>
        </div>
        <span className={`max-w-20 text-[10px] leading-relaxed ${muted}`}>Current presence</span>
        <Icon name="chevron-right" className="text-xs text-primary" />
      </button>
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:order-2 lg:col-span-5 xl:col-span-4">
          <AdminHealthPanel health={health} loading={loading} />
        </div>
        <article className={`${card} admin-recent-activity lg:order-1 lg:col-span-7 xl:col-span-8`}>
          <div className="flex items-center justify-between gap-2 px-5 pt-5">
            <h2 className="m-0 font-heading text-2xl font-normal">Recent activity</h2>
            <button
              onClick={() => onNavigate('Audit log')}
              className="min-h-11 text-xs text-primary"
            >
              See all <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="px-5 pb-3">
            {loading || unavailable ? (
              <p className={`py-5 text-sm ${muted}`}>
                {loading ? 'Loading recent activity…' : 'Activity unavailable.'}
              </p>
            ) : audit.length ? (
              audit.slice(0, 4).map((event) => (
                <button
                  key={event.id}
                  onClick={() => onNavigate('Audit log')}
                  className="flex w-full items-center gap-3 border-t border-white/[0.06] py-4 text-left"
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.03] ${event.action.includes('delet') ? 'text-red-300' : gold}`}
                  >
                    <Icon name={event.action.includes('delet') ? 'trash-can' : 'users-gear'} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-xs leading-relaxed">
                      {event.target || event.actor} {event.detail}
                    </div>
                    <time
                      className={`mt-1 block text-[10px] ${muted}`}
                      dateTime={new Date(event.createdAt).toISOString()}
                    >
                      {new Date(event.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <Icon name="chevron-right" className="text-[10px] text-[#f2ede4]/35" />
                </button>
              ))
            ) : (
              <p className={`py-5 text-sm ${muted}`}>No recorded admin activity yet.</p>
            )}
          </div>
        </article>
        <article className={`${card} admin-quick-operations p-5 lg:order-3 lg:col-span-7`}>
          <h2 className="mt-0 mb-4 font-heading text-2xl font-normal">Quick operations</h2>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {navigation
              .filter(([label]) => !['Dashboard', 'Health'].includes(label))
              .map(([label, , icon]) => (
                <button
                  key={label}
                  onClick={() => onNavigate(label)}
                  className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-left text-xs text-[#f2ede4]/65 transition-colors hover:bg-white/5 hover:text-primary"
                >
                  <Icon name={icon} className="w-4 text-primary" />
                  {label}
                  <span className="ml-auto">→</span>
                </button>
              ))}
          </div>
        </article>
        <article className={`${card} p-5 lg:order-4 lg:col-span-5`}>
          <h2 className="mt-0 mb-4 font-heading text-2xl font-normal">Release state</h2>
          <button
            onClick={() => onNavigate('Feature flags')}
            className="flex min-h-11 w-full items-center justify-between border-b border-white/[0.06] text-xs"
          >
            <span className={muted}>Enabled feature flags</span>
            <span>
              {flags
                ? `${flags.filter((flag) => flag.enabled).length} / ${flags.length}`
                : 'Unknown'}
            </span>
          </button>
          <button onClick={() => onNavigate('Announcements')} className="mt-4 w-full text-left">
            <span className={`block text-[10px] ${muted}`}>Latest announcement</span>
            <span className="mt-2 block text-sm leading-relaxed">
              {loading
                ? 'Loading…'
                : unavailable
                  ? 'Unknown'
                  : announcements[0]?.title || 'No announcements published'}
            </span>
          </button>
        </article>
      </div>
      <p className="text-center text-[9px] tracking-wide text-[#f2ede4]/30 lg:text-left">
        Current server snapshot · Refreshes every 15 seconds
      </p>
    </div>
  )
}

type UserRecord = {
  id: string
  username: string
  email?: string | null
  avatarUrl?: string | null
  bannerUrl?: string | null
  displayName?: string | null
  writerName?: string | null
  profileBio?: string | null
  roles: string[]
  disabledAt?: number | null
  createdAt?: number
  online?: boolean
  lastSeenAt?: number | null
}
const displayRole = (roles: string[]) =>
  roles.includes('admin')
    ? 'Admin'
    : roles.includes('developer')
      ? 'Developer'
      : roles.includes('beta_tester')
        ? 'Beta tester'
        : 'User'
const ago = (time?: number | null) => {
  if (!time) return 'Unknown'
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
export function AdminUsersPage({
  users,
  selectedUserId,
  loading,
  query,
  onQuery,
  onNavigate,
  onProfile,
  onRole,
  onDisable,
  onDelete,
}: {
  selectedUserId?: string
  users: UserRecord[]
  loading: boolean
  query: string
  onQuery: (value: string) => void
  onNavigate: (section: string) => void
  onProfile: (user: UserRecord) => void
  onRole: (user: UserRecord, value: string) => void
  onDisable: (user: UserRecord) => void
  onDelete: (user: UserRecord) => void
}) {
  const [filter, setFilter] = useState('all')
  const filtered = users.filter((user) => {
    const text = `${user.username} ${user.email || ''} ${user.roles.join(' ')}`.toLowerCase()
    const matches = text.includes(query.toLowerCase())
    return (
      matches &&
      (filter === 'all' ||
        (filter === 'admins' && user.roles.includes('admin')) ||
        (filter === 'users' && !user.roles.includes('admin')) ||
        (filter === 'connected' && user.online))
    )
  })
  const stats = [
    ['Total users', users.length, 'users'],
    ['Admins', users.filter((u) => u.roles.includes('admin')).length, 'shield-halved'],
    ['Standard users', users.filter((u) => !u.roles.includes('admin')).length, 'pen-nib'],
    ['Connected', users.filter((u) => u.online).length, 'circle-check'],
  ]
  const row = (user: UserRecord, mobile = false) => (
    <div
      key={user.id}
      data-selected={selectedUserId === user.id || undefined}
      className={`${mobile ? 'admin-user-card' : 'admin-user-table-row'} data-[selected=true]:!bg-amber-400/[0.03] data-[selected=true]:shadow-[inset_2px_0_0_rgba(252,211,77,0.4)]`}
    >
      <button type="button" className="admin-user-person" onClick={() => onProfile(user)}>
        <span
          className="admin-user-banner"
          aria-hidden="true"
          style={user.bannerUrl ? { backgroundImage: `url(${user.bannerUrl})` } : undefined}
        />
        <span className="admin-user-avatar-wrap">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="admin-user-avatar-img" />
          ) : (
            <span className="admin-user-avatar-fallback">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <span className="min-w-0">
          <strong>{user.username}</strong>
          <small>
            {user.displayName || user.writerName || user.email || 'No profile name attached'}
          </small>
          {user.profileBio && <em>{user.profileBio}</em>}
        </span>
      </button>
      <span
        className={`admin-user-role role-${displayRole(user.roles).toLowerCase().replace(' ', '-')}`}
      >
        {displayRole(user.roles)}
      </span>
      <span
        className={`admin-user-status ${user.disabledAt ? 'is-disabled' : user.online ? 'is-online' : 'is-offline'}`}
      >
        <i />
        {user.disabledAt ? 'Disabled' : user.online ? 'Connected' : 'Offline'}
      </span>
      <span className="admin-user-last">{user.lastSeenAt ? ago(user.lastSeenAt) : 'Unknown'}</span>
      {!mobile && (
        <span className="admin-user-created">
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
        </span>
      )}
      <details className="admin-user-actions-menu">
        <summary aria-label={`Actions for ${user.username}`}>
          <Icon name="ellipsis" />
        </summary>
        <div className="admin-action-popover">
          <button onClick={() => onProfile(user)}>
            <Icon name="user" />
            View details
          </button>
          <label>
            <Icon name="user-gear" />
            <span>Change role</span>
            <Select
              value={displayRole(user.roles).toLowerCase().replace(' ', '_')}
              onChange={(value) => onRole(user, value)}
              ariaLabel={`Role for ${user.username}`}
              width={130}
              options={[
                { value: 'user', label: 'User' },
                { value: 'developer', label: 'Developer' },
                { value: 'beta_tester', label: 'Beta tester' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </label>
          {!user.roles.includes('admin') && (
            <>
              <button onClick={() => onDisable(user)}>
                <Icon name={user.disabledAt ? 'unlock' : 'ban'} />
                {user.disabledAt ? 'Restore account' : 'Disable account'}
              </button>
              <button className="danger" onClick={() => onDelete(user)}>
                <Icon name="trash" />
                Delete account
              </button>
            </>
          )}
        </div>
      </details>
    </div>
  )
  return (
    <div className="admin-users-page">
      <section className="admin-users-hero">
        <div className="admin-users-hero-overlay" />
        <div className="admin-users-hero-content">
          <span className="admin-kicker">Admin / Users</span>
          <h2>Users</h2>
          <p>Manage server accounts, roles, and access.</p>
          <label className="admin-users-search admin-users-search-hero">
            <Icon name="magnifying-glass" />
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search users, email, or role…"
              aria-label="Search users, email, or role"
            />
          </label>
        </div>
      </section>
      <div className="admin-users-stats">
        {stats.map(([label, value, icon]) => (
          <article key={label as string} className="admin-user-stat">
            <Icon name={icon as string} />
            <strong>{loading ? '—' : value}</strong>
            <span>{label}</span>
          </article>
        ))}
        <article className="admin-user-health">
          <span className="admin-health-dot-small" />
          <div>
            <strong>System healthy</strong>
            <span>All user services running</span>
          </div>
        </article>
      </div>
      <div className="admin-users-toolbar">
        <div className="admin-users-filters" role="tablist" aria-label="User filters">
          {[
            ['all', 'All users', users.length],
            ['admins', 'Admins', stats[1][1]],
            ['users', 'Users', stats[2][1]],
            ['connected', 'Connected', stats[3][1]],
          ].map(([key, label, count]) => (
            <button
              type="button"
              role="tab"
              aria-selected={filter === key}
              key={key}
              onClick={() => setFilter(key as string)}
            >
              {label}
              <b>{loading ? '—' : count}</b>
            </button>
          ))}
        </div>
        <label className="admin-users-search admin-users-search-toolbar">
          <Icon name="magnifying-glass" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search users…"
            aria-label="Search users"
          />
        </label>
      </div>
      <section className="admin-user-directory">
        <div className="admin-user-table-head">
          <span>User</span>
          <span>Role</span>
          <span>Status</span>
          <span>Last active</span>
          <span>Created</span>
          <span>Actions</span>
        </div>
        <div className="admin-user-table-body">
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div className="admin-user-skeleton" key={i}>
                <span />
                <span />
                <span />
              </div>
            ))
          ) : filtered.length ? (
            <>
              {filtered.map((user) => row(user))}
              <div className="admin-user-mobile-list">
                {filtered.map((user) => row(user, true))}
              </div>
            </>
          ) : (
            <div className="admin-users-empty">
              <Icon name="users-slash" />
              <strong>No users found</strong>
              <span>Try changing your search or filters.</span>
            </div>
          )}
        </div>
        <footer className="admin-users-footer">
          <span>
            Showing {filtered.length ? 1 : 0}–{filtered.length} of {users.length} users
          </span>
          <span className="admin-users-pagination">
            <button disabled aria-label="Previous page">
              <Icon name="chevron-left" />
            </button>
            <b>1</b>
            <button disabled aria-label="Next page">
              <Icon name="chevron-right" />
            </button>
          </span>
        </footer>
      </section>
    </div>
  )
}

type AuditEvent = {
  id: number
  actor: string
  action: string
  target?: string
  detail: string
  createdAt: number
}
export function AdminAuditPage({
  events,
  users = [],
  loading = false,
}: {
  events: AuditEvent[]
  users?: Array<{ username: string; avatarUrl?: string }>
  loading?: boolean
}) {
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('all')
  const [actor, setActor] = useState('all')
  const [range, setRange] = useState('30d')
  const [selected, setSelected] = useState<AuditEvent | null>(null)
  const [page, setPage] = useState(1)
  const actions = useMemo(() => [...new Set(events.map((e) => e.action))], [events])
  const actors = useMemo(() => [...new Set(events.map((e) => e.actor))], [events])
  const filtered = useMemo(() => {
    const now = Date.now()
    const cutoff =
      range === '24h'
        ? now - 86400000
        : range === '7d'
          ? now - 604800000
          : range === '30d'
            ? now - 2592000000
            : 0
    const q = query.trim().toLowerCase()
    return events.filter(
      (e) =>
        (!q || `${e.actor} ${e.action} ${e.target || ''} ${e.detail}`.toLowerCase().includes(q)) &&
        (action === 'all' || e.action === action) &&
        (actor === 'all' || e.actor === actor) &&
        e.createdAt >= cutoff
    )
  }, [events, query, action, actor, range])
  const stats = useMemo(
    () => ({
      total: events.length,
      actors: new Set(events.map((e) => e.actor)).size,
      actions: new Set(events.map((e) => e.action)).size,
      day: events.filter((e) => e.createdAt >= Date.now() - 86400000).length,
    }),
    [events]
  )
  const pageSize = 10
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const label = (value: string) =>
    value
      .split(/[._-]/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ')
  const icon = (value: string) =>
    value.includes('delete')
      ? ['trash', 'text-red-300']
      : value.includes('login')
        ? ['right-to-bracket', 'text-emerald-300']
        : value.includes('disable')
          ? ['ban', 'text-orange-300']
          : value.includes('role')
            ? ['shield-halved', 'text-primary']
            : value.includes('create')
              ? ['plus', 'text-emerald-300']
              : ['circle-info', 'text-sky-300']
  const avatar = (name: string) => users.find((u) => u.username === name)?.avatarUrl
  return (
    <div className="admin-audit-modern">
      <section
        className="audit-hero"
        style={{ backgroundImage: "url('/assets/moonscribebackground.png')" }}
      >
        <div className="audit-hero-overlay" />
        <div className="relative z-10">
          <span className="admin-kicker">MoonScribe control room / Audit log</span>
          <h2>Audit log</h2>
          <p>Track administrative actions from the account service.</p>
        </div>
      </section>
      <div className="audit-stats">
        {[
          ['file-lines', stats.total, 'Loaded events'],
          ['users', stats.actors, 'Unique actors'],
          ['bolt', stats.actions, 'Action types'],
          ['clock', stats.day, 'Last 24h'],
        ].map(([ic, value, text]) => (
          <div className="audit-stat" key={String(text)}>
            <span>
              <Icon name={String(ic)} />
            </span>
            <strong>{loading ? '…' : value}</strong>
            <small>{text}</small>
          </div>
        ))}
      </div>
      <div className="audit-toolbar">
        <label className="audit-search">
          <Icon name="magnifying-glass" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Search actor, action, or details..."
            aria-label="Search audit events"
          />
        </label>
        <Select
          value={action}
          onChange={(value) => {
            setAction(value)
            setPage(1)
          }}
          aria-label="Filter actions"
          options={[{ value: 'all', label: 'All actions' }, ...actions.map((a) => ({ value: a, label: label(a) }))]}
        />
        <Select
          value={actor}
          onChange={(value) => {
            setActor(value)
            setPage(1)
          }}
          aria-label="Filter actors"
          options={[{ value: 'all', label: 'All users' }, ...actors.map((a) => ({ value: a, label: a }))]}
        />
        <Select
          value={range}
          onChange={(value) => {
            setRange(value)
            setPage(1)
          }}
          aria-label="Filter date range"
          options={[
            { value: '24h', label: 'Last 24 hours' },
            { value: '7d', label: 'Last 7 days' },
            { value: '30d', label: 'Last 30 days' },
            { value: 'all', label: 'All time' },
          ]}
        />
      </div>
      <section className="audit-table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Details</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((event) => {
              const [ic, color] = icon(event.action)
              return (
                <tr
                  key={event.id}
                  onClick={() => setSelected(event)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelected(event)}
                >
                  <td>
                    <b>{new Date(event.createdAt).toLocaleDateString()}</b>
                    <small>{new Date(event.createdAt).toLocaleTimeString()}</small>
                  </td>
                  <td>
                    <span className="audit-actor">
                      <span className="audit-avatar">
                        {avatar(event.actor) ? (
                          <img src={avatar(event.actor)} alt="" />
                        ) : (
                          event.actor[0]?.toUpperCase()
                        )}
                      </span>
                      <span>
                        {event.actor}
                        <small>{event.actor === 'system' ? 'System' : 'Administrator'}</small>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className={`audit-action ${color}`}>
                      <Icon name={ic} />
                      {label(event.action)}
                    </span>
                  </td>
                  <td>{event.target || '—'}</td>
                  <td className="audit-detail">{event.detail || '—'}</td>
                  <td>
                    <button
                      type="button"
                      aria-label={`View event ${event.id}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(event)
                      }}
                    >
                      •••
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && !rows.length && (
          <div className="audit-empty">
            <Icon name="file-circle-question" />
            <strong>{events.length ? 'No matching events' : 'No audit events yet'}</strong>
            <span>
              {events.length
                ? 'Try changing your search or filters.'
                : 'Administrative activity will appear here as actions are recorded.'}
            </span>
          </div>
        )}
        <footer className="audit-footer">
          <span>
            Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–
            {Math.min(page * pageSize, filtered.length)} of {filtered.length} loaded events
          </span>
          <span>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ‹
            </button>
            <b>{page}</b>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              ›
            </button>
          </span>
        </footer>
      </section>
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent
          data-audit-inspector="true"
          className="audit-inspector bg-[#0a0b0d] text-[#f2ede4]"
        >
          <SheetTitle className="font-heading text-3xl">
            {selected ? label(selected.action) : 'Audit event'}
          </SheetTitle>
          <SheetDescription>
            {selected && new Date(selected.createdAt).toLocaleString()}
          </SheetDescription>
          {selected && (
            <div className="audit-inspector-body">
              <b>Actor</b>
              <p>{selected.actor}</p>
              <b>Target</b>
              <p>{selected.target || '—'}</p>
              <b>Details</b>
              <p>{selected.detail || '—'}</p>
              <b>Event ID</b>
              <p>{selected.id}</p>
              <button
                type="button"
                className="button button-quiet"
                onClick={() => navigator.clipboard?.writeText(String(selected.id))}
              >
                Copy event ID
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
