import { useState } from 'react'
import { createNovel } from '../db/novels'
import { createChapter } from '../db/chapters'
import { useApp } from '../context/AppContext'

function MoonMark() {
  return (
    <svg viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="21" fill="#F9F6F1" />
      <circle cx="37.5" cy="37.5" r="21" fill="#7BA3C9" />
      <circle cx="24" cy="21" r="2.6" fill="#D4A5A5" />
    </svg>
  )
}

export default function Onboarding() {
  const { finishOnboarding } = useApp()
  const [busy, setBusy] = useState(false)

  const begin = async () => {
    if (busy) return
    setBusy(true)
    const novel = await createNovel({ title: 'My first novel' })
    await createChapter(novel.id, { title: 'Chapter One', content: '' })
    await finishOnboarding()
    window.location.hash = `#/novel/${novel.id}`
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="moon-mark">
          <MoonMark />
        </div>
        <h1>MoonScribe</h1>
        <div className="dedication">made with love, for Storm Tattersall</div>
        <p className="lead">
          A quiet, private place for your stories. Your writing starts on this device and remains
          available offline. Create an account later when you want secure sync and collaboration.
        </p>

        <div className="onboarding-steps">
          <div className="onboarding-step">
            <span className="num">1</span>
            <div>
              <b>Begin.</b> <span>Open a novel — or start one, right now, in the next minute.</span>
            </div>
          </div>
          <div className="onboarding-step">
            <span className="num">2</span>
            <div>
              <b>Write.</b> <span>It saves itself, softly, as you go. Even offline.</span>
            </div>
          </div>
          <div className="onboarding-step">
            <span className="num">3</span>
            <div>
              <b>Shape &amp; share.</b> <span>Chapters, characters, notes — and export to Markdown, DOCX or a printed book whenever you like.</span>
            </div>
          </div>
        </div>

        <button className="button button-primary" style={{ fontSize: '1.05rem', padding: '13px 28px' }} onClick={begin} disabled={busy}>
          {busy ? 'Opening…' : 'Begin my first novel'}
        </button>
        <p className="small muted" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
          Your draft is stored privately on this device. You can back it up or export it at any time.
        </p>
      </div>
    </div>
  )
}
