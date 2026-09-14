import { useMemo, useState, useEffect, type CSSProperties, type ReactNode } from 'react'
import Icon from '../components/Icon'
import BookShelf from '../components/books/BookShelf'
import { safeWebsiteUrl, type AuthorWebsite, type WebsiteBlock, type WebsiteBook, type WebsitePage } from './model'

const NAV = [
  ['home', 'Home'],
  ['books', 'Books'],
  ['about', 'About'],
  ['journal', 'Journal'],
  ['contact', 'Contact'],
]
const THEMES = {
  moonlight:
    'bg-[#080b0e] text-[#f2eadf] [--surface:#0d1216] [--muted:#a8a29a] [--line:rgba(255,255,255,.13)]',
  parchment:
    'bg-[#ede2ce] text-[#32251d] [--surface:#f5ecdd] [--muted:#705e50] [--line:rgba(59,43,32,.2)]',
  ember:
    'bg-[#100b09] text-[#f3e7dc] [--surface:#1a110e] [--muted:#b49c8b] [--line:rgba(229,164,111,.2)]',
  midnight:
    'bg-[#060910] text-[#e8e6df] [--surface:#0b111c] [--muted:#9ca7b7] [--line:rgba(185,168,117,.2)]',
}
const SPACE = {
  compact: 'py-8 md:py-10',
  comfortable: 'py-10 md:py-14',
  spacious: 'py-14 md:py-20',
}
const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
const icon = (kind?: string) =>
  kind === 'instagram'
    ? 'fa-brands fa-instagram'
    : kind === 'x'
      ? 'fa-brands fa-x-twitter'
      : kind === 'youtube'
        ? 'fa-brands fa-youtube'
        : kind === 'github'
          ? 'fa-brands fa-github'
          : 'fa-solid fa-link'

type AuthorSiteProps = {
  site: AuthorWebsite
  compact?: boolean
  aboutOnly?: boolean
  counts?: Record<string, any>
  pageId?: string
  editable?: boolean
  selectedSectionId?: string
  onSelectSection?: (id: string) => void
  onEditSection?: (id: string) => void
  onUpdateSite?: (patch: Partial<AuthorWebsite>) => void
  onDeleteSection?: (id: string) => void
  onMoveSection?: (id: string, delta: number) => void
}
export default function AuthorSite({
  site,
  compact = false,
  aboutOnly = false,
  counts = {},
  pageId,
  editable = false,
  selectedSectionId,
  onSelectSection,
  onEditSection,
  onUpdateSite,
  onDeleteSection,
  onMoveSection,
}: AuthorSiteProps) {
  const [menu, setMenu] = useState(false)
  const socials = site.links.filter((l) => l.kind && !['contact', 'website'].includes(l.kind))
  const style = { '--accent': site.accent, '--site-bg': site.background } as CSSProperties
  const page =
    site.pages?.find((p) => p.id === pageId) ||
    site.pages?.find((p) => p.homepage) ||
    site.pages?.[0]
  return (
    <div
      style={style}
      className={`author-site-root ${compact ? 'author-site-compact' : ''} min-h-full overflow-x-hidden ${THEMES[site.theme]} ${site.typography === 'modern' ? 'font-sans' : 'font-serif'}`}
    >
      <SiteHeader site={site} socials={socials} menu={menu} setMenu={setMenu} compact={compact} />
      {aboutOnly ? (
        <AboutPage site={site} />
      ) : page ? (
        <PageSections
          page={page}
          site={site}
          counts={counts}
          editable={editable}
          selectedSectionId={selectedSectionId}
          onSelectSection={onSelectSection}
          onEditSection={onEditSection}
          onUpdateSite={onUpdateSite}
          onDeleteSection={onDeleteSection}
          onMoveSection={onMoveSection}
        />
      ) : (
        <>
          <Hero site={site} />
          <Books site={site} counts={counts} />
          <About site={site} />
          <Blocks site={site} />
          {site.journalEnabled && <Journal site={site} />}
        </>
      )}
      <Footer site={site} socials={socials} />
    </div>
  )
}

function PageSections({
  page,
  site,
  counts,
  editable = false,
  selectedSectionId,
  onSelectSection,
  onEditSection,
  onUpdateSite,
  onDeleteSection,
  onMoveSection,
}: {
  page: WebsitePage
  site: AuthorWebsite
  counts: Record<string, any>
  editable?: boolean
  selectedSectionId?: string
  onSelectSection?: (id: string) => void
  onEditSection?: (id: string) => void
  onUpdateSite?: (patch: Partial<AuthorWebsite>) => void
  onDeleteSection?: (id: string) => void
  onMoveSection?: (id: string, delta: number) => void
}) {
  const labels: Record<string, string> = {
    hero: 'Hero',
    books: 'Books',
    about: 'About',
    journal: 'Journal',
    quote: 'Quote',
    newsletter: 'Newsletter',
    contact: 'Contact',
  }
  return (
    <>
      {page.sections
        .filter((section) => section.visible !== false)
        .map((section) => {
          let content: ReactNode
          switch (section.type) {
            case 'hero':
              content = (
                <Hero
                  site={site}
                  editable
                  onActivate={() => onSelectSection?.(section.id)}
                  onUpdate={onUpdateSite}
                />
              )
              break
            case 'books':
              content = <Books site={site} counts={counts} editable onUpdate={onUpdateSite} onActivate={() => onSelectSection?.(section.id)} />
              break
            case 'about':
              content = <About site={site} editable onUpdate={onUpdateSite} onActivate={() => onSelectSection?.(section.id)} />
              break
            case 'journal':
              content = site.journalEnabled ? <Journal site={site} editable onUpdate={onUpdateSite} onActivate={() => onSelectSection?.(section.id)} /> : null
              break
            case 'quote':
              content = (
                <Blocks
                  site={{
                    ...site,
                    blocks: [
                      {
                        id: section.id,
                        kind: 'quote',
                        heading: site.heroQuote,
                        body: '',
                        visible: true,
                      },
                    ],
                  }}
                  editable
                  onActivate={() => onSelectSection?.(section.id)}
                  onCommitBlock={(_, field, value) => field === 'heading' && onUpdateSite?.({ heroQuote: value })}
                />
              )
              break
            case 'newsletter':
              content = (
                <Blocks
                  site={{
                    ...site,
                    blocks: [
                      {
                        id: section.id,
                        kind: 'newsletter',
                        heading: 'Stay in the story',
                        body: 'Subscribe for new releases and notes from the author.',
                        visible: true,
                      },
                    ],
                  }}
                  editable
                  onActivate={() => onSelectSection?.(section.id)}
                  onCommitBlock={(block, field, value) => {
                    if (field !== 'heading' && field !== 'body') return
                    const existing = site.blocks.find((item) => item.id === block.id)
                    onUpdateSite?.({
                      blocks: existing
                        ? site.blocks.map((item) => item.id === block.id ? { ...item, [field]: value } : item)
                        : [...site.blocks, { ...block, [field]: value }],
                    })
                  }}
                />
              )
              break
            case 'contact':
              content = <Footer site={site} socials={site.links} editable onUpdate={onUpdateSite} onActivate={() => onSelectSection?.(section.id)} />
              break
            default:
              content = null
          }
          if (!content) return null
          if (!editable) return <div key={section.id}>{content}</div>
          const label = labels[section.type] || 'Component'
          return (
            <div
              key={section.id}
              className={`author-editor-boundary ${selectedSectionId === section.id ? 'is-selected' : ''}`}
              data-component-id={section.id}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('button,a,input,textarea,select')) return
                onSelectSection?.(section.id)
              }}
            >
              <div
                className="author-editor-boundary-toolbar"
                role="toolbar"
                aria-label={`${label} component controls`}
              >
                <span>{label}</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onEditSection?.(section.id)
                  }}
                  aria-label={`Edit ${label}`}
                >
                  <Icon icon="fa-solid fa-pen" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onMoveSection?.(section.id, -1)
                  }}
                  aria-label={`Move ${label} up`}
                >
                  <Icon icon="fa-solid fa-arrow-up" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onMoveSection?.(section.id, 1)
                  }}
                  aria-label={`Move ${label} down`}
                >
                  <Icon icon="fa-solid fa-arrow-down" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDeleteSection?.(section.id)
                  }}
                  aria-label={`Delete ${label}`}
                >
                  <Icon icon="fa-solid fa-trash" />
                </button>
              </div>
              {content}
            </div>
          )
        })}
    </>
  )
}

function FollowButton({ authorName, compact = false }: { authorName: string; compact?: boolean }) {
  const key = `moonscribe:following:${authorName.trim().toLowerCase()}`
  const [following, setFollowing] = useState(false)
  useEffect(() => {
    try {
      setFollowing(window.localStorage.getItem(key) === '1')
    } catch {
      /* follow state is optional */
    }
  }, [key])
  const toggle = () => {
    setFollowing((value) => {
      const next = !value
      try {
        window.localStorage.setItem(key, next ? '1' : '0')
      } catch {
        /* follow state is optional */
      }
      return next
    })
  }
  return (
    <button
      type="button"
      aria-pressed={following}
      onClick={toggle}
      className={`${compact ? '' : 'ml-2 '}rounded-lg border border-[var(--accent)] px-5 py-2 text-sm text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-black`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
function SiteHeader({
  site,
  socials,
  menu,
  setMenu,
  compact = false,
}: {
  site: AuthorWebsite
  socials: AuthorWebsite['links']
  menu: boolean
  setMenu: (v: boolean) => void
  compact?: boolean
}) {
  const desktopNav = !compact
  return (
    <header
      id="home"
      className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color:var(--surface)]/95 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-5 px-5 md:px-8">
        <button onClick={() => jump('home')} className="flex min-w-0 items-center gap-3">
          <span className="text-3xl text-[var(--accent)]">☾</span>
          <strong className="truncate text-lg font-normal md:text-xl">
            {site.authorName || 'Your name'}
          </strong>
        </button>
        {desktopNav && (
          <nav className="ml-auto hidden items-center gap-7 text-sm lg:flex">
            {NAV.map(
              ([id, label]) =>
                (id !== 'journal' || site.journalEnabled) && (
                  <button
                    key={id}
                    onClick={() => jump(id)}
                    className="border-b border-transparent py-2 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-inherit"
                  >
                    {label}
                  </button>
                )
            )}
          </nav>
        )}
        {desktopNav && (
          <div className="hidden items-center gap-3 md:flex">
            {socials.slice(0, 4).map((l) => (
              <a
                key={l.id}
                href={safeWebsiteUrl(l.url)}
                aria-label={l.label}
                className="text-[var(--muted)] hover:text-[var(--accent)]"
              >
                <Icon icon={icon(l.kind)} />
              </a>
            ))}
            <FollowButton authorName={site.authorName} />
          </div>
        )}
        {!desktopNav && (
          <button
            className="ml-auto grid h-11 w-11 items-center justify-center text-2xl"
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-label={menu ? 'Close navigation' : 'Open navigation'}
          >
            <Icon icon={menu ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'} />
          </button>
        )}
      </div>
      {menu && (
        <div className="border-t border-[var(--line)] bg-[color:var(--surface)] px-5 py-5">
          <nav className="grid">
            {NAV.map(
              ([id, label]) =>
                (id !== 'journal' || site.journalEnabled) && (
                  <button
                    key={id}
                    onClick={() => {
                      jump(id)
                      setMenu(false)
                    }}
                    className="rounded-lg px-4 py-3 text-left text-lg hover:bg-white/5"
                  >
                    {label}
                  </button>
                )
            )}
          </nav>
          <div className="mt-4 flex items-center gap-5 border-t border-[var(--line)] pt-5">
            {socials.map((l) => (
              <a key={l.id} href={safeWebsiteUrl(l.url)} aria-label={l.label}>
                <Icon icon={icon(l.kind)} />
              </a>
            ))}
            <FollowButton authorName={site.authorName} compact />
          </div>
        </div>
      )}
    </header>
  )
}

function EditableText({
  value,
  editable,
  className,
  onActivate,
  onCommit,
}: {
  value: string
  editable?: boolean
  className?: string
  onActivate?: () => void
  onCommit?: (value: string) => void
}) {
  return (
    <span
      className={className}
      contentEditable={editable}
      suppressContentEditableWarning
      onClick={(event) => {
        if (editable) {
          event.stopPropagation()
          onActivate?.()
        }
      }}
      onFocus={onActivate}
      onBlur={(event) => onCommit?.(event.currentTarget.textContent || '')}
    >
      {value}
    </span>
  )
}

function Hero({
  site,
  editable = false,
  onUpdate,
  onActivate,
}: {
  site: AuthorWebsite
  editable?: boolean
  onUpdate?: (patch: Partial<AuthorWebsite>) => void
  onActivate?: () => void
}) {
  const bg = site.heroImage
    ? {
        backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.94),rgba(0,0,0,${site.heroOverlay / 100}),rgba(0,0,0,.2)),url(${site.heroImage})`,
      }
    : {
        backgroundImage:
          'radial-gradient(circle at 78% 36%,rgba(214,166,75,.24),transparent 22%),linear-gradient(125deg,#05080b 18%,#10202c 64%,#2d2117)',
      }
  return (
    <section
      className="relative min-h-[560px] border-b border-[var(--line)] bg-cover bg-center"
      style={bg}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
      <div className="relative mx-auto flex min-h-[560px] max-w-[1180px] items-center px-6 py-16 md:px-10 lg:py-24">
        <div className="max-w-2xl">
          <p className="mb-4 text-xs font-semibold tracking-[.24em] text-[var(--accent)]">
            <EditableText
              value={site.heroEyebrow}
              editable={editable}
              onActivate={onActivate}
              onCommit={(value) => onUpdate?.({ heroEyebrow: value })}
            />
          </p>
          <h1 className="text-5xl font-normal leading-[.9] tracking-[-.035em] text-[#f5ead8] sm:text-6xl lg:text-8xl">
            <EditableText
              value={site.authorName || 'Your name'}
              editable={editable}
              onActivate={onActivate}
              onCommit={(value) => onUpdate?.({ authorName: value })}
            />
          </h1>
          <p className="mt-5 text-2xl italic text-[#f0dfc8] md:text-3xl">
            <EditableText
              value={site.tagline}
              editable={editable}
              onActivate={onActivate}
              onCommit={(value) => onUpdate?.({ tagline: value })}
            />
          </p>
          <p className="mt-5 max-w-xl font-sans text-sm leading-7 text-white/70 md:text-base">
            <EditableText
              value={site.intro || site.bio}
              editable={editable}
              onActivate={onActivate}
              onCommit={(value) => onUpdate?.({ intro: value })}
            />
          </p>
          {site.genres.length > 0 && (
            <p className="mt-4 font-sans text-xs uppercase tracking-[.16em] text-white/55">
              {site.genres.join(' · ')}
            </p>
          )}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => jump('books')}
              className="rounded-lg bg-[var(--accent)] px-6 py-3 font-sans text-sm font-semibold text-[#17120b] shadow-xl hover:-translate-y-0.5"
            >
              <EditableText
                value={site.primaryCta}
                editable={editable}
                onActivate={onActivate}
                onCommit={(value) => onUpdate?.({ primaryCta: value })}
              />{' '}
              <span className="ml-2">→</span>
            </button>
            {site.newsletterUrl && (
              <a
                href={safeWebsiteUrl(site.newsletterUrl) || '#'}
                className="rounded-lg border border-[var(--accent)] px-6 py-3 text-center font-sans text-sm text-[#f2eadf] hover:bg-white/5"
              >
                <EditableText
                  value={site.secondaryCta || 'Subscribe'}
                  editable={editable}
                  onActivate={onActivate}
                  onCommit={(value) => onUpdate?.({ secondaryCta: value })}
                />
              </a>
            )}
          </div>
        </div>
        {site.heroQuote && (
          <blockquote className="absolute bottom-8 right-8 hidden max-w-[220px] text-lg italic text-[var(--accent)] lg:block">
            <EditableText
              value={site.heroQuote}
              editable={editable}
              onActivate={onActivate}
              onCommit={(value) => onUpdate?.({ heroQuote: value })}
            />
          </blockquote>
        )}
      </div>
    </section>
  )
}

function Books({ site, counts, editable = false, onUpdate, onActivate }: { site: AuthorWebsite; counts?: Record<string, any>; editable?: boolean; onUpdate?: (patch: Partial<AuthorWebsite>) => void; onActivate?: () => void }) {
  const books = useMemo(() => [...site.books].sort((a, b) => a.order - b.order), [site.books])
  return (
    <section id="books" className={`border-b border-[var(--line)] ${SPACE[site.sectionSpacing]}`}>
      <div className="mx-auto max-w-[1180px] px-5 md:px-8">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[.2em] text-[var(--accent)]">
              <EditableText value={site.booksEyebrow} editable={editable} onActivate={onActivate} onCommit={(value) => onUpdate?.({ booksEyebrow: value })} />
            </span>
            <h2 className="text-3xl font-normal md:text-4xl"><EditableText value={site.booksHeading} editable={editable} onActivate={onActivate} onCommit={(value) => onUpdate?.({ booksHeading: value })} /></h2>
          </div>
          <span className="text-sm text-[var(--accent)]">
            {books.length} {books.length === 1 ? 'book' : 'books'}
          </span>
        </div>
        {books.length ? (
          <BookShelf
            books={books.map((book) => ({
              ...book,
              author: site.authorName,
              description: site.showBookDescriptions ? book.description : '',
              status: site.showBookStatus ? book.status : '',
            }))}
            counts={counts}
            publicMode
            initialView={site.booksView || 'list'}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[color:var(--surface)] p-10 text-center font-sans text-[var(--muted)]">
            Select books in the builder to feature them here.
          </div>
        )}
      </div>
    </section>
  )
}
function BookCard({ book, site }: { book: WebsiteBook; site: AuthorWebsite }) {
  return (
    <article className="grid w-[82vw] max-w-[360px] flex-none snap-start grid-cols-[105px_1fr] gap-4 rounded-xl border border-[var(--line)] bg-[color:var(--surface)] p-3.5 md:w-auto md:max-w-none">
      <div className="aspect-[2/3] overflow-hidden rounded-md bg-gradient-to-br from-slate-700 to-slate-950 shadow-xl">
        {book.cover ? (
          <img
            src={book.cover}
            alt={`${book.title} cover`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-3xl text-[var(--accent)]">☾</div>
        )}
      </div>
      <div className="flex min-w-0 flex-col py-2">
        <h3 className="text-xl leading-tight">{book.title}</h3>
        {site.showBookStatus && book.status && (
          <span className="mt-2 font-sans text-[10px] uppercase tracking-[.18em] text-[var(--accent)]">
            {book.status}
          </span>
        )}
        {site.showBookDescriptions && book.description && (
          <p className="mt-2 line-clamp-3 font-sans text-xs leading-5 text-[var(--muted)]">
            {book.description}
          </p>
        )}
        <a
          href={safeWebsiteUrl(book.url || '') || '#'}
          className="mt-auto rounded-md border border-[var(--accent)] px-3 py-2 text-center font-sans text-xs text-[var(--accent)]"
        >
          Learn more <span className="ml-2">→</span>
        </a>
      </div>
    </article>
  )
}

function About({ site, editable = false, onUpdate, onActivate }: { site: AuthorWebsite; editable?: boolean; onUpdate?: (patch: Partial<AuthorWebsite>) => void; onActivate?: () => void }) {
  const aboutHref = window.location.pathname.startsWith('/@')
    ? `${window.location.pathname.split('/')[1]}/about`
    : '#about'
  return (
    <section id="about" className={SPACE[site.sectionSpacing]}>
      <div className="mx-auto grid max-w-[1180px] gap-7 px-5 md:grid-cols-[minmax(240px,.72fr)_1.3fr_.7fr] md:items-center md:px-8">
        <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-br from-slate-700 to-slate-950">
          {site.profileImage ? (
            <img
              src={site.profileImage}
              alt={site.authorName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-7xl text-[var(--accent)]">☾</div>
          )}
        </div>
        <div>
          <h2 className="text-3xl font-normal md:text-4xl"><EditableText value={site.aboutHeading} editable={editable} onActivate={onActivate} onCommit={(value) => onUpdate?.({ aboutHeading: value })} /></h2>
          <p className="mt-4 font-sans text-sm leading-7 text-[var(--muted)]">
            <EditableText
              value={site.aboutText || site.bio || `I'm ${site.authorName || 'an author'}, a writer of mysterious worlds and the quiet moments in between.`}
              editable={editable}
              onActivate={onActivate}
              onCommit={(value) => onUpdate?.({ aboutText: value })}
            />
          </p>
          <a href={aboutHref} className="mt-5 inline-block text-sm text-[var(--accent)]">
            Read more about me →
          </a>
        </div>
        <ul className="grid gap-4 border-t border-[var(--line)] pt-6 font-sans text-sm text-[var(--muted)] md:border-l md:border-t-0 md:pl-8 md:pt-0">
          {site.interests.map((x, i) => (
            <li key={`${x}-${i}`} className="flex items-center gap-3">
              <Icon
                icon={
                  [
                    'fa-regular fa-bookmark',
                    'fa-solid fa-pen-nib',
                    'fa-regular fa-moon',
                    'fa-solid fa-compass',
                  ][i % 4]
                }
              />
              <EditableText value={x} editable={editable} onActivate={onActivate} onCommit={(value) => onUpdate?.({ interests: site.interests.map((interest, index) => index === i ? value : interest) })} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
function AboutPage({ site }: { site: AuthorWebsite }) {
  return (
    <main className="border-b border-[var(--line)]">
      <div className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
        <p className="font-sans text-xs font-semibold uppercase tracking-[.24em] text-[var(--accent)]">
          About the author
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-normal leading-none md:text-7xl">
          {site.authorName || 'Your name'}
        </h1>
        <p className="mt-6 max-w-2xl text-2xl italic text-[var(--accent)]">{site.tagline}</p>
        <div className="mt-12 grid gap-10 md:grid-cols-[minmax(260px,.7fr)_1.3fr] md:items-start">
          <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-br from-slate-700 to-slate-950">
            {site.profileImage ? (
              <img
                src={site.profileImage}
                alt={site.authorName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-8xl text-[var(--accent)]">☾</div>
            )}
          </div>
          <div>
            <h2 className="text-3xl font-normal">{site.aboutHeading}</h2>
            <p className="mt-5 max-w-2xl whitespace-pre-line font-sans text-base leading-8 text-[var(--muted)]">
              {site.aboutText ||
                site.bio ||
                `I'm ${site.authorName || 'an author'}, a writer of mysterious worlds and the quiet moments in between.`}
            </p>
            <ul className="mt-8 grid gap-4 border-t border-[var(--line)] pt-6 font-sans text-sm text-[var(--muted)] sm:grid-cols-2">
              {site.interests.map((x, i) => (
                <li key={`${x}-${i}`} className="flex items-center gap-3">
                  <Icon
                    icon={
                      [
                        'fa-regular fa-bookmark',
                        'fa-solid fa-pen-nib',
                        'fa-regular fa-moon',
                        'fa-solid fa-compass',
                      ][i % 4]
                    }
                  />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}

function Journal({ site, editable = false, onUpdate, onActivate }: { site: AuthorWebsite; editable?: boolean; onUpdate?: (patch: Partial<AuthorWebsite>) => void; onActivate?: () => void }) {
  const posts = site.posts.filter((p) => p.published).slice(0, 3)
  return (
    <section id="journal" className={`border-t border-[var(--line)] ${SPACE[site.sectionSpacing]}`}>
      <div className="mx-auto max-w-[1180px] px-5 md:px-8">
        <h2 className="text-3xl font-normal md:text-4xl"><EditableText value={site.journalHeading} editable={editable} onActivate={onActivate} onCommit={(value) => onUpdate?.({ journalHeading: value })} /></h2>
        {posts.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {posts.map((p) => (
              <article
                key={p.id}
                className="rounded-xl border border-[var(--line)] bg-[color:var(--surface)] p-6"
              >
                <time className="font-sans text-[10px] uppercase tracking-[.15em] text-[var(--accent)]">
                  {p.date}
                </time>
                <h3 className="mt-3 text-xl"><EditableText value={p.title} editable={editable} onActivate={onActivate} onCommit={(value) => onUpdate?.({ posts: site.posts.map((post) => post.id === p.id ? { ...post, title: value } : post) })} /></h3>
                <p className="mt-3 font-sans text-sm leading-6 text-[var(--muted)]"><EditableText value={p.excerpt} editable={editable} onActivate={onActivate} onCommit={(value) => onUpdate?.({ posts: site.posts.map((post) => post.id === p.id ? { ...post, excerpt: value } : post) })} /></p>
                <a
                  href={safeWebsiteUrl(p.url || '') || '#'}
                  className="mt-5 inline-block text-sm text-[var(--accent)]"
                >
                  Read more →
                </a>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 font-sans text-sm text-[var(--muted)]">
            Published posts will appear here.
          </p>
        )}
      </div>
    </section>
  )
}

function Blocks({ site, editable = false, onUpdate, onActivate, onCommitBlock }: { site: AuthorWebsite; editable?: boolean; onUpdate?: (patch: Partial<AuthorWebsite>) => void; onActivate?: () => void; onCommitBlock?: (block: WebsiteBlock, field: 'heading' | 'body', value: string) => void }) {
  const blocks = site.blocks.filter((block) => block.visible)
  if (!blocks.length) return null
  const commit = (block: WebsiteBlock, field: 'heading' | 'body', value: string) => {
    if (onCommitBlock) onCommitBlock(block, field, value)
    else onUpdate?.({ blocks: site.blocks.map((item) => item.id === block.id ? { ...item, [field]: value } : item) })
  }
  return (
    <section className={`${SPACE[site.sectionSpacing]} border-t border-[var(--line)]`}>
      <div className="mx-auto grid max-w-[1180px] gap-4 px-5 md:px-8 md:grid-cols-2">
        {blocks.map((block) => (
          <article
            key={block.id}
            className="rounded-2xl border border-[var(--line)] bg-[color:var(--surface)] p-6"
          >
            <span className="font-sans text-[10px] uppercase tracking-[.2em] text-[var(--accent)]">
              {block.kind}
            </span>
            <h2 className="mt-3 text-2xl"><EditableText value={block.heading} editable={editable} onActivate={onActivate} onCommit={(value) => commit(block, 'heading', value)} /></h2>
            <p className="mt-3 whitespace-pre-line font-sans text-sm leading-7 text-[var(--muted)]"><EditableText value={block.body} editable={editable} onActivate={onActivate} onCommit={(value) => commit(block, 'body', value)} /></p>
            {block.url && (
              <a
                href={safeWebsiteUrl(block.url) || '#'}
                className="mt-5 inline-block text-sm text-[var(--accent)]"
              >
                Explore <span aria-hidden="true">→</span>
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
function Footer({ site, socials, editable = false, onUpdate, onActivate }: { site: AuthorWebsite; socials: AuthorWebsite['links']; editable?: boolean; onUpdate?: (patch: Partial<AuthorWebsite>) => void; onActivate?: () => void }) {
  return (
    <footer id="contact" className="border-t border-[var(--line)] bg-[color:var(--surface)]">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-5 py-7 font-sans text-xs text-[var(--muted)] md:flex-row md:items-center md:px-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl text-[var(--accent)]">☾</span>
          <strong className="font-serif text-lg font-normal">
            <EditableText value={site.authorName || site.title} editable={editable} onActivate={onActivate} onCommit={(value) => onUpdate?.({ authorName: value })} />
          </strong>
        </div>
        <p className="md:mx-auto md:italic"><EditableText value={site.heroQuote || site.tagline} editable={editable} onActivate={onActivate} onCommit={(value) => onUpdate?.({ heroQuote: value })} /></p>
        <div className="flex flex-wrap items-center gap-4">
          {socials.map((l) => (
            <a key={l.id} href={safeWebsiteUrl(l.url)} aria-label={l.label}>
              <Icon icon={icon(l.kind)} />
            </a>
          ))}
          {safeWebsiteUrl(site.newsletterUrl) && (
            <a href={safeWebsiteUrl(site.newsletterUrl)}>Newsletter</a>
          )}
          {safeWebsiteUrl(site.mediaKitUrl) && (
            <a href={safeWebsiteUrl(site.mediaKitUrl)}>Media kit</a>
          )}
          {safeWebsiteUrl(site.privacyUrl) && <a href={safeWebsiteUrl(site.privacyUrl)}>Privacy</a>}
          {safeWebsiteUrl(site.contactUrl) && <a href={safeWebsiteUrl(site.contactUrl)}>Contact</a>}
        </div>
      </div>
      {site.showMoonScribe && (
        <div className="border-t border-[var(--line)] py-3 text-center font-sans text-[10px] tracking-[.18em] text-[var(--muted)]">
          MADE WITH <span className="text-[var(--accent)]">MOONSCRIBE</span>
        </div>
      )}
    </footer>
  )
}
