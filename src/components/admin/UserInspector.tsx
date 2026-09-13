import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import Select from '../Select'

export type InspectorUser = {
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
  emailVerified?: boolean
  twoFactorEnabled?: boolean
  online?: boolean
  lastSeenAt?: number | null
}
const heading = '!text-[10px] !font-medium uppercase !tracking-[0.22em] !text-amber-200/60'
const button =
  '!min-h-11 !rounded-lg !border !border-white/10 !bg-white/[0.03] !px-4 !text-sm !text-white/80 transition hover:!bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-amber-200 disabled:opacity-40'
function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'gold' | 'green' | 'red'
}) {
  const colors = {
    neutral: 'bg-white/5 text-white/60',
    gold: 'bg-amber-300/10 text-amber-200',
    green: 'bg-emerald-400/10 text-emerald-300',
    red: 'bg-red-400/10 text-red-300',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${colors[tone]}`}
    >
      {children}
    </span>
  )
}
const date = (value?: number | null) => (value ? new Date(value).toLocaleString() : 'Unknown')
function relative(value?: number | null) {
  if (!value) return 'Unknown'
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60000))
  if (minutes < 1) return 'Just now'
  const [amount, unit] =
    minutes < 60
      ? [minutes, 'minute']
      : minutes < 1440
        ? [Math.floor(minutes / 60), 'hour']
        : [Math.floor(minutes / 1440), 'day']
  return `${amount} ${unit}${amount === 1 ? '' : 's'} ago`
}
export default function UserInspector({
  user,
  onClose,
  onRole,
  onDisable,
  onDelete,
}: {
  user: InspectorUser
  onClose: () => void
  onRole: (value: string) => Promise<void>
  onDisable: () => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const change = () => setCompact(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch {
      setError('The account could not be updated. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const role =
    ['admin', 'developer', 'beta_tester'].find((value) => user.roles.includes(value)) || 'user'
  const content = (
    <>
      <div className="relative overflow-hidden border-b border-white/[0.06] p-5 sm:p-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-cover bg-center opacity-60"
          style={
            user.bannerUrl
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(10,11,14,.25), rgba(10,11,14,.95)), url(${user.bannerUrl})`,
                }
              : undefined
          }
          aria-hidden="true"
        />
        <div className="mb-5 flex items-center justify-between gap-4">
          <span className={heading}>User information</span>
          <button
            autoFocus={!compact}
            type="button"
            onClick={onClose}
            aria-label="Close user inspector"
            className="flex !h-8 !w-8 shrink-0 items-center justify-center !rounded-full !border-0 !bg-transparent max-sm:!h-11 max-sm:!w-11 text-xl !text-white/40 hover:!bg-white/5 focus-visible:outline-2 focus-visible:outline-amber-200"
          >
            ×
          </button>
        </div>
        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-300/25 bg-amber-400/5 text-lg text-amber-100">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              user.username.slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="m-0 break-words !text-lg !font-medium !text-[#f2ede4]">
              {user.username}
            </h3>
            <p className="mt-1 break-all text-sm text-white/45">
              {user.email || 'No email attached'}
            </p>
            {(user.displayName || user.writerName || user.profileBio) && (
              <p className="mt-2 text-xs text-white/55">
                {user.displayName || user.writerName || user.profileBio}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={role === 'admin' ? 'gold' : 'neutral'}>
                {role === 'beta_tester'
                  ? 'Beta tester'
                  : role.charAt(0).toUpperCase() + role.slice(1)}
              </Badge>
              <Badge tone={user.online ? 'green' : 'neutral'}>
                ● {user.online ? 'Connected' : 'Offline'}
              </Badge>
              {!!user.disabledAt && <Badge tone="red">Disabled</Badge>}
            </div>
            <p className="mt-3 text-xs text-white/40">
              Last active{' '}
              <time title={date(user.lastSeenAt)}>
                {user.online ? 'Now' : relative(user.lastSeenAt)}
              </time>
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-7 p-5 sm:p-6 lg:grid-cols-2 lg:gap-10">
        <section className="min-w-0">
          <h4 className={heading}>Account overview</h4>
          <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-5 min-[380px]:grid-cols-2">
            {[
              ['User ID', user.id],
              ['Created', date(user.createdAt)],
              ['Last active', date(user.lastSeenAt)],
              ['All roles', user.roles.join(', ') || 'None'],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-white/35">{label}</dt>
                <dd
                  className={`m-0 mt-1.5 break-words text-sm text-white/80 ${label === 'User ID' ? 'font-mono text-xs' : ''}`}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="min-w-0">
          <h4 className={heading}>Security &amp; access</h4>
          <dl className="mt-2">
            {[
              [
                'Email verification',
                <Badge tone={user.emailVerified ? 'green' : 'gold'}>
                  {user.emailVerified ? 'Verified' : 'Not verified'}
                </Badge>,
              ],
              [
                'Two-factor authentication',
                <Badge tone={user.twoFactorEnabled ? 'green' : 'neutral'}>
                  {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </Badge>,
              ],
              [
                'Account state',
                <Badge tone={user.disabledAt ? 'red' : 'green'}>
                  {user.disabledAt ? 'Disabled' : 'Active'}
                </Badge>,
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2.5"
              >
                <dt className="text-sm text-white/50">{label}</dt>
                <dd className="m-0 shrink-0">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <footer className="border-t border-white/[0.06] bg-white/[0.015] p-5 sm:p-6">
        <h4 className={heading}>Admin actions</h4>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <label className="flex flex-col gap-2 text-xs text-white/50">
            Change role
            <Select
              aria-label={`Role for ${user.username}`}
              value={role}
              disabled={busy}
              onChange={(value) => void run(() => onRole(value))}
              className={`${button} min-w-40 !bg-[#141519]`}
              options={[
                { value: 'user', label: 'User' },
                { value: 'developer', label: 'Developer' },
                { value: 'beta_tester', label: 'Beta tester' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </label>
          {!user.roles.includes('admin') ? (
            <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4 lg:border-t-0 lg:pt-0">
              <button disabled={busy} className={button} onClick={() => void run(onDisable)}>
                {user.disabledAt ? 'Restore account' : 'Disable account'}
              </button>
              <button
                disabled={busy}
                className="!min-h-11 !rounded-lg !border !border-red-400/20 !bg-red-400/5 !px-4 !text-sm !text-red-300 hover:!bg-red-400/10 focus-visible:outline-2 focus-visible:outline-red-300 disabled:opacity-40"
                onClick={() => void run(onDelete)}
              >
                Delete account
              </button>
            </div>
          ) : (
            <p className="text-xs text-white/35">
              Administrator accounts are protected from disabling and deletion.
            </p>
          )}
        </div>
        {busy && (
          <p role="status" className="mt-3 text-xs text-amber-200/70">
            Updating account…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </footer>
    </>
  )
  const surface =
    '[font-family:Inter,sans-serif] [color-scheme:dark] overflow-hidden border border-white/[0.08] bg-[#0b0c0f] text-white shadow-[0_18px_50px_rgba(0,0,0,0.3)]'
  return compact ? (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className={`${surface} fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl pb-[env(safe-area-inset-bottom)] focus:outline-none sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-[460px] sm:rounded-none sm:rounded-l-2xl`}
        >
          <Dialog.Title className="sr-only">User details for {user.username}</Dialog.Title>
          {content}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  ) : (
    <section
      aria-label={`Profile for ${user.username}`}
      className={`${surface} mt-5 w-full rounded-2xl`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      {content}
    </section>
  )
}
