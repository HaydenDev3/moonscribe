import { useCallback, useMemo } from 'react'
import Icon from '../components/Icon'
import { formatWords } from '../utils/words'
import ReactBitsDriftWall, { type DriftWallItem } from '../components/DriftWall'
import LandingEditorPreview from '../components/LandingEditorPreview'
import './drift-wall.css'

type DriftWallProps = { data?: any; onOpenFeature?: () => void }

export default function DriftWall({ data: suppliedData, onOpenFeature }: DriftWallProps) {
  const data = suppliedData || { currentNovel: { id: 'demo', title: 'The Last Light' }, weekWords: 8420, todayWords: 1240, recentChapters: [{ id: 1 }, { id: 2 }, { id: 3 }], streak: 4 }
  const currentNovel = data.currentNovel
  const destination = useCallback((path: string) => onOpenFeature ? '/?signin=1' : path, [onOpenFeature])
  const items = useMemo<DriftWallItem[]>(() => [
    { title: 'Write', content: <LandingEditorPreview mode="write" />, href: destination(currentNovel ? `/novel/${currentNovel.id}` : '/dashboard') },
    { title: 'Plan', content: <LandingEditorPreview mode="plan" />, href: destination(currentNovel ? `/novel/${currentNovel.id}/relationships` : '/dashboard') },
    { title: 'Design', content: <LandingEditorPreview mode="design" />, href: destination(currentNovel ? `/novel/${currentNovel.id}/design` : '/dashboard') },
    { title: 'Manuscript', content: <LandingEditorPreview mode="write" />, href: destination('/dashboard?view=library') },
    { title: 'Story map', content: <LandingEditorPreview mode="plan" />, href: destination(currentNovel ? `/novel/${currentNovel.id}/relationships` : '/dashboard') },
    { title: 'Print preview', content: <LandingEditorPreview mode="design" />, href: destination(currentNovel ? `/novel/${currentNovel.id}/design` : '/dashboard') },
    { title: 'Writing room', content: <LandingEditorPreview mode="write" />, href: destination(currentNovel ? `/novel/${currentNovel.id}` : '/dashboard') },
    { title: 'Book studio', content: <LandingEditorPreview mode="design" />, href: destination(currentNovel ? `/novel/${currentNovel.id}/design` : '/dashboard') },
  ], [currentNovel, destination])

  return <section className="drift-wall-section" aria-labelledby="drift-wall-title">
    <div className="drift-wall-heading"><div><span className="dashboard-section-label">The MoonScribe studio</span><h2 id="drift-wall-title">A living map of your story tools.</h2><p>Hover a preview to bring it forward. Open one to keep going.</p></div><span className="drift-wall-badge"><i /> {data.streak || 0} day streak</span></div>
    <div className="drift-wall-viewport"><ReactBitsDriftWall items={items} columns={4} tileWidth={220} tileHeight={146} gap={18} tilt={13} turn={-8} speed={34} lift={70} fade={0.45} dim={0.72} overlayColor="#08090e" grayscale={false} pauseOnHover={false} /></div>
    {onOpenFeature && <button className="drift-wall-cta" type="button" onClick={onOpenFeature}><Icon icon="fa-solid fa-arrow-right" /> Explore the studio</button>}
  </section>
}
