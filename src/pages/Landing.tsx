import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import AuthModal from '../components/AuthModal'
import { useApp } from '../context/AppContext'
import { detectPlatform, platformDownload, platformLabel } from '../utils/platform'

const FEATURES = [
  ['fa-solid fa-file-lines', 'A real manuscript studio', 'Paginated writing, formatting, comments, replay and print-ready exports in one focused workspace.'],
  ['fa-solid fa-wand-magic-sparkles', 'Story intelligence', 'Characters, places, factions and continuity stay connected to the words that brought them to life.'],
  ['fa-solid fa-cloud-arrow-up', 'Online, still yours', 'Encrypted transport, account-isolated libraries and offline-safe drafts keep every device in step.'],
  ['fa-solid fa-book-open', 'Design the whole book', 'Shape covers, typography, atmosphere and page design, then preview the finished object in 3D.'],
]

export default function Landing() {
  const { syncUsername, accountReady, toast, hasRole } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [authOpen, setAuthOpen] = useState(() => new URLSearchParams(location.search).get('signin') === '1')
  const [platform, setPlatform] = useState(() => detectPlatform(
    globalThis.navigator?.userAgent,
    globalThis.navigator?.platform,
    globalThis.navigator?.maxTouchPoints,
  ))
  const [previewMode, setPreviewMode] = useState<'write' | 'plan' | 'design'>('write')

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints))
  }, [])

  useEffect(() => {
    if (accountReady && syncUsername) navigate('/dashboard', { replace: true })
  }, [accountReady, syncUsername, navigate])

  const signIn = () => setAuthOpen(true)
  const downloadUrl = platformDownload(platform, import.meta.env)
  const cloudOnly = platform === 'mobile' || !downloadUrl
  const mobileCloudDisabled = platform === 'mobile'
  const downloadLabel = `Download for ${platformLabel(platform)}`
  const desktopUnlocked = hasRole('admin') || hasRole('developer') || hasRole('beta_tester')
  const lockedDownload = Boolean(downloadUrl && !desktopUnlocked)

  return <main className="landing">
    <nav className="landing-nav">
      <Link className="landing-brand" to="/"><img src="/moonscribelogo.png" alt="MoonScribe logo" className="landing-brand-logo" /><span className="landing-brand-copy">MoonScribe<span>✦</span></span></Link>
      <div className="landing-nav-links"><a href="#studio">Studio</a><a href="#features">Features</a><Link to="/privacy">Privacy</Link><button className="landing-nav-login" onClick={signIn}>Sign in</button>{cloudOnly || lockedDownload ? <button className={`button button-primary ${lockedDownload ? 'beta-locked-button' : ''}`} onClick={lockedDownload ? signIn : signIn}><Icon icon={lockedDownload ? 'fa-solid fa-lock' : 'fa-solid fa-cloud'} /> {lockedDownload ? 'Desktop beta access' : 'Open Cloud'}</button> : <a className="button button-primary" href={downloadUrl} download>{downloadLabel}</a>}</div>
    </nav>
    <section className="landing-hero">
      <div className="landing-hero-grid" aria-hidden="true" />
      <div className="landing-eyebrow"><i /> A complete creative studio for novelists</div>
      <p className="landing-kicker">Where stories become books</p>
      <h1>Write worlds worth<br /><em>remembering.</em></h1>
      <p>Draft with the familiarity of Word and Docs, then go further—living story intelligence, visual planning, collaboration and a professional cover studio in one beautiful place.</p>
      <div className="landing-actions">{mobileCloudDisabled ? <button className="button button-secondary landing-primary" disabled><Icon icon="fa-solid fa-mobile-screen-button" /> Mobile web temporarily paused</button> : cloudOnly || lockedDownload ? <button className={`button button-primary landing-primary ${lockedDownload ? 'beta-locked-button' : ''}`} onClick={signIn}><Icon icon={lockedDownload ? 'fa-solid fa-lock' : 'fa-solid fa-cloud'} /> {lockedDownload ? 'Desktop beta access' : 'Open MoonScribe Cloud'}</button> : <a className="button button-primary landing-primary" href={downloadUrl} download><Icon icon="fa-solid fa-download" /> {downloadLabel}</a>}<button className="button button-secondary" onClick={signIn} disabled={mobileCloudDisabled}>{mobileCloudDisabled ? 'Check back soon' : cloudOnly || lockedDownload ? 'Sign in' : 'Use Cloud instead'}</button><a className="button button-secondary" href="#studio"><Icon icon="fa-solid fa-play" /> See the studio</a></div>
      <p className="landing-platform-note">{mobileCloudDisabled ? 'Mobile and tablet cloud access is temporarily disabled while we finish the responsive rebuild. Desktop MoonScribe remains available.' : downloadUrl ? `MoonScribe detected ${platformLabel(platform)}. Cloud remains available in any modern browser.` : `A ${platformLabel(platform)} desktop build is not published yet. MoonScribe Cloud is ready now.`}</p>
      <div className="landing-trust"><span><Icon icon="fa-solid fa-cloud" /> Synced everywhere</span><span><Icon icon="fa-solid fa-shield-halved" /> Private by default</span><span><Icon icon="fa-solid fa-users" /> Write together live</span></div>
      <div className="landing-product-tabs" id="studio">{(['write', 'plan', 'design'] as const).map((mode) => <button key={mode} className={previewMode === mode ? 'active' : ''} onClick={() => setPreviewMode(mode)}><Icon icon={mode === 'write' ? 'fa-solid fa-pen-nib' : mode === 'plan' ? 'fa-solid fa-diagram-project' : 'fa-solid fa-book'} /> {mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>
      <div className={`landing-window landing-preview-${previewMode}`} aria-label={`${previewMode} studio preview`}><div className="landing-window-glow"/><div className="landing-window-bar"><div><i/><i/><i/></div><span>MoonScribe · The Alders Canal</span><b><Icon icon="fa-solid fa-cloud" /> Saved</b></div><div className="landing-window-body"><aside><strong>THE ALDERS CANAL</strong><b>{previewMode === 'write' ? 'MANUSCRIPT' : previewMode === 'plan' ? 'STORY MAP' : 'BOOK DESIGN'}</b><span>⌄ Part One — The Return</span><small className="active">└ Chapter Twelve</small><small>└ Chapter Thirteen</small><b>WORLD</b><small>Characters</small><small>Timeline</small><small>Moodboard</small></aside>{previewMode === 'write' ? <article><label>SCENE CONTEXT&nbsp;&nbsp; · &nbsp;&nbsp;The lighthouse&nbsp;&nbsp; · &nbsp;&nbsp;Hushed</label><div className="landing-toolbar"><span>Source Serif 4</span><b>B</b><em>I</em><u>U</u><i>☰</i><i>🔗</i></div><div className="landing-page"><h2>Chapter Twelve:<br/>The Letter</h2><p>The sea had been speaking all night, writing its silver sentences against the glass.</p><p>By morning, <u>Mira</u> finally understood what it wanted her to remember.</p><p>She opened the letter.</p></div></article> : previewMode === 'plan' ? <div className="landing-plan-preview"><span>STORY CONSTELLATION</span><h3>Every thread has a place.</h3><div className="plan-orbit"><i className="plan-node node-a">Mira Vale</i><i className="plan-node node-b">The lighthouse</i><i className="plan-node node-c">The letter</i><b>Act I</b></div><small>Characters · Places · Continuity · Mood</small></div> : <div className="landing-design-preview"><div className="book-cover"><small>THE ALDERS CANAL</small><strong>The<br/>Return</strong><i>✦</i><em>MoonScribe Press</em></div><div><span>PRINT PREVIEW</span><h3>A finished book, from the first line.</h3><p>Trim, type, cover and atmosphere in one considered studio.</p></div></div>}<div className="landing-intelligence"><span>{previewMode === 'write' ? 'STORY INTELLIGENCE' : previewMode === 'plan' ? 'CONTINUITY' : 'BOOK DESIGN'}</span><strong>{previewMode === 'write' ? 'Mira Vale' : previewMode === 'plan' ? '3 threads connected' : 'The Return'}</strong><small>{previewMode === 'write' ? 'Character recognised' : previewMode === 'plan' ? 'No loose ends nearby' : 'Cover ready to print'}</small><p>{previewMode === 'write' ? 'Last seen at the lighthouse, carrying the unopened letter.' : previewMode === 'plan' ? 'The letter links the character, place and turning point.' : 'A quiet cover for a story with weather in its bones.'}</p><div><i/> {previewMode === 'plan' ? 'Continuity clear' : previewMode === 'design' ? 'Looks good in print' : 'Continuity clear'}</div></div></div></div>
    </section>
    <section className="landing-features" id="features"><div className="landing-section-head"><span>Built for long stories</span><h2>Power up your story process.</h2><p>One calm workspace for the words, worlds, and details that make a book feel alive.</p></div><div className="landing-feature-grid landing-feature-grid-rich">{FEATURES.map(([icon,title,text], index) => <article className={`landing-feature-card landing-feature-card-${index + 1}`} key={title}><span>0{index + 1}</span><Icon icon={icon}/><h3>{title}</h3><p>{text}</p><div className="landing-feature-orbit" aria-hidden="true"><i /><i /><i /></div><b>Explore <Icon icon="fa-solid fa-arrow-right" /></b></article>)}</div></section>
    <section className="landing-privacy" id="privacy"><div><span>Online, yours</span><h2>Your library follows you—not everyone else.</h2></div><p>Account-isolated libraries, revocable device sessions and private live rooms keep your work available wherever you write and protected everywhere else.</p><button className="button button-primary" onClick={signIn}>Enter your studio</button></section>
    <section className="landing-final"><span>YOUR NEXT CHAPTER</span><h2>A blank page is waiting.</h2><p>Bring the story. MoonScribe will hold the world around it.</p><button className="button button-primary" onClick={signIn}>Begin writing <Icon icon="fa-solid fa-arrow-right" /></button></section>
    <footer className="landing-footer landing-footer-rich"><div className="landing-footer-brand"><span>MoonScribe <i>✦</i></span><p>A quiet, private home for novels in progress.</p><small>© 2026 MoonScribe. Made for the stories still becoming.</small></div><div className="landing-footer-column"><strong>Studio</strong><a href="#studio">Write</a><a href="#features">Features</a><Link to="/community">Community</Link><Link to="/contact">Contact</Link></div><div className="landing-footer-column"><strong>Legal</strong><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies">Cookies</Link><Link to="/acceptable-use">Acceptable use</Link></div><div className="landing-footer-newsletter"><strong>Explore</strong><p>Write in the cloud or download the desktop studio.</p><button className="landing-footer-action" onClick={signIn}>Sign in / Open Cloud</button>{!cloudOnly && !lockedDownload && <a href={downloadUrl} download>Download MoonScribe</a>}<div className="landing-footer-social"><a href="https://github.com/HaydenDev3/moonscribe" target="_blank" rel="noreferrer" aria-label="MoonScribe on GitHub"><Icon icon="fa-brands fa-github" /></a><Link to="/community" aria-label="MoonScribe community"><Icon icon="fa-brands fa-discord" /></Link><Link to="/privacy" aria-label="Privacy"><Icon icon="fa-solid fa-shield-halved" /></Link></div></div></footer>
    <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
  </main>
}
