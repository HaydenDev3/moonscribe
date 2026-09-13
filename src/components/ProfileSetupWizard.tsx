import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import Icon from './Icon'
import { emitSound } from '../utils/sounds'
import Select from './Select'

const STEPS = ['Welcome', 'Identity', 'Writer profile', 'Preferences']
const GENRES = [
  'Fantasy',
  'Sci-Fi',
  'Romance',
  'Mystery',
  'Thriller',
  'Literary',
  'Memoir',
  'Poetry',
]

function savedDraft(fallback) {
  try {
    const value = JSON.parse(localStorage.getItem('moonscribe:profile-setup-draft') || 'null')
    return value && typeof value === 'object' ? { ...fallback, ...value } : fallback
  } catch {
    return fallback
  }
}

export default function ProfileSetupWizard() {
  const app = useApp() as any
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(() =>
    savedDraft({
      displayName: app.settings?.displayName || '',
      writerName: app.settings?.writerName || '',
      profileBio: app.settings?.profileBio || '',
      timezone: app.settings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      language: app.settings?.language || 'en-AU',
      profileGenres: [],
    })
  )

  useEffect(() => {
    try {
      localStorage.setItem('moonscribe:profile-setup-draft', JSON.stringify(draft))
    } catch {
      /* optional draft persistence */
    }
  }, [draft])

  const update = (patch) => setDraft((current) => ({ ...current, ...patch }))
  const finish = async (completed) => {
    setBusy(true)
    setError('')
    try {
      await app.saveProfile({ ...draft, profileSetupCompleted: completed })
      if (completed) emitSound('action.success')
      app.closeProfileSetup?.()
      try {
        localStorage.removeItem('moonscribe:profile-setup-draft')
      } catch {
        /* optional storage */
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your profile could not be saved.')
    } finally {
      setBusy(false)
    }
  }
  const next = () => setStep((current) => Math.min(STEPS.length - 1, current + 1))
  const back = () => setStep((current) => Math.max(0, current - 1))
  const toggleGenre = (genre) =>
    update({
      profileGenres: draft.profileGenres.includes(genre)
        ? draft.profileGenres.filter((item) => item !== genre)
        : [...draft.profileGenres, genre],
    })

  return (
    <div
      className="profile-setup-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-setup-title"
    >
      <div className="profile-setup-card">
        <div className="profile-setup-header">
          <span className="account-brand">☾ MoonScribe</span>
          <button
            type="button"
            onClick={() => finish(false)}
            disabled={busy}
            aria-label="Skip profile setup"
          >
            <Icon icon="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="profile-setup-progress">
          <span>Profile setup</span>
          <b>
            {step + 1} of {STEPS.length}
          </b>
          <div>
            <i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
        <main>
          {step === 0 && (
            <section>
              <span className="profile-setup-kicker">MAKE IT YOURS</span>
              <h1 id="profile-setup-title">A little about the writer.</h1>
              <p>
                Set up the identity you want MoonScribe to use across your studio, exports, and
                shared writing spaces.
              </p>
              <div className="profile-setup-preview">
                <span className="profile-setup-avatar">
                  {(draft.displayName || app.syncUsername || 'W').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{draft.displayName || app.syncUsername || 'Your name'}</strong>
                  <small>{draft.writerName || 'Writer profile'}</small>
                </div>
              </div>
            </section>
          )}
          {step === 1 && (
            <section>
              <span className="profile-setup-kicker">YOUR IDENTITY</span>
              <h1 id="profile-setup-title">How should we address you?</h1>
              <p>
                Your display name appears in the studio. A pen name is optional and is used on
                exports.
              </p>
              <label className="profile-setup-field">
                <span>Display name</span>
                <input
                  autoFocus
                  value={draft.displayName}
                  maxLength={80}
                  onChange={(event) => update({ displayName: event.target.value })}
                  placeholder={app.syncUsername || 'Your name'}
                />
              </label>
              <label className="profile-setup-field">
                <span>
                  Writer name or pen name <em>Optional</em>
                </span>
                <input
                  value={draft.writerName}
                  maxLength={80}
                  onChange={(event) => update({ writerName: event.target.value })}
                  placeholder="The name on your books"
                />
              </label>
            </section>
          )}
          {step === 2 && (
            <section>
              <span className="profile-setup-kicker">YOUR WRITING</span>
              <h1 id="profile-setup-title">What do you write?</h1>
              <p>Choose a few interests to personalize your studio. You can change these later.</p>
              <div className="profile-setup-genres">
                {GENRES.map((genre) => (
                  <button
                    type="button"
                    key={genre}
                    className={draft.profileGenres.includes(genre) ? 'selected' : ''}
                    onClick={() => toggleGenre(genre)}
                  >
                    {genre}
                  </button>
                ))}
              </div>
              <label className="profile-setup-field">
                <span>
                  Short bio <em>Optional</em>
                </span>
                <textarea
                  value={draft.profileBio}
                  maxLength={500}
                  rows={4}
                  onChange={(event) => update({ profileBio: event.target.value })}
                  placeholder="A sentence about you as a writer"
                />
                <small>{draft.profileBio.length}/500</small>
              </label>
            </section>
          )}
          {step === 3 && (
            <section>
              <span className="profile-setup-kicker">YOUR PREFERENCES</span>
              <h1 id="profile-setup-title">Make the studio feel local.</h1>
              <p>These settings help MoonScribe show dates and language correctly.</p>
              <label className="profile-setup-field">
                <span>Timezone</span>
                <Select
                  value={draft.timezone}
                  onChange={(value) => update({ timezone: value })}
                  options={[
                    'Australia/Brisbane',
                    'Australia/Sydney',
                    'America/New_York',
                    'Europe/London',
                    'UTC',
                  ].map((value) => ({ value, label: value }))}
                />
              </label>
              <label className="profile-setup-field">
                <span>Language</span>
                <Select
                  value={draft.language}
                  onChange={(value) => update({ language: value })}
                  options={[
                    { value: 'en-AU', label: 'English (Australia)' },
                    { value: 'en-US', label: 'English (United States)' },
                    { value: 'en-GB', label: 'English (United Kingdom)' },
                  ]}
                />
              </label>
            </section>
          )}
          {error && (
            <div className="profile-setup-error" role="alert">
              <Icon icon="fa-solid fa-circle-exclamation" /> {error}
            </div>
          )}
        </main>
        <footer>
          <button
            type="button"
            className="button button-quiet"
            onClick={() => finish(false)}
            disabled={busy}
          >
            Skip for now
          </button>
          <div>
            {step > 0 && (
              <button
                type="button"
                data-sound="ui.tactileClick"
                className="button button-ghost"
                onClick={back}
                disabled={busy}
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                data-sound="ui.tactileClick"
                className="button button-primary"
                onClick={next}
              >
                Continue <Icon icon="fa-solid fa-arrow-right" />
              </button>
            ) : (
              <button
                type="button"
                data-sound="ui.tactileClick"
                className="button button-primary"
                onClick={() => finish(true)}
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Finish setup'} <Icon icon="fa-solid fa-check" />
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
