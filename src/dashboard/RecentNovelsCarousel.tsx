import { useRef } from 'react'
import Icon from '../components/Icon'
import { timeAgo } from '../utils/dates'

export default function RecentNovelsCarousel({ rankedNovels, currentNovel, onOpen }: any) {
  const railRef = useRef<HTMLDivElement>(null)
  const ranked = (rankedNovels || []).slice(0, 8)
  const scroll = (direction: number) => railRef.current?.scrollBy({ left: direction * Math.max(280, railRef.current.clientWidth * 0.72), behavior: 'smooth' })
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      scroll(event.key === 'ArrowRight' ? 1 : -1)
    }
  }

  return <section className="moon-recent-novels" aria-labelledby="recent-novels-title">
    <div className="moon-recent-novels-heading">
      <div><p className="moon-kicker">Your writing shelf</p><h2 id="recent-novels-title">Recent novels</h2><span>Pick up where the story is warm.</span></div>
      <div className="moon-carousel-controls"><button type="button" onClick={() => scroll(-1)} aria-label="Previous novels"><Icon icon="fa-solid fa-arrow-left" /></button><button type="button" onClick={() => scroll(1)} aria-label="Next novels"><Icon icon="fa-solid fa-arrow-right" /></button></div>
    </div>
    <div className="moon-novel-rail" ref={railRef} tabIndex={0} onKeyDown={onKeyDown} aria-label="Recent novels carousel">
      {ranked.map(({ novel, activityAt, activityKind, timeOfDayMatch, latestChapter }) => {
        const cover = novel.layout?.cover?.frontImage || novel.cover
        const recommended = currentNovel?.id === novel.id && timeOfDayMatch
        return <article className={`moon-novel-card ${currentNovel?.id === novel.id ? 'is-current' : ''}`} key={novel.id}>
          <button type="button" className="moon-novel-card-open" onClick={() => onOpen(novel)} aria-label={`Open ${novel.title || 'Untitled story'}`}>
            <span className="moon-novel-cover">{cover ? <img src={cover} alt="" /> : <><span>☾</span><small>MS</small></>}</span>
            <span className="moon-novel-copy"><span className="moon-novel-status">{recommended ? 'Recommended now' : activityKind === 'chapter' ? 'Recently edited' : 'In progress'}</span><strong>{novel.title || 'Untitled story'}</strong><span>{latestChapter?.title || 'No chapter opened yet'}</span><small>{activityAt ? `Edited ${timeAgo(activityAt)}` : 'Waiting for its first page'}</small></span><Icon icon="fa-solid fa-arrow-up-right-from-square" />
          </button>
        </article>
      })}
    </div>
  </section>
}
