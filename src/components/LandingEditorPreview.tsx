import Icon from './Icon'
import { TypingText } from './LandingTextEffects'

type PreviewMode = 'write' | 'plan' | 'design'

export default function LandingEditorPreview({ mode }: { mode: PreviewMode }) {
  return <div className={`landing-window landing-preview-${mode}`} aria-label={`${mode} studio preview`}>
    <div className="landing-window-glow" />
    <div className="landing-window-bar"><div><i /><i /><i /></div><span>MoonScribe · The Alders Canal</span><b><Icon icon="fa-solid fa-cloud" /> Saved</b></div>
    <div className="landing-window-body">
      <aside><strong>THE ALDERS CANAL</strong><b>{mode === 'write' ? 'MANUSCRIPT' : mode === 'plan' ? 'STORY MAP' : 'BOOK DESIGN'}</b><span>⌄ Part One — The Return</span><small className="active">└ Chapter Twelve</small><small>└ Chapter Thirteen</small><b>WORLD</b><small>Characters</small><small>Timeline</small><small>Moodboard</small></aside>
      {mode === 'write' && <article><label><Icon icon="fa-solid fa-circle" /> SCENE CONTEXT · The lighthouse · Hushed</label><div className="landing-toolbar"><span>Source Serif 4</span><b>B</b><em>I</em><u>U</u><i>☰</i><i>🔗</i><i>≡</i></div><div className="landing-page"><h2>Chapter Twelve:<br />The Letter</h2><p><TypingText text="The sea had been speaking all night, writing its silver sentences against the glass." /></p><p>By morning, <u>Mira</u> finally understood what it wanted her to remember.</p><p>She opened the letter.</p></div></article>}
      {mode === 'plan' && <div className="landing-plan-preview"><span>STORY CONSTELLATION</span><h3>Every thread has a place.</h3><div className="plan-orbit"><i className="plan-node node-a">Mira Vale</i><i className="plan-node node-b">The lighthouse</i><i className="plan-node node-c">The letter</i><b>Act I</b></div><small>Characters · Places · Continuity · Mood</small></div>}
      {mode === 'design' && <div className="landing-design-preview"><div className="book-cover"><small>THE ALDERS CANAL</small><strong>The<br />Return</strong><i>✦</i><em>MoonScribe Press</em></div><div><span>PRINT PREVIEW</span><h3>A finished book, from the first line.</h3><p>Trim, type, cover and atmosphere in one considered studio.</p></div></div>}
      <div className="landing-intelligence"><span>{mode === 'write' ? 'STORY INTELLIGENCE' : mode === 'plan' ? 'CONTINUITY' : 'BOOK DESIGN'}</span><strong>{mode === 'write' ? 'Mira Vale' : mode === 'plan' ? '3 threads connected' : 'The Return'}</strong><small>{mode === 'write' ? 'Character recognised' : mode === 'plan' ? 'No loose ends nearby' : 'Cover ready to print'}</small><p>{mode === 'write' ? 'Last seen at the lighthouse, carrying the unopened letter.' : mode === 'plan' ? 'The letter links the character, place and turning point.' : 'A quiet cover for a story with weather in its bones.'}</p><div><i /> {mode === 'design' ? 'Looks good in print' : 'Continuity clear'}</div></div>
    </div>
  </div>
}
