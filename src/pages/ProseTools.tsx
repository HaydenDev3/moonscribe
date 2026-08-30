import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listChapters } from '../db/chapters'
import { analyzeProse } from '../utils/proseChecks'
import Icon from '../components/Icon'

export default function ProseTools({ novelId, embedded = false }) {
  const { id } = useParams(); const nid = novelId || id
  const [chapters, setChapters] = useState([]); const [selected, setSelected] = useState('all')
  const load = useCallback(async () => setChapters(await listChapters(nid)), [nid]); useEffect(() => { void load() }, [load])
  const source = selected === 'all' ? chapters : chapters.filter((chapter) => chapter.id === selected)
  const stats = source.reduce((total, chapter) => { const report = analyzeProse(chapter.content); total.words += report.words; total.sentences += report.sentences; total.longSentences += report.longSentences; total.passive += report.passive; total.dialogueWords += report.dialogueWords; report.repeatedWords.forEach(([word, count]) => total.repeated.set(word, (total.repeated.get(word) || 0) + count)); report.fillers.forEach(([word, count]) => total.fillers.set(word, (total.fillers.get(word) || 0) + count)); return total }, { words: 0, sentences: 0, longSentences: 0, passive: 0, dialogueWords: 0, repeated: new Map(), fillers: new Map() })
  const average = stats.sentences ? Math.round(stats.words / stats.sentences) : 0
  return <div className={embedded ? undefined : 'app'}><div className="page page-wide prose-tools-page"><header><span className="eyebrow">Private writing tools</span><h2>Prose tools</h2><p className="muted">Deterministic checks run on this device. MoonScribe never rewrites your work.</p></header><div className="prose-tools-toolbar"><label>Analyse<select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="all">Whole manuscript</option>{chapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.title || 'Untitled chapter'}</option>)}</select></label></div><div className="prose-stats-grid">{[['Words', stats.words], ['Average sentence', average], ['Long sentences', stats.longSentences], ['Passive patterns', stats.passive], ['Dialogue words', stats.dialogueWords]].map(([label, value]) => <div className="card" key={label}><span className="eyebrow">{label}</span><strong>{value.toLocaleString()}</strong></div>)}</div><div className="prose-report-grid"><Report title="Repeated words" icon="fa-solid fa-repeat" items={[...stats.repeated].sort((a, b) => b[1] - a[1])} empty="No repeated words stood out." /><Report title="Filler words" icon="fa-solid fa-filter" items={[...stats.fillers].sort((a, b) => b[1] - a[1])} empty="No configured filler words found." /></div></div></div>
}
function Report({ title, icon, items, empty }) { return <section className="card prose-report"><h3><Icon icon={icon} /> {title}</h3>{items.length ? <ul>{items.map(([word, count]) => <li key={word}><span>{word}</span><b>{count}</b></li>)}</ul> : <p className="muted">{empty}</p>}</section> }
