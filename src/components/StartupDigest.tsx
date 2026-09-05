import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'

const todayKey = () => `moonscribe:startup-digest:${new Date().toISOString().slice(0, 10)}`

export default function StartupDigest() {
  const { settings, syncUsername } = useApp() as any
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (settings?.startupDigest === false || !settings || !localStorage || localStorage.getItem(todayKey())) return
    localStorage.setItem(todayKey(), 'shown')
    setOpen(true)
    if (settings.startupSound !== false) import('../utils/sounds').then(({ playStartupSound }) => playStartupSound({ masterEnabled: settings.soundEnabled, channelEnabled: settings.startupSound, masterVolume: settings.soundVolume, channelVolume: settings.startupSoundVolume }))
  }, [settings])
  if (!open) return null
  const playDigestSound = async () => {
    if (settings.startupSound === false) return
    const { playStartupSound, unlockAudio } = await import('../utils/sounds')
    unlockAudio()
    playStartupSound({ masterEnabled: settings.soundEnabled, channelEnabled: settings.startupSound, masterVolume: settings.soundVolume, channelVolume: settings.startupSoundVolume })
  }
  const close = () => setOpen(false)
  return <div className="startup-digest !fixed !inset-0 !z-[2400] !flex !items-start !justify-center !overflow-y-auto !p-4 !pt-[max(1rem,env(safe-area-inset-top))] !pb-[calc(1rem+env(safe-area-inset-bottom))] sm:!items-center sm:!p-6" role="dialog" aria-modal="true" aria-labelledby="startup-digest-title">
    <div className="startup-digest-card !relative !w-full !max-w-2xl !max-h-[calc(100dvh-2rem)] !touch-pan-y !overscroll-contain !overflow-y-auto !overflow-x-hidden !rounded-[2rem] !border !border-amber-200/20 !bg-slate-950/90 !p-7 !text-left !shadow-[0_30px_120px_rgba(0,0,0,.55)] !backdrop-blur-2xl sm:!max-h-[calc(100dvh-3rem)] sm:!p-12 motion-safe:animate-[digest-in_.7s_cubic-bezier(.2,.9,.25,1)_both]">
      <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-amber-300/15 blur-3xl motion-safe:animate-[digest-glow_7s_ease-in-out_infinite]" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 size-80 rounded-full bg-indigo-400/10 blur-3xl" aria-hidden="true" />
      <div className="relative">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl border border-amber-200/25 bg-amber-200/10 text-2xl text-amber-200 shadow-[0_0_35px_rgba(245,190,92,.16)] motion-safe:animate-[digest-float_4s_ease-in-out_infinite]" aria-hidden="true">☾</div>
            <span className="text-[.62rem] font-semibold uppercase tracking-[.24em] text-amber-100/65">MoonScribe · Daily briefing</span>
          </div>
          <span className="hidden rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[.62rem] font-semibold uppercase tracking-[.14em] text-emerald-200/80 sm:inline-flex">Local-first</span>
        </div>
        <p className="mb-3 text-[.7rem] font-semibold uppercase tracking-[.18em] text-amber-200/70">A new page is waiting</p>
        <h1 id="startup-digest-title" className="max-w-xl font-[var(--font-heading)] text-4xl font-medium leading-[.98] tracking-[-.04em] text-stone-100 sm:text-6xl">Good to see you{syncUsername ? `, ${syncUsername}` : ''}.</h1>
        <p className="mt-5 text-sm italic text-stone-400">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</p>
        <div className="my-9 grid gap-3 sm:grid-cols-3">
          {['One quiet page|Your library is ready for the next scene.', 'Your work is yours|Drafts remain available offline by default.', 'Make today yours|Even a few words keep the story moving.'].map((item, index) => { const [title, detail] = item.split('|'); return <div key={title} className="group rounded-2xl border border-white/10 bg-white/[.045] p-4 transition duration-300 hover:-translate-y-1 hover:border-amber-200/30 hover:bg-amber-100/[.07] motion-safe:animate-[digest-rise_.55s_ease-out_both]" style={{ animationDelay: `${180 + index * 90}ms` }}><span className="mb-5 block text-xs text-amber-200/75">0{index + 1}</span><strong className="block font-[var(--font-heading)] text-lg font-medium text-stone-100">{title}</strong><span className="mt-2 block text-xs leading-relaxed text-stone-400">{detail}</span></div> })}
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <button className="button button-primary !m-0 !min-h-12 !rounded-xl !px-6 !shadow-[0_12px_30px_rgba(194,145,58,.18)] transition duration-300 hover:-translate-y-0.5 hover:!shadow-[0_16px_38px_rgba(194,145,58,.28)]" onClick={() => { playDigestSound(); close() }} autoFocus>Open my studio <span aria-hidden="true">→</span></button>
          <button className="startup-digest-dismiss !m-0 !px-3 !py-3 !text-left !text-xs !text-stone-400 transition hover:!text-stone-100" onClick={close}>Skip today’s briefing</button>
        </div>
      </div>
    </div>
  </div>
}
