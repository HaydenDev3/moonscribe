import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { apiBaseUrl } from '../api/config'
import Icon from './Icon'
import { exportBackup } from '../db/backup'
import { downloadBlob } from '../utils/download'

const APP_LOGO = '/moonscribelogo.png'

// ─────────────────────────────────────────────────────────────────────────────
// Provider icons
// ─────────────────────────────────────────────────────────────────────────────

function DiscordLogo({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M19.54 5.34A17.3 17.3 0 0 0 15.34 4l-.52 1.05a16.1 16.1 0 0 0-5.62 0L8.66 4a17.2 17.2 0 0 0-4.2 1.34C1.8 9.3 1.08 13.16 1.44 16.96a17 17 0 0 0 5.15 2.6l1.24-1.7a10.9 10.9 0 0 1-1.95-.94l.48-.37c3.76 1.74 7.84 1.74 11.56 0l.48.37c-.63.37-1.28.68-1.96.94l1.24 1.7a17 17 0 0 0 5.15-2.6c.42-4.4-.72-8.22-3.29-11.62ZM8.5 14.62c-1.13 0-2.06-1.04-2.06-2.32 0-1.28.9-2.32 2.06-2.32 1.16 0 2.09 1.05 2.06 2.32 0 1.28-.9 2.32-2.06 2.32Zm7 0c-1.13 0-2.06-1.04-2.06-2.32 0-1.28.9-2.32 2.06-2.32 1.16 0 2.09 1.05 2.06 2.32 0 1.28-.9 2.32-2.06 2.32Z"
      />
    </svg>
  )
}

function GoogleLogo({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12V14h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.5 14.1A6 6 0 0 1 6.2 12c0-.7.1-1.4.3-2.1V7.3H3.2A10 10 0 0 0 2 12c0 1.7.4 3.3 1.2 4.7l3.3-2.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.8 5.3l3.3 2.6A5.8 5.8 0 0 1 12 5.9Z"
      />
    </svg>
  )
}

function MicrosoftLogo({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path fill="#F25022" d="M2 2h9v9H2z" />
      <path fill="#7FBA00" d="M13 2h9v9h-9z" />
      <path fill="#00A4EF" d="M2 13h9v9H2z" />
      <path fill="#FFB900" d="M13 13h9v9h-9z" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI
// ─────────────────────────────────────────────────────────────────────────────

function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close sign in"
      title="Close"
      className="
        group flex h-10 w-10 shrink-0
        items-center justify-center
        rounded-full
        border border-white/[0.10]
        bg-white/[0.025]
        text-zinc-500
        transition-all duration-200
        hover:border-white/[0.18]
        hover:bg-white/[0.07]
        hover:text-white
        active:scale-95
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-amber-500/40
      "
    >
      <span className="transition-transform duration-200 group-hover:rotate-90">
        <Icon icon="fa-solid fa-xmark" />
      </span>
    </button>
  )
}

function BrandMark() {
  return (
    <div className="
      flex items-center justify-center
      gap-2
      text-[7px] sm:text-[8px]
      font-semibold uppercase
      tracking-[0.28em]
      text-amber-500/80
    ">
      <span className="hidden sm:block h-px w-8 bg-gradient-to-r from-transparent to-amber-500/40" />
      <span>✦</span>
      <span className="text-[11px]">☾</span>
      <span>MoonScribe</span>
      <span>✦</span>
      <span className="hidden sm:block h-px w-8 bg-gradient-to-l from-transparent to-amber-500/40" />
    </div>
  )
}

function OAuthButton({
  provider,
  title,
  subtitle,
  icon,
  onClick,
  disabled = false,
}) {
  const isDiscord = provider === 'discord'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        group relative flex w-full items-center
        overflow-hidden
        min-h-[76px] sm:min-h-[86px] lg:min-h-[96px]
        rounded-[20px] sm:rounded-[22px]
        border
        bg-[#0d0d12]
        transition-all duration-200
        hover:-translate-y-[1px]
        active:translate-y-0
        disabled:pointer-events-none
        disabled:opacity-50
        ${
          isDiscord
            ? 'border-indigo-400/15 hover:border-indigo-400/35 hover:shadow-[0_16px_50px_rgba(88,101,242,0.10)]'
            : 'border-white/[0.07] hover:border-white/[0.14]'
        }
      `}
    >
      <div
        className={`
          flex h-full
          w-[76px] sm:w-[90px]
          shrink-0
          items-center justify-center
          border-r border-white/[0.07]
          ${isDiscord ? 'bg-indigo-500/[0.045]' : 'bg-white/[0.012]'}
        `}
      >
        <span
          className={`
            flex h-11 w-11
            sm:h-12 sm:w-12
            items-center justify-center
            rounded-[14px]
            ${
              isDiscord
                ? 'bg-[#5865F2] text-white shadow-[0_10px_28px_rgba(88,101,242,0.25)]'
                : 'bg-white shadow-[0_10px_28px_rgba(0,0,0,0.22)]'
            }
          `}
        >
          {icon}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-start px-4 sm:px-5">
        <span className="
          font-serif
          text-[17px] sm:text-[21px]
          font-semibold
          tracking-[-0.02em]
          text-[#f3efe7]
        ">
          {title}
        </span>

        {subtitle && (
          <span className="mt-1 text-[9px] sm:text-[10px] text-zinc-600">
            {subtitle}
          </span>
        )}
      </div>

      <span className="
        mr-3 sm:mr-4
        flex h-9 w-9 shrink-0
        items-center justify-center
        rounded-full
        bg-white/[0.05]
        text-xs text-zinc-500
        transition-all duration-200
        group-hover:translate-x-1
        group-hover:bg-white/[0.09]
        group-hover:text-white
      ">
        <Icon icon="fa-solid fa-arrow-right" />
      </span>
    </button>
  )
}

function AuthMethodButton({
  icon,
  title,
  description,
  onClick,
  disabled = false,
  badge = null,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="
        group flex w-full items-center
        gap-3 rounded-[16px]
        border border-white/[0.07]
        bg-white/[0.018]
        px-3.5 py-3
        text-left
        transition-all duration-180
        hover:border-white/[0.13]
        hover:bg-white/[0.035]
        disabled:pointer-events-none
        disabled:opacity-45
      "
    >
      <span className="
        flex h-10 w-10 shrink-0
        items-center justify-center
        rounded-[13px]
        border border-white/[0.07]
        bg-white/[0.035]
        text-zinc-300
        transition
        group-hover:bg-white/[0.06]
        group-hover:text-white
      ">
        <Icon icon={icon} />
      </span>

      <span className="min-w-0 flex-1">
        <strong className="block text-[11px] sm:text-[12px] font-semibold text-zinc-300">
          {title}
        </strong>

        <small className="mt-0.5 block text-[8px] sm:text-[9px] text-zinc-600">
          {description}
        </small>
      </span>

      {badge ? (
        <span className="
          rounded-full
          border border-white/[0.07]
          bg-white/[0.025]
          px-2 py-1
          text-[7px]
          font-bold uppercase
          tracking-[0.12em]
          text-zinc-600
        ">
          {badge}
        </span>
      ) : (
        <span className="
          flex h-8 w-8 items-center justify-center
          rounded-full
          bg-white/[0.035]
          text-[10px] text-zinc-600
          transition
          group-hover:text-zinc-300
        ">
          <Icon icon="fa-solid fa-chevron-right" />
        </span>
      )}
    </button>
  )
}

function FutureProvider({
  icon,
  name,
  description,
}) {
  return (
    <div className="
      flex items-center gap-3
      rounded-[14px]
      border border-white/[0.05]
      bg-white/[0.01]
      px-3 py-2.5
      opacity-45
    ">
      <span className="
        flex h-9 w-9 shrink-0
        items-center justify-center
        rounded-xl
        border border-white/[0.06]
        bg-white/[0.025]
        text-zinc-400
      ">
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[10px] sm:text-[11px] text-zinc-400">
          {name}
        </strong>

        <small className="block truncate text-[8px] text-zinc-700">
          {description}
        </small>
      </span>

      <span className="
        rounded-full border border-white/[0.05]
        px-2 py-0.5
        text-[6px] uppercase
        tracking-[0.15em]
        text-zinc-700
      ">
        Soon
      </span>
    </div>
  )
}

function AuthInput({
  label,
  icon,
  ...props
}) {
  return (
    <label className="block space-y-1.5">
      <span className="
        text-[8px] font-semibold uppercase
        tracking-[0.15em]
        text-zinc-600
      ">
        {label}
      </span>

      <div className="
        flex h-11 items-center gap-3
        rounded-xl
        border border-white/[0.08]
        bg-black/20
        px-3
        transition
        focus-within:border-amber-400/35
        focus-within:ring-4
        focus-within:ring-amber-500/[0.06]
      ">
        <span className="text-xs text-zinc-600">
          <Icon icon={icon} />
        </span>

        <input
          {...props}
          className="
            min-w-0 flex-1
            bg-transparent
            text-sm text-zinc-200
            outline-none
            placeholder:text-zinc-700
          "
        />
      </div>
    </label>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function AuthModal({
  open,
  onClose,
}) {
  const app = useApp()

  const {
    syncServer,
    syncUsername,
    syncStatus,
    syncDiscordAvatar,
    syncProvider,

    connectDiscord,
    connectGoogle,
    connectSync,
    disconnectSync,

    signOutOtherDevices,
    toast,
  } = app

  // Optional new auth functions.
  // Add these to AppContext when backend implementation is ready.
  const sendMagicLink = app.sendMagicLink
  const signInWithPasskey = app.signInWithPasskey

  const [view, setView] = useState('main')
  // main | password | magic | magic-sent

  const [mode, setMode] = useState('login')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [magicEmail, setMagicEmail] = useState('')
  const [sentMagicEmail, setSentMagicEmail] = useState('')
  const [resetEmail, setResetEmail] = useState('')

  const [busy, setBusy] = useState(false)
  const [busyProvider, setBusyProvider] = useState(null)

  const [libraryConflict, setLibraryConflict] = useState(false)

  const connected = Boolean(syncUsername)

  const providerName = useMemo(() => {
    switch (syncProvider) {
      case 'discord':
        return 'Discord'

      case 'google':
        return 'Google'

      case 'passkey':
        return 'Passkey'

      case 'magic':
      case 'email':
        return 'MoonScribe'

      default:
        return 'MoonScribe'
    }
  }, [syncProvider])

  // ───────────────────────────────────────────────────────────────────────────
  // Body lock / escape
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (view !== 'main') {
          setView('main')
        } else {
          onClose?.()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose, view])

  useEffect(() => {
    if (!open) {
      setView('main')
      setLibraryConflict(false)
      setBusy(false)
      setBusyProvider(null)
    }
  }, [open])

  // ───────────────────────────────────────────────────────────────────────────
  // Discord
  // ───────────────────────────────────────────────────────────────────────────

  const handleDiscord = async () => {
    if (!connectDiscord) {
      toast?.('Discord sign in is not available yet.')
      return
    }

    setBusy(true)
    setBusyProvider('discord')

    try {
      await connectDiscord()
    } catch (error) {
      toast?.(
        error?.message ||
        'Discord sign in could not be started.',
      )
    } finally {
      setBusy(false)
      setBusyProvider(null)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Google
  // ───────────────────────────────────────────────────────────────────────────

  const handleGoogle = async () => {
    if (!connectGoogle) {
      toast?.('Google sign in is not available yet.')
      return
    }

    setBusy(true)
    setBusyProvider('google')

    try {
      await connectGoogle()
    } catch (error) {
      toast?.(
        error?.message ||
        'Google sign in could not be started.',
      )
    } finally {
      setBusy(false)
      setBusyProvider(null)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Passkey
  // ───────────────────────────────────────────────────────────────────────────

  const handlePasskey = async () => {
    if (!window.PublicKeyCredential) {
      toast?.(
        'Passkeys are not supported by this browser or device.',
      )
      return
    }

    if (typeof signInWithPasskey !== 'function') {
      toast?.(
        'Passkey support is not connected to MoonScribe yet.',
      )
      return
    }

    setBusy(true)
    setBusyProvider('passkey')

    try {
      const result = await signInWithPasskey()

      if (result?.ok === false) {
        throw new Error(
          result.error ||
          'Passkey sign in failed.',
        )
      }

      toast?.('Welcome back.')
      onClose?.()
    } catch (error) {
      if (error?.name === 'NotAllowedError') {
        toast?.('Passkey sign in was cancelled.')
      } else {
        toast?.(
          error?.message ||
          'Could not sign in with your passkey.',
        )
      }
    } finally {
      setBusy(false)
      setBusyProvider(null)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Magic link
  // ───────────────────────────────────────────────────────────────────────────

  const handleMagicLink = async (event) => {
    event.preventDefault()

    const email = magicEmail.trim()

    if (!email) {
      toast?.('Enter your email address first.')
      return
    }

    if (typeof sendMagicLink !== 'function') {
      toast?.(
        'Magic Link is not connected to the MoonScribe backend yet.',
      )
      return
    }

    setBusy(true)
    setBusyProvider('magic')

    try {
      const result = await sendMagicLink(email)

      if (result?.ok === false) {
        throw new Error(
          result.error ||
          'Could not send your sign-in link.',
        )
      }

      setSentMagicEmail(email)
      setView('magic-sent')
    } catch (error) {
      toast?.(
        error?.message ||
        'Could not send your sign-in link.',
      )
    } finally {
      setBusy(false)
      setBusyProvider(null)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Password / native auth
  // ───────────────────────────────────────────────────────────────────────────

  const nativeAuth = async (event) => {
    event.preventDefault()

    setBusy(true)
    setBusyProvider('password')

    try {
      const result = await connectSync({
        url: apiBaseUrl(),
        mode,
        username,
        password,
      })

      if (result.ok) {
        setLibraryConflict(false)

        toast?.(
          mode === 'register'
            ? 'MoonScribe account created.'
            : 'Welcome back.',
        )

        onClose?.()
        return
      }

      if (result.code === 'LIBRARY_OWNER_CONFLICT') {
        setLibraryConflict(true)
        return
      }

      toast?.(
        result.error ||
        'Could not sign in.',
      )
    } catch (error) {
      toast?.(
        error?.message ||
        'Could not sign in.',
      )
    } finally {
      setBusy(false)
      setBusyProvider(null)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Local library conflict
  // ───────────────────────────────────────────────────────────────────────────

  const switchLibrary = async () => {
    setBusy(true)

    try {
      const backup = await exportBackup()

      downloadBlob(
        new Blob(
          [JSON.stringify(backup, null, 2)],
          {
            type: 'application/json',
          },
        ),
        `moonscribe-browser-library-${new Date()
          .toISOString()
          .slice(0, 10)}.json`,
      )

      const result = await connectSync({
        url: apiBaseUrl(),
        mode,
        username,
        password,
        replaceLocal: true,
      })

      if (!result.ok) {
        throw new Error(result.error)
      }

      setLibraryConflict(false)

      toast?.(
        'Signed in. Your previous browser library was backed up and your cloud library is loading.',
      )

      onClose?.()
    } catch (error) {
      toast?.(
        error?.message ||
        'Could not switch libraries safely.',
      )
    } finally {
      setBusy(false)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Disconnect
  // ───────────────────────────────────────────────────────────────────────────

  const disconnect = async () => {
    try {
      await disconnectSync()

      toast?.(
        'Signed out. Everything is still safe on this device.',
      )

      onClose?.()
    } catch (error) {
      toast?.(
        error?.message ||
        'Could not sign out.',
      )
    }
  }

  if (!open) return null

  // ───────────────────────────────────────────────────────────────────────────
  // Connected account
  // ───────────────────────────────────────────────────────────────────────────

  const renderConnected = () => {
    return (
      <div className="
        relative z-10
        flex-1 min-h-0
        overflow-y-auto

        lg:grid
        lg:grid-cols-[1.12fr_0.88fr]
        lg:overflow-hidden
      ">
        <section className="
          px-4 py-5
          sm:px-6 sm:py-6

          lg:min-h-0
          lg:overflow-y-auto
          lg:border-r
          lg:border-white/[0.07]
          lg:px-8
          lg:py-7
        ">
          <div className="mx-auto max-w-[650px]">
            <div className="
              rounded-[22px]
              border border-white/[0.08]
              bg-white/[0.022]
              p-4 sm:p-5
            ">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  {syncDiscordAvatar ? (
                    <img
                      src={syncDiscordAvatar}
                      alt=""
                      className="
                        h-14 w-14
                        sm:h-16 sm:w-16
                        rounded-2xl
                        object-cover
                        ring-1 ring-white/10
                      "
                    />
                  ) : (
                    <div className="
                      flex h-14 w-14
                      sm:h-16 sm:w-16
                      items-center justify-center
                      rounded-2xl
                      bg-gradient-to-br
                      from-indigo-500
                      to-violet-700
                      font-serif
                      text-xl
                      text-white
                    ">
                      {(syncUsername || '?')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}

                  <span className="
                    absolute -bottom-1 -right-1
                    flex h-7 w-7
                    items-center justify-center
                    rounded-lg
                    border-2 border-[#0b0b0f]
                    bg-[#17171d]
                  ">
                    {syncProvider === 'discord' ? (
                      <span className="text-indigo-400">
                        <DiscordLogo size={14} />
                      </span>
                    ) : syncProvider === 'google' ? (
                      <GoogleLogo size={14} />
                    ) : syncProvider === 'passkey' ? (
                      <Icon icon="fa-solid fa-fingerprint" />
                    ) : (
                      <Icon icon="fa-solid fa-feather-pointed" />
                    )}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <span className="
                    text-[8px]
                    font-semibold uppercase
                    tracking-[0.18em]
                    text-amber-500/70
                  ">
                    MoonScribe account
                  </span>

                  <strong className="
                    mt-1 block truncate
                    font-serif
                    text-xl
                    text-[#f3efe7]
                  ">
                    {syncUsername}
                  </strong>

                  <span className="mt-1 block text-[10px] text-zinc-600">
                    Signed in with {providerName}
                  </span>
                </div>

                <div className="
                  hidden sm:flex
                  items-center gap-2
                  rounded-full
                  border border-white/[0.07]
                  bg-black/20
                  px-3 py-1.5
                  text-[9px]
                  text-zinc-500
                ">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      syncStatus === 'synced'
                        ? 'bg-emerald-400'
                        : syncStatus === 'error'
                          ? 'bg-rose-400'
                          : 'bg-amber-400'
                    }`}
                  />

                  {syncStatus === 'synced'
                    ? 'Synced'
                    : syncStatus === 'error'
                      ? 'Sync issue'
                      : 'Offline'}
                </div>
              </div>

              {syncServer && (
                <div className="
                  mt-4
                  border-t border-white/[0.06]
                  pt-3
                  text-[9px]
                  text-zinc-700
                ">
                  {syncServer.replace(/^https?:\/\//, '')}
                </div>
              )}
            </div>

            <div className="mt-7">
              <div>
                <strong className="text-sm text-zinc-300">
                  Your sign-in
                </strong>

                <p className="mt-1 text-[10px] text-zinc-600">
                  MoonScribe keeps your library attached to your account,
                  regardless of which connected sign-in method you use.
                </p>
              </div>

              <div className="mt-4 space-y-2.5">
                <div className="
                  flex items-center gap-3
                  rounded-2xl
                  border border-white/[0.07]
                  bg-white/[0.015]
                  p-3.5
                ">
                  <span className="
                    flex h-10 w-10
                    items-center justify-center
                    rounded-xl
                    bg-white/[0.035]
                  ">
                    {syncProvider === 'discord' ? (
                      <span className="text-indigo-400">
                        <DiscordLogo size={19} />
                      </span>
                    ) : syncProvider === 'google' ? (
                      <GoogleLogo size={19} />
                    ) : syncProvider === 'passkey' ? (
                      <Icon icon="fa-solid fa-fingerprint" />
                    ) : (
                      <Icon icon="fa-regular fa-envelope" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <strong className="block text-[11px] text-zinc-300">
                      {providerName}
                    </strong>

                    <small className="block truncate text-[8px] text-zinc-600">
                      Current sign-in method
                    </small>
                  </div>

                  <span className="
                    rounded-full
                    bg-emerald-500/10
                    px-2 py-1
                    text-[7px]
                    uppercase
                    tracking-wider
                    text-emerald-400
                  ">
                    Connected
                  </span>
                </div>

                <div className="
                  flex items-center gap-3
                  rounded-2xl
                  border border-white/[0.07]
                  bg-white/[0.015]
                  p-3.5
                ">
                  <span className="
                    flex h-10 w-10
                    items-center justify-center
                    rounded-xl
                    bg-indigo-500/10
                    text-indigo-300
                  ">
                    <Icon icon="fa-solid fa-cloud-arrow-up" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <strong className="block text-[11px] text-zinc-300">
                      MoonScribe Sync
                    </strong>

                    <small className="block text-[8px] text-zinc-600">
                      Novels, settings and writing data across devices
                    </small>
                  </div>

                  <span className="
                    rounded-full
                    bg-indigo-500/10
                    px-2 py-1
                    text-[7px]
                    uppercase
                    tracking-wider
                    text-indigo-300
                  ">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="
          border-t border-white/[0.07]
          bg-white/[0.008]
          px-4 py-5
          sm:px-6

          lg:min-h-0
          lg:overflow-y-auto
          lg:border-t-0
          lg:px-7
          lg:py-7
        ">
          <strong className="text-sm text-zinc-300">
            Session & security
          </strong>

          <p className="mt-1 text-[10px] text-zinc-600">
            Control active MoonScribe sessions.
          </p>

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() =>
                signOutOtherDevices()
                  .then(() =>
                    toast?.(
                      'Other sessions have been signed out.',
                    ),
                  )
                  .catch((error) =>
                    toast?.(error.message),
                  )
              }
              className="
                flex w-full items-center gap-3
                rounded-2xl
                border border-white/[0.07]
                bg-white/[0.015]
                px-4 py-4
                text-left
                transition
                hover:bg-white/[0.035]
              "
            >
              <span className="
                flex h-10 w-10
                items-center justify-center
                rounded-xl
                bg-white/[0.035]
                text-zinc-500
              ">
                <Icon icon="fa-solid fa-laptop" />
              </span>

              <span>
                <strong className="block text-[11px] text-zinc-300">
                  Sign out other devices
                </strong>

                <small className="mt-1 block text-[8px] text-zinc-600">
                  Keep this device signed in.
                </small>
              </span>
            </button>

            <button
              type="button"
              onClick={disconnect}
              className="
                flex w-full items-center gap-3
                rounded-2xl
                border border-rose-400/10
                bg-rose-500/[0.025]
                px-4 py-4
                text-left
                transition
                hover:bg-rose-500/[0.06]
              "
            >
              <span className="
                flex h-10 w-10
                items-center justify-center
                rounded-xl
                bg-rose-500/10
                text-rose-400
              ">
                <Icon icon="fa-solid fa-arrow-right-from-bracket" />
              </span>

              <span>
                <strong className="block text-[11px] text-rose-300">
                  Sign out
                </strong>

                <small className="mt-1 block text-[8px] text-rose-400/50">
                  Local writing remains on this device.
                </small>
              </span>
            </button>
          </div>
        </aside>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Main login view
  // ───────────────────────────────────────────────────────────────────────────

  const renderMain = () => {
    return (
      <>
        <div>
          <span className="
            text-[8px]
            font-semibold uppercase
            tracking-[0.24em]
            text-zinc-600
          ">
            Sign in to MoonScribe
          </span>

          <div className="mt-4 space-y-3">
            <OAuthButton
              provider="discord"
              title={
                busyProvider === 'discord'
                  ? 'Opening Discord…'
                  : 'Continue with Discord'
              }
              subtitle="Use your Discord identity"
              icon={<DiscordLogo size={27} />}
              onClick={handleDiscord}
              disabled={busy}
            />

            <OAuthButton
              provider="google"
              title={
                busyProvider === 'google'
                  ? 'Opening Google…'
                  : 'Continue with Google'
              }
              subtitle="Use your Google account"
              icon={<GoogleLogo size={27} />}
              onClick={handleGoogle}
              disabled={busy}
            />
          </div>
        </div>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/[0.07]" />

          <span className="
            text-[7px]
            uppercase
            tracking-[0.26em]
            text-zinc-700
          ">
            or
          </span>

          <span className="h-px flex-1 bg-white/[0.07]" />
        </div>

        <div>
          <div className="mb-3">
            <strong className="text-[11px] text-zinc-400">
              Other ways to continue
            </strong>

            <p className="mt-1 text-[9px] text-zinc-700">
              Sign into the same MoonScribe library whichever method you choose.
            </p>
          </div>

          <div className="space-y-2.5">
            <AuthMethodButton
              icon="fa-regular fa-envelope"
              title="Email me a magic link"
              description="A secure one-time link. No password needed."
              onClick={() => setView('magic')}
            />

            <AuthMethodButton
              icon="fa-solid fa-fingerprint"
              title={
                busyProvider === 'passkey'
                  ? 'Waiting for your device…'
                  : 'Continue with a passkey'
              }
              description="Use your face, fingerprint or device PIN."
              onClick={handlePasskey}
              disabled={busy}
            />

            <AuthMethodButton
              icon="fa-solid fa-lock"
              title="Password"
              description="Sign in or create a MoonScribe account."
              onClick={() => setView('password')}
            />
          </div>
        </div>
      </>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Magic Link
  // ───────────────────────────────────────────────────────────────────────────

  const renderMagic = () => {
    return (
      <div className="mx-auto w-full max-w-[520px]">
        <button
          type="button"
          onClick={() => setView('main')}
          className="
            mb-6 flex items-center gap-2
            text-[9px] text-zinc-600
            transition
            hover:text-zinc-300
          "
        >
          <Icon icon="fa-solid fa-arrow-left" />
          Back to sign in
        </button>

        <div className="
          flex h-12 w-12
          items-center justify-center
          rounded-2xl
          border border-amber-400/10
          bg-amber-500/[0.06]
          text-amber-400
        ">
          <Icon icon="fa-regular fa-envelope" />
        </div>

        <h3 className="
          mt-5 font-serif
          text-[25px]
          font-semibold
          tracking-[-0.025em]
          text-[#f3efe7]
        ">
          Sign in by email
        </h3>

        <p className="mt-2 max-w-md text-[11px] leading-relaxed text-zinc-600">
          MoonScribe will send you a secure, single-use sign-in link.
          You won't need to enter a password.
        </p>

        <form
          onSubmit={handleMagicLink}
          className="mt-6"
        >
          <AuthInput
            label="Email address"
            icon="fa-regular fa-envelope"
            type="email"
            value={magicEmail}
            onChange={(event) =>
              setMagicEmail(event.target.value)
            }
            autoComplete="email"
            placeholder="you@example.com"
            required
          />

          <button
            type="submit"
            disabled={busy}
            className="
              mt-4
              flex h-11 w-full
              items-center justify-center
              gap-2
              rounded-xl
              bg-[#eee9df]
              text-[10px]
              font-semibold
              text-zinc-950
              transition
              hover:bg-white
              disabled:opacity-50
            "
          >
            {busyProvider === 'magic'
              ? 'Sending your link…'
              : 'Send sign-in link'}

            {busyProvider !== 'magic' && (
              <Icon icon="fa-solid fa-arrow-right" />
            )}
          </button>
        </form>

        <div className="
          mt-5 flex gap-3
          rounded-2xl
          border border-white/[0.06]
          bg-white/[0.012]
          p-4
        ">
          <span className="mt-0.5 text-zinc-600">
            <Icon icon="fa-solid fa-shield-halved" />
          </span>

          <div>
            <strong className="block text-[9px] text-zinc-400">
              Secure one-time sign in
            </strong>

            <p className="mt-1 text-[8px] leading-relaxed text-zinc-700">
              The link should expire shortly after it is issued and can only
              be used once.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Magic Link sent
  // ───────────────────────────────────────────────────────────────────────────

  const renderMagicSent = () => {
    return (
      <div className="
        mx-auto flex
        w-full max-w-[520px]
        flex-col items-center
        text-center
        py-5
      ">
        <div className="
          relative
          flex h-16 w-16
          items-center justify-center
          rounded-[22px]
          border border-emerald-400/15
          bg-emerald-500/[0.07]
          text-emerald-400
        ">
          <Icon icon="fa-regular fa-envelope-open" />

          <span className="
            absolute -bottom-1 -right-1
            flex h-6 w-6
            items-center justify-center
            rounded-full
            border-2 border-[#0b0b0f]
            bg-emerald-500
            text-[8px]
            text-white
          ">
            <Icon icon="fa-solid fa-check" />
          </span>
        </div>

        <BrandMark />

        <h3 className="
          mt-5
          font-serif
          text-[26px]
          font-semibold
          text-[#f3efe7]
        ">
          Check your inbox
        </h3>

        <p className="
          mt-2
          max-w-sm
          text-[11px]
          leading-relaxed
          text-zinc-600
        ">
          We sent a MoonScribe sign-in link to
        </p>

        <strong className="mt-1 text-[11px] text-zinc-300">
          {sentMagicEmail}
        </strong>

        <p className="
          mt-5
          max-w-sm
          text-[9px]
          leading-relaxed
          text-zinc-700
        ">
          Open the email on this device and follow the link to return
          securely to your stories.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMagicEmail(sentMagicEmail)
              setView('magic')
            }}
            className="
              rounded-xl
              border border-white/[0.07]
              bg-white/[0.025]
              px-4 py-2.5
              text-[9px]
              text-zinc-500
              transition
              hover:bg-white/[0.05]
              hover:text-zinc-300
            "
          >
            Send again
          </button>

          <button
            type="button"
            onClick={() => {
              setMagicEmail('')
              setSentMagicEmail('')
              setView('magic')
            }}
            className="
              rounded-xl
              border border-white/[0.07]
              bg-white/[0.025]
              px-4 py-2.5
              text-[9px]
              text-zinc-500
              transition
              hover:bg-white/[0.05]
              hover:text-zinc-300
            "
          >
            Use another email
          </button>

          <button
            type="button"
            onClick={() => setView('main')}
            className="
              rounded-xl
              bg-[#eee9df]
              px-4 py-2.5
              text-[9px]
              font-semibold
              text-zinc-950
              transition
              hover:bg-white
            "
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Password
  // ───────────────────────────────────────────────────────────────────────────

  const renderPassword = () => {
    return (
      <div className="mx-auto w-full max-w-[560px]">
        <button
          type="button"
          onClick={() => {
            setView('main')
            setLibraryConflict(false)
          }}
          className="
            mb-6 flex items-center gap-2
            text-[9px] text-zinc-600
            transition
            hover:text-zinc-300
          "
        >
          <Icon icon="fa-solid fa-arrow-left" />
          Back to sign in
        </button>

        <div className="
          flex h-12 w-12
          items-center justify-center
          rounded-2xl
          border border-white/[0.07]
          bg-white/[0.025]
          text-zinc-400
        ">
          <Icon icon="fa-solid fa-feather-pointed" />
        </div>

        <h3 className="
          mt-5 font-serif
          text-[25px]
          font-semibold
          tracking-[-0.025em]
          text-[#f3efe7]
        ">
          Continue with MoonScribe
        </h3>

        <p className="mt-2 text-[11px] text-zinc-600">
          Use your MoonScribe email, username and password.
        </p>

        <form
          onSubmit={nativeAuth}
          className="
            mt-6
            rounded-[20px]
            border border-white/[0.07]
            bg-white/[0.015]
            p-4
          "
        >
          <div className="
            mb-5
            flex rounded-xl
            bg-black/30
            p-1
          ">
            {[
              ['login', 'Sign in'],
              ['register', 'Create account'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value)
                  setLibraryConflict(false)
                }}
                className={`
                  flex-1 rounded-lg
                  px-3 py-2.5
                  text-[9px]
                  font-semibold
                  transition
                  ${
                    mode === value
                      ? 'bg-white/[0.09] text-white'
                      : 'text-zinc-600 hover:text-zinc-300'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AuthInput
              label="Email or username"
              icon="fa-regular fa-envelope"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              autoComplete="username"
              placeholder="you@example.com"
              required
              minLength={2}
            />

            <AuthInput
              label="Password"
              icon="fa-solid fa-lock"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete={
                mode === 'register'
                  ? 'new-password'
                  : 'current-password'
              }
              placeholder="••••••••••"
              required
              minLength={10}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="
              mt-5
              flex h-11 w-full
              items-center justify-center
              gap-2
              rounded-xl
              bg-[#eee9df]
              text-[10px]
              font-semibold
              text-zinc-950
              transition
              hover:bg-white
              disabled:opacity-50
            "
          >
            {busyProvider === 'password'
              ? 'Opening your library…'
              : mode === 'register'
                ? 'Create MoonScribe account'
                : 'Enter MoonScribe'}

            {busyProvider !== 'password' && (
              <Icon icon="fa-solid fa-arrow-right" />
            )}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="mb-2 text-[10px] font-semibold text-zinc-300">Forgot your password?</div>
            <div className="flex gap-2">
              <input className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white" type="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="Account email" />
              <button type="button" className="rounded-lg bg-white/[0.08] px-3 py-2 text-[10px] text-zinc-200" onClick={async () => { try { const response = await fetch(`${apiBaseUrl()}/api/auth/request-password-reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: resetEmail }) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Could not request a reset code.'); toast?.('Reset code sent. Check your email.'); } catch (error) { toast?.(error?.message || 'Could not request a reset code.') } }}>Send code</button>
            </div>
            <p className="mt-2 text-[10px] text-zinc-600">We’ll send a short-lived verification code to your account email.</p>
          </div>
        )}

        {libraryConflict && (
          <div
            role="alert"
            className="
              mt-4
              flex gap-3
              rounded-2xl
              border border-amber-400/20
              bg-amber-400/[0.05]
              p-4
            "
          >
            <span className="
              flex h-9 w-9 shrink-0
              items-center justify-center
              rounded-xl
              bg-amber-400/10
              text-amber-500
            ">
              <Icon icon="fa-solid fa-box-archive" />
            </span>

            <div className="min-w-0">
              <strong className="text-[10px] text-zinc-300">
                A different library is stored here
              </strong>

              <p className="
                mt-1 text-[9px]
                leading-relaxed
                text-zinc-600
              ">
                MoonScribe can create a safety backup first,
                then load the cloud library belonging to{' '}
                <b>{username}</b>.
              </p>

              <div className="
                mt-3 flex
                flex-col gap-2
                sm:flex-row
              ">
                <button
                  type="button"
                  onClick={() =>
                    setLibraryConflict(false)
                  }
                  className="
                    rounded-lg
                    px-3 py-2
                    text-[9px]
                    text-zinc-600
                    hover:bg-white/[0.04]
                  "
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={switchLibrary}
                  className="
                    rounded-lg
                    bg-amber-500
                    px-3 py-2
                    text-[9px]
                    font-semibold
                    text-zinc-950
                    transition
                    hover:bg-amber-400
                    disabled:opacity-50
                  "
                >
                  {busy
                    ? 'Switching safely…'
                    : 'Back up & use cloud library'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderAuthView = () => {
    switch (view) {
      case 'magic':
        return renderMagic()

      case 'magic-sent':
        return renderMagicSent()

      case 'password':
        return renderPassword()

      default:
        return renderMain()
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="
        fixed inset-0 z-[1000]
        flex items-center justify-center
        bg-black/80
        backdrop-blur-md

        p-0
        sm:p-4
        lg:p-6

        [padding-top:max(0px,env(safe-area-inset-top))]
        [padding-right:max(0px,env(safe-area-inset-right))]
        [padding-bottom:max(0px,env(safe-area-inset-bottom))]
        [padding-left:max(0px,env(safe-area-inset-left))]
      "
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          window.innerWidth >= 640
        ) {
          onClose?.()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="moonscribe-auth-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
        className="
          relative
          flex flex-col
          overflow-hidden
          bg-[#0a0a0e]
          text-zinc-100

          h-[100dvh]
          w-full
          rounded-none
          border-0

          sm:h-[calc(100dvh-32px)]
          sm:w-[calc(100vw-32px)]
          sm:max-w-[1020px]
          sm:rounded-[26px]
          sm:border
          sm:border-white/[0.08]

          lg:h-[min(760px,calc(100dvh-48px))]
          lg:w-[min(1180px,calc(100vw-48px))]
          lg:max-w-none

          shadow-[0_35px_150px_rgba(0,0,0,0.72)]
        "
      >
        {/* Background atmosphere */}

        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="
            absolute
            -left-52 -top-56
            h-[540px] w-[540px]
            rounded-full
            bg-indigo-500/[0.035]
            blur-[140px]
          " />

          <div className="
            absolute
            -bottom-64 right-0
            h-[520px] w-[520px]
            rounded-full
            bg-amber-500/[0.025]
            blur-[160px]
          " />
        </div>

        {/* Header */}

        <header className="
          relative z-10
          flex shrink-0
          items-start justify-between
          border-b border-white/[0.065]
          px-4 py-4
          sm:px-6
          sm:py-5
          lg:px-8
        ">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="
              h-11 w-11
              sm:h-13 sm:w-13
              shrink-0
              overflow-hidden
              rounded-[14px]
              border border-white/[0.10]
              bg-white/[0.025]
            ">
              <img
                src={APP_LOGO}
                alt="MoonScribe"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="min-w-0">
              <div className="
                text-[8px]
                font-semibold uppercase
                tracking-[0.28em]
                text-amber-500
              ">
                MoonScribe
              </div>

              <h2
                id="moonscribe-auth-title"
                className="
                  mt-1 truncate
                  font-serif
                  text-[20px]
                  sm:text-[23px]
                  lg:text-[25px]
                  font-semibold
                  tracking-[-0.025em]
                  text-[#f3efe7]
                "
              >
                {connected
                  ? 'Your MoonScribe account'
                  : 'Return to your stories'}
              </h2>

              <p className="
                mt-1
                hidden sm:block
                max-w-xl
                text-[10px]
                lg:text-[11px]
                leading-relaxed
                text-zinc-600
              ">
                {connected
                  ? 'Your stories, settings and writing progress stay with your MoonScribe identity.'
                  : 'Choose how you want to return. Every connected sign-in method leads to the same MoonScribe library.'}
              </p>
            </div>
          </div>

          <CloseButton onClick={onClose} />
        </header>

        {connected ? (
          renderConnected()
        ) : (
          <div className="
            relative z-10
            flex-1 min-h-0
            overflow-y-auto

            lg:grid
            lg:grid-cols-[1.4fr_0.78fr]
            lg:overflow-hidden
          ">
            {/* Primary auth area */}

            <section className="
              px-4 py-5
              sm:px-6
              sm:py-6

              lg:min-h-0
              lg:overflow-y-auto
              lg:border-r
              lg:border-white/[0.065]
              lg:px-8
              lg:py-7
            ">
              <div className="mx-auto max-w-[650px]">
                {renderAuthView()}
              </div>
            </section>

            {/* Secondary / future */}

            <aside className="
              border-t border-white/[0.065]
              bg-white/[0.006]
              px-4 py-5
              sm:px-6
              sm:py-6

              lg:flex
              lg:min-h-0
              lg:flex-col
              lg:border-t-0
              lg:px-6
              lg:py-7
            ">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="
                    font-serif
                    text-[16px]
                    font-semibold
                    text-[#e8e4dc]
                  ">
                    More ways to sign in
                  </h3>

                  <p className="
                    mt-1
                    text-[9px]
                    leading-relaxed
                    text-zinc-700
                  ">
                    Additional identity providers planned for future releases.
                  </p>
                </div>

                <span className="
                  rounded-full
                  bg-indigo-500/10
                  px-2.5 py-1
                  text-[6px]
                  font-bold uppercase
                  tracking-[0.18em]
                  text-indigo-400
                ">
                  Future
                </span>
              </div>

              <div className="
                mt-4
                grid grid-cols-1 gap-2
                sm:grid-cols-2
                lg:grid-cols-1
              ">
                <FutureProvider
                  name="Apple"
                  description="Sign in with Apple"
                  icon={<Icon icon="fa-brands fa-apple" />}
                />

                <FutureProvider
                  name="Microsoft"
                  description="Microsoft account"
                  icon={<MicrosoftLogo />}
                />

                <FutureProvider
                  name="GitHub"
                  description="Developer and writer accounts"
                  icon={<Icon icon="fa-brands fa-github" />}
                />

                <FutureProvider
                  name="Device sign-in"
                  description="Approve sign in from another device"
                  icon={<Icon icon="fa-solid fa-qrcode" />}
                />
              </div>

              <div className="
                mt-5
                rounded-[18px]
                border border-white/[0.055]
                bg-white/[0.012]
                p-4

                lg:mt-auto
              ">
                <div className="flex gap-3">
                  <span className="
                    flex h-9 w-9 shrink-0
                    items-center justify-center
                    rounded-xl
                    bg-white/[0.03]
                    text-zinc-600
                  ">
                    <Icon icon="fa-solid fa-shield-halved" />
                  </span>

                  <div>
                    <strong className="block text-[9px] text-zinc-500">
                      One MoonScribe identity
                    </strong>

                    <p className="
                      mt-1
                      text-[8px]
                      leading-relaxed
                      text-zinc-700
                    ">
                      Discord, Google, Magic Link and Passkeys should all
                      resolve to the same MoonScribe account once linked.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {!connected && (
          <footer className="
            relative z-10
            hidden sm:flex
            shrink-0
            items-center justify-between
            border-t border-white/[0.055]
            px-6
            lg:px-8
            py-3
            text-[7px]
            text-zinc-800
          ">
            <span>
              By continuing, you agree to MoonScribe&apos;s <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>
              {' '}and acknowledge its <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
            </span>

            <span className="hidden gap-3 lg:flex">
              <span>Secure</span>
              <span>•</span>
              <span>Local-first</span>
              <span>•</span>
              <span>Private</span>
            </span>
          </footer>
        )}
      </div>
    </div>
  )
}
