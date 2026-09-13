import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import AuthModal from '../components/AuthModal'
import { useApp } from '../context/AppContext'
import { detectPlatform, platformDownload, platformLabel } from '../utils/platform'
import InstallPrompt from '../components/InstallPrompt'
import UserPill from '../components/UserPill'
import LandingEditorPreview from '../components/LandingEditorPreview'
import LandingAtmosphere from '../components/LandingAtmosphere'
import BlurText from '../components/BlurText'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '../components/ui/sheet'
import { Button } from '../components/ui/button'
import DriftWall from '../dashboard/DriftWall'
import { HighlightText, MorphingText } from '../components/LandingTextEffects'
import UserPresenceAvatar from '../components/UserPresenceAvatar'
import GithubStarsWheel from '../components/GithubStarsWheel'
import LandingShareModal from '../components/LandingShareModal'

const GITHUB_REPOSITORY = 'https://github.com/HaydenDev3/moonscribe'
type GithubRepository = { stargazers_count: number; forks_count: number; open_issues_count: number; language: string | null; owner?: { login?: string; avatar_url?: string } }

const FEATURE_STORIES = [
  { icon: 'fa-solid fa-file-lines', kicker: '01 · Manuscript studio', title: 'Write without leaving the story.', text: 'A focused page for drafting, revising, and keeping scene context close when the work gets deep.', mode: 'write' as const },
  { icon: 'fa-solid fa-diagram-project', kicker: '02 · Story intelligence', title: 'Keep every thread in reach.', text: 'Characters, places, and continuity stay connected to the words that brought them to life.', mode: 'plan' as const },
  { icon: 'fa-solid fa-compass-drafting', kicker: '03 · Planning & worldbuilding', title: 'See the shape before it arrives.', text: 'Map the emotional movement of a book without forcing a living story into a rigid outline.', mode: 'plan' as const },
  { icon: 'fa-solid fa-book-open', kicker: '04 · Book design', title: 'Make the finished object visible.', text: 'Move from manuscript to cover, typography, and print preview in the same considered studio.', mode: 'design' as const },
  { icon: 'fa-solid fa-cloud-arrow-up', kicker: '05 · Offline-first', title: 'Keep writing when the signal fades.', text: 'Your draft stays close at the desk, then syncs safely when your devices find their way back online.', mode: 'write' as const },
  { icon: 'fa-solid fa-users', kicker: '06 · Private collaboration', title: 'Share the room, keep the work yours.', text: 'Invite trusted readers into a private space without turning your manuscript into a public feed.', mode: 'plan' as const },
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
  const [constellationFocus, setConstellationFocus] = useState('mira')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [github, setGithub] = useState<GithubRepository | null>(null)

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints))
  }, [])

  useEffect(() => {
    const controller = new globalThis.AbortController()
    fetch('https://api.github.com/repos/HaydenDev3/moonscribe', { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<GithubRepository> : null)
      .then((repository) => { if (repository) setGithub(repository) })
      .catch(() => undefined)
    return () => controller.abort()
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
      <div className="landing-nav-links"><a href="#features">Features</a><a href="#rhythm">How it works</a><Link to="/privacy">Privacy</Link>{signedIn ? <UserPill onConnectClick={() => navigate('/dashboard')} /> : <button className="landing-nav-login" onClick={signIn}>Sign in</button>}{!signedIn && (cloudOnly || lockedDownload ? <Button variant="default" className={lockedDownload ? 'beta-locked-button' : ''} onClick={signIn}><Icon icon={lockedDownload ? 'fa-solid fa-lock' : 'fa-solid fa-cloud'} /> {lockedDownload ? 'Desktop beta access' : 'Open Cloud'}</Button> : <a className="button button-primary" href={downloadUrl} download>{downloadLabel}</a>)}</div>
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="landing-mobile-menu" aria-label="Open menu"><Icon icon="fa-solid fa-bars" /></Button></SheetTrigger><SheetContent side="right" className="landing-mobile-sheet"><div className="landing-mobile-sheet-head"><div className="landing-mobile-sheet-brand"><span className="landing-mobile-sheet-mark">☾</span><div><SheetTitle>MoonScribe</SheetTitle><SheetDescription>Writer’s studio</SheetDescription></div></div><SheetClose asChild><button className="landing-mobile-sheet-close" aria-label="Close menu"><Icon icon="fa-solid fa-xmark" /></button></SheetClose></div><nav className="landing-mobile-nav" aria-label="Mobile navigation"><span className="landing-mobile-nav-label">Explore the studio</span><a href="#features" onClick={() => setMobileMenuOpen(false)}><Icon icon="fa-solid fa-wand-magic-sparkles" /><span>Features</span><Icon icon="fa-solid fa-arrow-right" /></a><a href="#rhythm" onClick={() => setMobileMenuOpen(false)}><Icon icon="fa-solid fa-moon" /><span>How it works</span><Icon icon="fa-solid fa-arrow-right" /></a><span className="landing-mobile-nav-label">Trust &amp; access</span><Link to="/privacy" onClick={() => setMobileMenuOpen(false)}><Icon icon="fa-solid fa-shield-halved" /><span>Privacy</span><Icon icon="fa-solid fa-arrow-right" /></Link><Link to="/terms" onClick={() => setMobileMenuOpen(false)}><Icon icon="fa-solid fa-file-contract" /><span>Terms</span><Icon icon="fa-solid fa-arrow-right" /></Link><Button className="landing-mobile-nav-cta" onClick={() => { setMobileMenuOpen(false); signIn() }}><Icon icon="fa-solid fa-arrow-right" />{signedIn ? 'Open dashboard' : 'Start writing'}</Button></nav><div className="landing-mobile-sheet-foot"><span>Quiet tools for long stories.</span><span>MoonScribe · 2026</span></div></SheetContent></Sheet>
    </nav>
    <section className="landing-hero">
      <div className="landing-hero-drift-wall" aria-hidden="true"><DriftWall /></div>
      <div className="landing-hero-grid" aria-hidden="true" />
      <div className="landing-hero-content">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow"><i /> A complete creative studio for novelists</div>
          <p className="landing-kicker"><MorphingText words={['Where stories become books', 'Where ideas find shape', 'Where the next chapter starts']} /></p>
          <h1 className="landing-hero-title" aria-label="Write worlds worth remembering."><span aria-hidden="true">Write worlds worth</span><em aria-hidden="true"><BlurText text="remembering." delay={90} animateBy="words" direction="top" className="landing-hero-reveal" /></em></h1>
          <p><HighlightText>Draft with the familiarity of Word and Docs</HighlightText>, then go further—living story intelligence, visual planning, collaboration and a professional cover studio in one beautiful place.</p>
          <div className="landing-actions">{signedIn ? <button className="button button-primary landing-primary" onClick={signIn}><Icon icon="fa-solid fa-arrow-right" /> Continue to your studio</button> : mobileCloudDisabled ? <button className="button button-secondary landing-primary" disabled><Icon icon="fa-solid fa-mobile-screen-button" /> Mobile web temporarily paused</button> : cloudOnly || lockedDownload ? <button className={`button button-primary landing-primary ${lockedDownload ? 'beta-locked-button' : ''}`} onClick={signIn}><Icon icon={lockedDownload ? 'fa-solid fa-lock' : 'fa-solid fa-cloud'} /> {lockedDownload ? 'Desktop beta access' : 'Open MoonScribe Cloud'}</button> : <a className="button button-primary landing-primary" href={downloadUrl} download><Icon icon="fa-solid fa-download" /> {downloadLabel}</a>}{!signedIn && <button className="button button-secondary" onClick={signIn} disabled={mobileCloudDisabled}>{mobileCloudDisabled ? 'Check back soon' : cloudOnly || lockedDownload ? 'Sign in' : 'Use Cloud instead'}</button>}<a className="button button-secondary" href="#features"><Icon icon="fa-solid fa-play" /> Explore features</a></div>
          <p className="landing-platform-note">{downloadUrl ? `MoonScribe detected ${platformLabel(platform)}. Cloud remains available in any modern browser.` : `A ${platformLabel(platform)} desktop build is not published yet. MoonScribe Cloud is ready now.`}</p>
          <div className="landing-trust"><span><Icon icon="fa-solid fa-cloud-arrow-down" /> Offline-first writing</span><span><Icon icon="fa-solid fa-shield-halved" /> Conflict-safe sync</span><span><Icon icon="fa-solid fa-users" /> Private Share rooms</span></div>
        </div>
        <div className="landing-hero-visual" aria-label="Live MoonScribe studio preview">
          <div className="landing-hero-orbit landing-hero-orbit-one" aria-hidden="true" />
          <div className="landing-hero-orbit landing-hero-orbit-two" aria-hidden="true" />
          <div className="landing-hero-live-label"><i /> LIVE SURFACE <span>01</span></div>
          <div className="landing-hero-preview"><LandingEditorPreview mode="write" /></div>
          <div className="landing-hero-float landing-hero-float-top"><Icon icon="fa-solid fa-feather-pointed" /><span>Scene context</span><b>Connected</b></div>
          <div className="landing-hero-float landing-hero-float-bottom"><span>THE ALDERS CANAL</span><strong>Chapter Twelve</strong><small>Last saved just now</small></div>
        </div>
      </div>
    </section>
    <div className="landing-section-divider" aria-hidden="true"><span /><i>✦</i><span /></div>
    <section className="landing-features" id="features"><div className="landing-section-head"><span>Built for long stories</span><h2 className="landing-section-reveal">The tools your story reaches for.</h2><p>Six focused surfaces, close enough to move between without breaking your attention.</p></div><div className="landing-feature-compact-grid">{FEATURE_STORIES.map((feature, index) => <article className="landing-feature-compact" key={feature.title}><div className="landing-feature-compact-top"><span className="landing-feature-number">0{index + 1}</span><div className="landing-feature-icon"><Icon icon={feature.icon} /></div><span className="landing-feature-kicker">{feature.kicker}</span></div><h3>{feature.title}</h3><p>{feature.text}</p><span className="landing-feature-compact-link">Open the surface <Icon icon="fa-solid fa-arrow-right" /></span></article>)}</div></section>
    <section className="landing-community" id="community"><div className="landing-section-head"><span>Open, considered, human</span><h2>Built in the open for the people who make things.</h2><p>MoonScribe is a TypeScript studio powered by familiar web technology and a small, thoughtful open-source community.</p></div><div className="landing-community-grid"><article className="landing-community-stats"><div className="landing-community-stat-head"><div><span className="landing-community-label">MOONSCRIBE ON GITHUB</span><h3>Follow the work as it grows.</h3></div><GithubStarsWheel stars={github?.stargazers_count ?? null} href={GITHUB_REPOSITORY} /></div><div className="landing-stat-grid"><div><strong>{github ? github.forks_count.toLocaleString() : '—'}</strong><span>Forks</span></div><div><strong>{github ? github.open_issues_count.toLocaleString() : '—'}</strong><span>Open issues</span></div><div><strong>{github?.language || '—'}</strong><span>Primary language</span></div></div><div className="landing-community-actions"><a className="button button-secondary" href={GITHUB_REPOSITORY} target="_blank" rel="noreferrer"><Icon icon="fa-brands fa-github" /> View repository</a><button className="button button-primary" type="button" onClick={() => setShareOpen(true)}><Icon icon="fa-solid fa-share-nodes" /> Share MoonScribe</button></div></article><article className="landing-technology-card"><span className="landing-community-label">THE STACK</span><h3>Quiet tools, carefully connected.</h3><div className="landing-tech-list">{['React 19', 'TypeScript', 'Tauri', 'SQLite', 'Supabase', 'Tailwind CSS'].map((technology) => <span key={technology}><i />{technology}</span>)}</div><p>One shared studio across browser and desktop, with local-first writing and production-minded publishing.</p></article></div><article className="landing-credits"><div><span className="landing-community-label">DEVELOPERS &amp; CONTRIBUTORS</span><h3>Made by writers, builders, and curious humans.</h3><p>MoonScribe grows through the people who shape the code, test the edges, and keep long stories moving.</p></div><div className="landing-credit-person"><UserPresenceAvatar people={[{ id: github?.owner?.login || 'moonscribe', username: github?.owner?.login || 'MoonScribe', avatar: github?.owner?.avatar_url || null, status: github ? 'online' : 'offline' }]} /><span>{github?.owner?.login || 'MoonScribe contributors'}</span><a href={GITHUB_REPOSITORY} target="_blank" rel="noreferrer">Contribute <Icon icon="fa-solid fa-arrow-up-right-from-square" /></a></div></article></section>
    <section className="landing-rhythm" id="rhythm"><div className="landing-rhythm-intro"><span>The rhythm of a novel</span><h2>Make room for the messy middle.</h2><p>Stories rarely arrive in a straight line. MoonScribe gives each stage a surface, then lets you move between them without losing the thread.</p></div><div className="landing-rhythm-track"><article><b>01</b><span>Gather</span><strong>Collect the fragments.</strong><p>Notes, references, characters, and sparks can live beside the draft until they find their place.</p></article><i aria-hidden="true" /><article><b>02</b><span>Shape</span><strong>Follow the connections.</strong><p>See the pattern in your story as it changes, without locking the work too early.</p></article><i aria-hidden="true" /><article><b>03</b><span>Finish</span><strong>Bring it into the world.</strong><p>When the words are ready, move naturally into a designed, printable book.</p></article></div></section>
    <section className="landing-constellation-story" id="constellation"><div className="landing-section-head"><span>Continuity, made visible</span><h2>Follow the thread, not the clutter.</h2><p>Characters, places, threads and turning points stay connected as the story changes. Select a node to inspect the relationship.</p></div><div className="landing-constellation-card"><div className="landing-constellation-canvas" role="list" aria-label="Interactive story constellation"><div className="landing-constellation-legend"><span><i className="gold" /> Character</span><span><i className="blue" /> Place</span><span><i className="rose" /> Thread</span><span><i className="moss" /> Beat</span></div>{CONSTELLATION_NODES.map((node) => <span key={node.id} className={`landing-constellation-line landing-constellation-line-${node.id}`} aria-hidden="true" />)}{CONSTELLATION_NODES.map((node) => <button key={node.id} role="listitem" className={`landing-constellation-node ${node.tone} ${constellationFocus === node.id ? 'active' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => setConstellationFocus(node.id)}><i /><strong>{node.label}</strong><small>{node.type}</small></button>)}</div><div className="landing-constellation-detail"><span>SELECTED THREAD</span><div className="landing-constellation-detail-status"><i /> Connected to 3 story elements</div><h3>{CONSTELLATION_NODES.find((node) => node.id === constellationFocus)?.label}</h3><p>{CONSTELLATION_NODES.find((node) => node.id === constellationFocus)?.detail}</p><button className="button button-secondary" onClick={signIn}>Build your own map <Icon icon="fa-solid fa-arrow-right" /></button></div></div></section>
    <section className="landing-final"><div className="landing-final-orbit landing-final-orbit-a" aria-hidden="true" /><div className="landing-final-orbit landing-final-orbit-b" aria-hidden="true" /><div className="landing-final-inner"><div className="landing-final-mark" aria-hidden="true">✦</div><span>YOUR NEXT CHAPTER</span><h2>Start with one true sentence.</h2><p>The rest of the world can gather around it.</p><button className="button button-primary" onClick={signIn}>Begin writing <Icon icon="fa-solid fa-arrow-right" /></button><small>Private by default · Yours to keep</small></div></section>
    <footer className="landing-footer landing-footer-rich"><div className="landing-footer-brand"><span>MoonScribe <i>✦</i></span><p>A quiet, private home for novels in progress.</p><small>© 2026 MoonScribe. Made for the stories still becoming.</small></div><div className="landing-footer-column"><strong>Explore</strong><a href="#features">Features</a><a href="#rhythm">How it works</a><a href="#community">Community</a><Link to="/contact">Contact</Link></div><div className="landing-footer-column"><strong>Legal</strong><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies">Cookies</Link><Link to="/acceptable-use">Acceptable use</Link></div><div className="landing-footer-newsletter"><strong>Keep writing</strong><p>Write in the cloud or download the desktop studio.</p><button className="landing-footer-action" onClick={signIn}>Sign in / Open Cloud</button>{!cloudOnly && !lockedDownload && <a className="landing-footer-download" href={downloadUrl} download>Download MoonScribe</a>}<div className="landing-footer-social"><a href={GITHUB_REPOSITORY} target="_blank" rel="noreferrer" aria-label="MoonScribe on GitHub"><Icon icon="fa-brands fa-github" /></a><button type="button" onClick={() => setShareOpen(true)} aria-label="Share MoonScribe"><Icon icon="fa-solid fa-share-nodes" /></button></div></div></footer>
    <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    <LandingShareModal open={shareOpen} onOpenChange={setShareOpen} />
  </main>
}
