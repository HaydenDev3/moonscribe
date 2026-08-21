import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import AuthModal from '../components/AuthModal'
import { useApp } from '../context/AppContext'

const FEATURES = [
  ['fa-solid fa-file-lines', 'A real manuscript studio', 'Paginated writing, formatting, comments, replay and print-ready exports in one focused workspace.'],
  ['fa-solid fa-wand-magic-sparkles', 'Story intelligence', 'Characters, places, factions and continuity stay connected to the words that brought them to life.'],
  ['fa-solid fa-cloud-arrow-up', 'Online, still yours', 'Encrypted transport, account-isolated libraries and offline-safe drafts keep every device in step.'],
  ['fa-solid fa-book-open', 'Design the whole book', 'Shape covers, typography, atmosphere and page design, then preview the finished object in 3D.'],
]

export default function Landing() {
  const { syncUsername, accountReady } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [authOpen, setAuthOpen] = useState(() => new URLSearchParams(location.search).get('signin') === '1')

  useEffect(() => {
    if (accountReady && syncUsername) navigate('/dashboard', { replace: true })
  }, [accountReady, syncUsername, navigate])

  const signIn = () => setAuthOpen(true)

  return <main className="landing">
    <nav className="landing-nav">
      <Link className="landing-brand" to="/"><i className="landing-brand-orbit" />MoonScribe<span>✦</span></Link>
      <div className="landing-nav-links"><a href="#studio">Studio</a><a href="#features">Features</a><a href="#privacy">Privacy</a><button className="landing-nav-login" onClick={signIn}>Sign in</button><button className="button button-primary" onClick={signIn}>Start writing</button></div>
    </nav>
    <section className="landing-hero">
      <div className="landing-hero-grid" aria-hidden="true" />
      <div className="landing-eyebrow"><i /> A complete creative studio for novelists</div>
      <p className="landing-kicker">Where stories become books</p>
      <h1>Write worlds worth<br /><em>remembering.</em></h1>
      <p>Draft with the familiarity of Word and Docs, then go further—living story intelligence, visual planning, collaboration and a professional cover studio in one beautiful place.</p>
      <div className="landing-actions"><button className="button button-primary landing-primary" onClick={signIn}>Start your novel <Icon icon="fa-solid fa-arrow-right" /></button><a className="button button-secondary" href="#studio"><Icon icon="fa-solid fa-play" /> See the studio</a></div>
      <div className="landing-trust"><span><Icon icon="fa-solid fa-cloud" /> Synced everywhere</span><span><Icon icon="fa-solid fa-shield-halved" /> Private by default</span><span><Icon icon="fa-solid fa-users" /> Write together live</span></div>
      <div className="landing-product-tabs" id="studio"><span className="active"><Icon icon="fa-solid fa-pen-nib" /> Write</span><span><Icon icon="fa-solid fa-diagram-project" /> Plan</span><span><Icon icon="fa-solid fa-book" /> Design</span></div>
      <div className="landing-window" aria-hidden="true"><div className="landing-window-glow"/><div className="landing-window-bar"><div><i/><i/><i/></div><span>MoonScribe · The Alders Canal</span><b><Icon icon="fa-solid fa-cloud" /> Saved</b></div><div className="landing-window-body"><aside><strong>THE ALDERS CANAL</strong><b>MANUSCRIPT</b><span>⌄ Part One — The Return</span><small className="active">└ Chapter Twelve</small><small>└ Chapter Thirteen</small><b>WORLD</b><small>Characters</small><small>Timeline</small><small>Moodboard</small></aside><article><label>SCENE CONTEXT&nbsp;&nbsp; · &nbsp;&nbsp;The lighthouse&nbsp;&nbsp; · &nbsp;&nbsp;Hushed</label><div className="landing-toolbar"><span>Source Serif 4</span><b>B</b><em>I</em><u>U</u><i>☰</i><i>🔗</i></div><div className="landing-page"><h2>Chapter Twelve:<br/>The Letter</h2><p>The sea had been speaking all night, writing its silver sentences against the glass.</p><p>By morning, <u>Mira</u> finally understood what it wanted her to remember.</p><p>She opened the letter.</p></div></article><div className="landing-intelligence"><span>STORY INTELLIGENCE</span><strong>Mira Vale</strong><small>Character recognised</small><p>Last seen at the lighthouse, carrying the unopened letter.</p><div><i/> Continuity clear</div></div></div></div>
    </section>
    <section className="landing-features" id="features"><div className="landing-section-head"><span>Built for long stories</span><h2>Everything around the words,<br />without getting in their way.</h2><p>One calm workspace from first spark to finished book.</p></div><div className="landing-feature-grid">{FEATURES.map(([icon,title,text], index) => <article key={title}><span>0{index + 1}</span><Icon icon={icon}/><h3>{title}</h3><p>{text}</p><b>Explore <Icon icon="fa-solid fa-arrow-right" /></b></article>)}</div></section>
    <section className="landing-privacy" id="privacy"><div><span>Online, yours</span><h2>Your library follows you—not everyone else.</h2></div><p>Account-isolated libraries, revocable device sessions and private live rooms keep your work available wherever you write and protected everywhere else.</p><button className="button button-primary" onClick={signIn}>Enter your studio</button></section>
    <section className="landing-final"><span>YOUR NEXT CHAPTER</span><h2>A blank page is waiting.</h2><p>Bring the story. MoonScribe will hold the world around it.</p><button className="button button-primary" onClick={signIn}>Begin writing <Icon icon="fa-solid fa-arrow-right" /></button></section>
    <footer className="landing-footer"><span>MoonScribe ✦</span><small>A premium home for novels in progress.</small></footer>
    <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
  </main>
}
