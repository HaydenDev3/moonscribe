import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import AuthModal from '../components/AuthModal'
import { useApp } from '../context/AppContext'
import { detectPlatform, platformDownload, platformLabel } from '../utils/platform'
import InstallPrompt from '../components/InstallPrompt'
import UserPill from '../components/UserPill'
import LandingAtmosphere from '../components/LandingAtmosphere'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '../components/ui/sheet'
import { Button } from '../components/ui/button'

const FEATURES = [
  ['fa-solid fa-file-lines', 'A real manuscript studio', 'Paginated writing, formatting, comments, replay and print-ready exports in one focused workspace.'],
  ['fa-solid fa-wand-magic-sparkles', 'Story intelligence', 'Characters, places, factions and continuity stay connected to the words that brought them to life.'],
  ['fa-solid fa-cloud-arrow-up', 'Online, still yours', 'Encrypted transport, account-isolated libraries and offline-safe drafts keep every device in step.'],
  ['fa-solid fa-book-open', 'Design the whole book', 'Shape covers, typography, atmosphere and page design, then preview the finished object in 3D.'],
]

const CONSTELLATION_NODES = [
  { id: 'mira', label: 'Mira Vale', type: 'Character', detail: 'The keeper of the lighthouse, carrying a letter she has not opened.', x: 25, y: 38, tone: 'gold' },
  { id: 'lighthouse', label: 'The lighthouse', type: 'Place', detail: 'A weathered signal tower where the story’s first secret surfaces.', x: 67, y: 23, tone: 'blue' },
  { id: 'letter', label: 'The letter', type: 'Thread', detail: 'A turning point connecting Mira to the place she thought she had left behind.', x: 70, y: 68, tone: 'rose' },
  { id: 'return', label: 'The return', type: 'Beat', detail: 'The choice that shifts the story from memory into motion.', x: 29, y: 76, tone: 'moss' },
]

export default function Landing() {
  const { syncUsername, toast, hasRole } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [authOpen, setAuthOpen] = useState(() => new URLSearchParams(location.search).get('signin') === '1')
  const [platform, setPlatform] = useState(() => detectPlatform(
    globalThis.navigator?.userAgent,
    globalThis.navigator?.platform,
    globalThis.navigator?.maxTouchPoints,
  ))
  const [previewMode, setPreviewMode] = useState<'write' | 'plan' | 'design'>('write')
  const [constellationFocus, setConstellationFocus] = useState('mira')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints))
  }, [])

  const signIn = () => {
    if (syncUsername) navigate('/dashboard')
    else setAuthOpen(true)
  }
  const downloadUrl = platformDownload(platform, import.meta.env)
  const cloudOnly = platform === 'mobile' || !downloadUrl
  const mobileCloudDisabled = false
  const downloadLabel = `Download for ${platformLabel(platform)}`
  const desktopUnlocked = hasRole('admin') || hasRole('developer') || hasRole('beta_tester')
  const lockedDownload = Boolean(downloadUrl && !desktopUnlocked)
  const signedIn = Boolean(syncUsername)

  return <main className="landing">
    <LandingAtmosphere />
    <InstallPrompt />
    <nav className="landing-nav">
      <Link className="landing-brand" to="/"><img src="/moonscribelogo.png" alt="MoonScribe logo" className="landing-brand-logo" /><span className="landing-brand-copy">MoonScribe<span>✦</span></span></Link>
      <div className="landing-nav-links"><a href="#studio">Studio</a><a href="#features">Features</a><a href="#brand">Our brand</a><Link to="/privacy">Privacy</Link>{signedIn ? <UserPill onConnectClick={() => navigate('/dashboard')} /> : <button className="landing-nav-login" onClick={signIn}>Sign in</button>}{!signedIn && (cloudOnly || lockedDownload ? <Button variant="default" className={lockedDownload ? 'beta-locked-button' : ''} onClick={signIn}><Icon icon={lockedDownload ? 'fa-solid fa-lock' : 'fa-solid fa-cloud'} /> {lockedDownload ? 'Desktop beta access' : 'Open Cloud'}</Button> : <a className="button button-primary" href={downloadUrl} download>{downloadLabel}</a>)}</div>
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="landing-mobile-menu" aria-label="Open menu"><Icon icon="fa-solid fa-bars" /></Button></SheetTrigger><SheetContent side="right"><SheetTitle>MoonScribe</SheetTitle><nav className="landing-mobile-nav" aria-label="Mobile navigation"><a href="#studio" onClick={() => setMobileMenuOpen(false)}>Studio</a><a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a><a href="#brand" onClick={() => setMobileMenuOpen(false)}>Our brand</a><Link to="/privacy" onClick={() => setMobileMenuOpen(false)}>Privacy</Link><Link to="/terms" onClick={() => setMobileMenuOpen(false)}>Terms</Link><Button onClick={() => { setMobileMenuOpen(false); signIn() }}>{signedIn ? 'Open dashboard' : 'Start writing'}</Button></nav></SheetContent></Sheet>
    </nav>
    <section className="landing-hero">
      <div className="landing-hero-grid" aria-hidden="true" />
      <div className="landing-eyebrow"><i /> A complete creative studio for novelists</div>
      <p className="landing-kicker">Where stories become books</p>
      <h1>Write worlds worth<br /><em>remembering.</em></h1>
      <p>Draft with the familiarity of Word and Docs, then go further—living story intelligence, visual planning, collaboration and a professional cover studio in one beautiful place.</p>
      <div className="landing-actions">{signedIn ? <button className="button button-primary landing-primary" onClick={signIn}><Icon icon="fa-solid fa-arrow-right" /> Continue to your studio</button> : mobileCloudDisabled ? <button className="button button-secondary landing-primary" disabled><Icon icon="fa-solid fa-mobile-screen-button" /> Mobile web temporarily paused</button> : cloudOnly || lockedDownload ? <button className={`button button-primary landing-primary ${lockedDownload ? 'beta-locked-button' : ''}`} onClick={signIn}><Icon icon={lockedDownload ? 'fa-solid fa-lock' : 'fa-solid fa-cloud'} /> {lockedDownload ? 'Desktop beta access' : 'Open MoonScribe Cloud'}</button> : <a className="button button-primary landing-primary" href={downloadUrl} download><Icon icon="fa-solid fa-download" /> {downloadLabel}</a>}<button className="button button-secondary" onClick={signIn} disabled={mobileCloudDisabled}>{signedIn ? 'Open dashboard' : mobileCloudDisabled ? 'Check back soon' : cloudOnly || lockedDownload ? 'Sign in' : 'Use Cloud instead'}</button><a className="button button-secondary" href="#studio"><Icon icon="fa-solid fa-play" /> See the studio</a></div>
      <p className="landing-platform-note">{downloadUrl ? `MoonScribe detected ${platformLabel(platform)}. Cloud remains available in any modern browser.` : `A ${platformLabel(platform)} desktop build is not published yet. MoonScribe Cloud is ready now.`}</p>
      <div className="landing-trust"><span><Icon icon="fa-solid fa-cloud" /> Synced everywhere</span><span><Icon icon="fa-solid fa-shield-halved" /> Private by default</span><span><Icon icon="fa-solid fa-users" /> Write together live</span></div>
      <div className="landing-product-tabs" id="studio">{(['write', 'plan', 'design'] as const).map((mode) => <button key={mode} className={previewMode === mode ? 'active' : ''} onClick={() => setPreviewMode(mode)}><Icon icon={mode === 'write' ? 'fa-solid fa-pen-nib' : mode === 'plan' ? 'fa-solid fa-diagram-project' : 'fa-solid fa-book'} /> {mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>
      <div className={`landing-window landing-preview-${previewMode}`} aria-label={`${previewMode} studio preview`}><div className="landing-window-glow"/><div className="landing-window-bar"><div><i/><i/><i/></div><span>MoonScribe · The Alders Canal</span><b><Icon icon="fa-solid fa-cloud" /> Saved</b></div><div className="landing-window-body"><aside><strong>THE ALDERS CANAL</strong><b>{previewMode === 'write' ? 'MANUSCRIPT' : previewMode === 'plan' ? 'STORY MAP' : 'BOOK DESIGN'}</b><span>⌄ Part One — The Return</span><small className="active">└ Chapter Twelve</small><small>└ Chapter Thirteen</small><b>WORLD</b><small>Characters</small><small>Timeline</small><small>Moodboard</small></aside>{previewMode === 'write' ? <article><label>SCENE CONTEXT&nbsp;&nbsp; · &nbsp;&nbsp;The lighthouse&nbsp;&nbsp; · &nbsp;&nbsp;Hushed</label><div className="landing-toolbar"><span>Source Serif 4</span><b>B</b><em>I</em><u>U</u><i>☰</i><i>🔗</i></div><div className="landing-page"><h2>Chapter Twelve:<br/>The Letter</h2><p>The sea had been speaking all night, writing its silver sentences against the glass.</p><p>By morning, <u>Mira</u> finally understood what it wanted her to remember.</p><p>She opened the letter.</p></div></article> : previewMode === 'plan' ? <div className="landing-plan-preview"><span>STORY CONSTELLATION</span><h3>Every thread has a place.</h3><div className="plan-orbit"><i className="plan-node node-a">Mira Vale</i><i className="plan-node node-b">The lighthouse</i><i className="plan-node node-c">The letter</i><b>Act I</b></div><small>Characters · Places · Continuity · Mood</small></div> : <div className="landing-design-preview"><div className="book-cover"><small>THE ALDERS CANAL</small><strong>The<br/>Return</strong><i>✦</i><em>MoonScribe Press</em></div><div><span>PRINT PREVIEW</span><h3>A finished book, from the first line.</h3><p>Trim, type, cover and atmosphere in one considered studio.</p></div></div>}<div className="landing-intelligence"><span>{previewMode === 'write' ? 'STORY INTELLIGENCE' : previewMode === 'plan' ? 'CONTINUITY' : 'BOOK DESIGN'}</span><strong>{previewMode === 'write' ? 'Mira Vale' : previewMode === 'plan' ? '3 threads connected' : 'The Return'}</strong><small>{previewMode === 'write' ? 'Character recognised' : previewMode === 'plan' ? 'No loose ends nearby' : 'Cover ready to print'}</small><p>{previewMode === 'write' ? 'Last seen at the lighthouse, carrying the unopened letter.' : previewMode === 'plan' ? 'The letter links the character, place and turning point.' : 'A quiet cover for a story with weather in its bones.'}</p><div><i/> {previewMode === 'plan' ? 'Continuity clear' : previewMode === 'design' ? 'Looks good in print' : 'Continuity clear'}</div></div></div></div>
    </section>
    <section className="landing-features" id="features"><div className="landing-section-head"><span>Built for long stories</span><h2>Power up your story process.</h2><p>One calm workspace for the words, worlds, and details that make a book feel alive.</p></div><div className="landing-feature-grid landing-feature-grid-rich">{FEATURES.map(([icon,title,text], index) => <article className={`landing-feature-card landing-feature-card-${index + 1}`} key={title}><span>0{index + 1}</span><Icon icon={icon}/><h3>{title}</h3><p>{text}</p><div className="landing-feature-orbit" aria-hidden="true"><i /><i /><i /></div><b>Explore <Icon icon="fa-solid fa-arrow-right" /></b></article>)}</div></section>
    <section className="landing-brand-story" id="brand"><div className="landing-section-head"><span>The MoonScribe point of view</span><h2>A studio with a soul, built around the writer.</h2><p>MoonScribe is for the long middle of a story: the quiet hours when a world is still becoming and every detail matters.</p></div><div className="landing-brand-story-grid"><article><span className="landing-brand-story-icon"><Icon icon="fa-solid fa-moon" /></span><h3>Quiet by design</h3><p>Our dark, bookish palette and restrained motion are meant to lower the noise around the page. The interface should feel like a room you return to, not a machine asking for attention.</p></article><article><span className="landing-brand-story-icon"><Icon icon="fa-solid fa-feather-pointed" /></span><h3>Craft has a place</h3><p>Manuscript, worldbuilding, design and revision belong together. MoonScribe treats the novel as both living text and finished object, from first sentence to print preview.</p></article><article><span className="landing-brand-story-icon"><Icon icon="fa-solid fa-shield-halved" /></span><h3>Yours first</h3><p>Your work is private by default, available offline, and synced on your terms. We build tools that support authorship without trying to become the author.</p></article></div><div className="landing-brand-manifesto"><strong>MoonScribe stands for</strong><span>attention over interruption</span><span>continuity over clutter</span><span>ownership over extraction</span></div></section>
    <section className="landing-constellation-story" id="constellation"><div className="landing-section-head"><span>A promised feature, now in motion</span><h2>See how a story holds together.</h2><p>Every character, place, thread and turning point becomes a navigable constellation. Select a star to follow the connection.</p></div><div className="landing-constellation-card"><div className="landing-constellation-canvas" role="list" aria-label="Interactive story constellation">{CONSTELLATION_NODES.map((node) => <span key={node.id} className={`landing-constellation-line landing-constellation-line-${node.id}`} aria-hidden="true" />)}{CONSTELLATION_NODES.map((node) => <button key={node.id} role="listitem" className={`landing-constellation-node ${node.tone} ${constellationFocus === node.id ? 'active' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => setConstellationFocus(node.id)}><i /><strong>{node.label}</strong><small>{node.type}</small></button>)}</div><div className="landing-constellation-detail"><span>CONNECTED THREAD</span><h3>{CONSTELLATION_NODES.find((node) => node.id === constellationFocus)?.label}</h3><p>{CONSTELLATION_NODES.find((node) => node.id === constellationFocus)?.detail}</p><button className="button button-secondary" onClick={signIn}>Build your own constellation <Icon icon="fa-solid fa-arrow-right" /></button></div></div></section>
    <section className="landing-privacy" id="privacy"><div><span>Online, yours</span><h2>Your library follows you—not everyone else.</h2></div><p>Account-isolated libraries, revocable device sessions and private live rooms keep your work available wherever you write and protected everywhere else.</p><button className="button button-primary" onClick={signIn}>Enter your studio</button></section>
    <section className="landing-final"><span>YOUR NEXT CHAPTER</span><h2>A blank page is waiting.</h2><p>Bring the story. MoonScribe will hold the world around it.</p><button className="button button-primary" onClick={signIn}>Begin writing <Icon icon="fa-solid fa-arrow-right" /></button></section>
    <footer className="landing-footer landing-footer-rich"><div className="landing-footer-brand"><span>MoonScribe <i>✦</i></span><p>A quiet, private home for novels in progress.</p><small>© 2026 MoonScribe. Made for the stories still becoming.</small></div><div className="landing-footer-column"><strong>Studio</strong><a href="#studio">Write</a><a href="#features">Features</a><Link to="/community">Community</Link><Link to="/contact">Contact</Link></div><div className="landing-footer-column"><strong>Legal</strong><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies">Cookies</Link><Link to="/acceptable-use">Acceptable use</Link></div><div className="landing-footer-newsletter"><strong>Explore</strong><p>Write in the cloud or download the desktop studio.</p><button className="landing-footer-action" onClick={signIn}>Sign in / Open Cloud</button>{!cloudOnly && !lockedDownload && <a href={downloadUrl} download>Download MoonScribe</a>}<div className="landing-footer-social"><a href="https://github.com/HaydenDev3/moonscribe" target="_blank" rel="noreferrer" aria-label="MoonScribe on GitHub"><Icon icon="fa-brands fa-github" /></a><Link to="/community" aria-label="MoonScribe community"><Icon icon="fa-brands fa-discord" /></Link><Link to="/privacy" aria-label="Privacy"><Icon icon="fa-solid fa-shield-halved" /></Link></div></div></footer>
    <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
  </main>
}
