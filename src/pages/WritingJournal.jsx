import { useEffect, useState } from 'react'
import { getNovel, updateNovel } from '../db/novels'
import Icon from '../components/Icon'

export default function WritingJournal({ novelId }) {
  const [entries,setEntries] = useState([])
  const [text,setText] = useState('')
  useEffect(() => { getNovel(novelId).then((novel) => setEntries(novel?.writingJournal || [])) }, [novelId])
  const save = async (next) => { setEntries(next); await updateNovel(novelId,{ writingJournal:next }) }
  const add = () => { if (!text.trim()) return; save([{ id:crypto.randomUUID(), at:Date.now(), text:text.trim() },...entries]); setText('') }
  return <section className="studio-collection journal-studio"><header><div><span>Captain’s log</span><h2>Writing journal</h2><p>Capture decisions, discoveries and questions without interrupting the manuscript.</p></div><div className="journal-count"><b>{entries.length}</b><small>entries</small></div></header><div className="journal-prompt"><Icon icon="fa-solid fa-feather-pointed"/><div><strong>What shifted in the story today?</strong><small>Record a breakthrough, loose thread, research note, or intention for the next session.</small></div></div><div className="journal-compose"><textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') add() }} placeholder="Write without polishing…"/><button className="button button-primary" onClick={add}><Icon icon="fa-solid fa-plus"/> Save entry</button></div><div className="journal-entry-list">{entries.map((entry,index) => <article key={entry.id}><span className="journal-orbit">{entries.length-index}</span><time>{new Date(entry.at).toLocaleString()}</time><p>{entry.text}</p><button onClick={() => save(entries.filter((item) => item.id !== entry.id))} aria-label="Delete entry"><Icon icon="fa-solid fa-trash"/></button></article>)}{!entries.length && <div className="journal-empty"><Icon icon="fa-regular fa-moon"/><strong>A clean page for the journey</strong><span>Your first entry can be as small as one sentence.</span></div>}</div></section>
}
