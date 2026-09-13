import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import ThemedSelect from '../components/Select'
import WebsiteLoading from '../components/WebsiteLoading'
import { useApp } from '../context/AppContext'
import { getAuthorWebsite, saveAuthorWebsite } from '../db/authorWebsite'
import { getConfig } from '../sync/engine'
import AuthorSite from '../websites/AuthorSite'
import {
  defaultAuthorWebsite,
  normalizeAuthorWebsite,
  WEBSITE_THEMES,
  type AuthorWebsite as Site,
  type WebsitePage,
  type WebsiteSectionType,
} from '../websites/model'
import '../styles/authorWebsiteBuilder.css'
import '../styles/authorWebsiteMobile.css'

type Tab = 'sections' | 'pages' | 'design' | 'content'
type Device = 'desktop' | 'tablet' | 'mobile'
type Inspector = 'page' | 'section' | 'element'
type Status = 'saved' | 'dirty' | 'saving' | 'draft-saved' | 'publishing' | 'published' | 'failed'
const control =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-[#10151a] px-3 py-2 text-[12px] text-[#eee8de] outline-none focus:border-[#d6a64b]/70'
const catalog: { type: WebsiteSectionType; name: string; group: string; icon: string }[] = [
  ['hero', 'Hero', 'ESSENTIALS', 'fa-solid fa-t'],
  ['about', 'About', 'ESSENTIALS', 'fa-regular fa-user'],
  ['books', 'Books', 'ESSENTIALS', 'fa-solid fa-book-open'],
  ['newsletter', 'Newsletter', 'ESSENTIALS', 'fa-regular fa-envelope'],
  ['contact', 'Contact', 'ESSENTIALS', 'fa-regular fa-paper-plane'],
  ['quote', 'Quotes', 'ESSENTIALS', 'fa-solid fa-quote-left'],
  ['gallery', 'Gallery', 'MEDIA', 'fa-regular fa-images'],
  ['video', 'Video', 'MEDIA', 'fa-solid fa-play'],
  ['audio', 'Audio', 'MEDIA', 'fa-solid fa-music'],
  ['journal', 'Blog', 'EXTRAS', 'fa-regular fa-newspaper'],
  ['events', 'Events', 'EXTRAS', 'fa-regular fa-calendar'],
  ['faq', 'FAQ', 'EXTRAS', 'fa-regular fa-circle-question'],
  ['timeline', 'Timeline', 'EXTRAS', 'fa-solid fa-route'],
].map(([type, name, group, icon]) => ({ type: type as WebsiteSectionType, name, group, icon }))
const label = (x: string) => <span className="builder-label">{x}</span>

export default function AuthorWebsiteBuilder() {
  const [mobileWorkspace, setMobileWorkspace] = useState<
    'preview' | 'sections' | 'pages' | 'design' | 'more' | 'inspector'
  >('preview')
  const { settings, syncUsername, toast, syncNow, novels = [] } = useApp() as any
  const nav = useNavigate()
  const [site, setSite] = useState<Site>()
  const [tab, setTab] = useState<Tab>('sections')
  const [inspector, setInspector] = useState<Inspector>('section')
  const [device, setDevice] = useState<Device>('desktop')
  const [status, setStatus] = useState<Status>('saved')
  const [pageId, setPageId] = useState('home')
  const [selected, setSelected] = useState('hero')
  const [query, setQuery] = useState('')
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null)
  useEffect(() => {
    let ok = true
    const name = settings?.writerName || syncUsername || ''
    getAuthorWebsite(name)
      .then((v) => ok && setSite(normalizeAuthorWebsite(v, name)))
      .catch(() => ok && setSite(defaultAuthorWebsite(name)))
    return () => {
      ok = false
    }
  }, [settings?.writerName, syncUsername])
  const update = useCallback((patch: Partial<Site>) => {
    setSite((s) => (s ? { ...s, ...patch } : s))
    setStatus('dirty')
  }, [])
  const page = site?.pages?.find((p) => p.id === pageId) || site?.pages?.[0]
  const save = useCallback(
    async (silent = true) => {
      if (!site) return
      setStatus('saving')
      try {
        const v = await saveAuthorWebsite(site)
        setSite(normalizeAuthorWebsite(v, site.authorName))
        try {
          await syncNow?.()
        } catch {
          /* retain the local draft */
        }
        setStatus('draft-saved')
        if (!silent) toast?.('Website draft saved.')
        setTimeout(() => setStatus('saved'), 1400)
      } catch (e) {
        setStatus('dirty')
        toast?.(e instanceof Error ? e.message : 'Draft could not be saved.')
      }
    },
    [site, syncNow, toast]
  )
  useEffect(() => {
    if (status !== 'dirty') return
    const t = setTimeout(() => void save(), 1000)
    return () => clearTimeout(t)
  }, [status, save])
  const updatePage = (fn: (p: WebsitePage) => WebsitePage) =>
    page && update({ pages: site?.pages?.map((p) => (p.id === page.id ? fn(p) : p)) })
  const add = (type: WebsiteSectionType) => {
    const id = `${type}-${crypto.randomUUID()}`
    updatePage((p) => ({ ...p, sections: [...p.sections, { id, type, visible: true }] }))
    setSelected(id)
    setInspector('section')
  }
  const move = (d: number) => {
    if (!page) return
    const i = page.sections.findIndex((s) => s.id === selected),
      j = i + d
    if (i < 0 || j < 0 || j >= page.sections.length) return
    updatePage((p) => {
      const a = [...p.sections]
      ;[a[i], a[j]] = [a[j], a[i]]
      return { ...p, sections: a }
    })
  }
  const moveSection = (sectionId: string, d: number) => {
    if (!page) return
    const i = page.sections.findIndex((s) => s.id === sectionId),
      j = i + d
    if (i < 0 || j < 0 || j >= page.sections.length) return
    updatePage((p) => {
      const a = [...p.sections]
      ;[a[i], a[j]] = [a[j], a[i]]
      return { ...p, sections: a }
    })
    setSelected(sectionId)
  }
  const removeSection = (sectionId: string) => {
    if (!page) return
    setDeleteCandidate(sectionId)
  }
  const confirmRemoveSection = () => {
    if (!page || !deleteCandidate) return
    const sectionId = deleteCandidate
    const index = page.sections.findIndex((s) => s.id === sectionId)
    const next = page.sections.filter((s) => s.id !== sectionId)
    updatePage((p) => ({ ...p, sections: next }))
    setSelected(next[Math.min(index, next.length - 1)]?.id || '')
    setInspector('section')
    setDeleteCandidate(null)
  }
  const publish = async () => {
    if (!site?.authorName.trim()) {
      toast?.('Add an author name before publishing.')
      return
    }
    setStatus('publishing')
    try {
      const c = await getConfig()
      if (!c.server || !c.token) throw Error('Sign in to publish your author website.')
      const draft = normalizeAuthorWebsite({ ...site, published: false }, site.authorName)
      await saveAuthorWebsite(draft)
      let r = await fetch(`${c.server.replace(/\/$/, '')}/api/author-website`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.token}` },
        body: JSON.stringify({ website: draft }),
      })
      if (!r.ok) throw Error('The website draft could not be uploaded.')
      r = await fetch(`${c.server.replace(/\/$/, '')}/api/author-website/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${c.token}` },
      })
      const data = await r.json()
      if (!r.ok) throw Error(data.error || 'Publishing failed.')
      const next = normalizeAuthorWebsite(data.website, site.authorName)
      setSite(next)
      await saveAuthorWebsite(next)
      setStatus('published')
      toast?.(`Published at ${data.url}`)
    } catch (e) {
      setStatus('failed')
      toast?.(e instanceof Error ? e.message : 'Publishing failed.')
    }
  }
  if (!site) return <WebsiteLoading />
  const items = catalog.filter((x) => x.name.toLowerCase().includes(query.toLowerCase()))
  const mobileContent =
    mobileWorkspace === 'preview' ? (
      <div className="mobile-preview-workspace">
        <AuthorSite site={site} pageId={pageId} editable selectedSectionId={selected} onSelectSection={(id) => { setSelected(id); setInspector('section') }} onEditSection={(id) => { setSelected(id); setInspector('section') }} onDeleteSection={removeSection} onMoveSection={moveSection} />
      </div>
    ) : mobileWorkspace === 'sections' ? (
      <MobileSections items={items} add={add} query={query} setQuery={setQuery} />
    ) : mobileWorkspace === 'pages' ? (
      <Pages site={site} page={page} setPageId={setPageId} update={update} />
    ) : mobileWorkspace === 'design' ? (
      <Design site={site} update={update} />
    ) : mobileWorkspace === 'inspector' ? (
      <InspectorPanel
        mode={inspector}
        setMode={setInspector}
        site={site}
        update={update}
        page={page}
        selected={selected}
        move={move}
        onDelete={removeSection}
      />
    ) : (
      <MobileMore
        site={site}
        save={() => void save(false)}
        publish={() => void publish()}
        preview={() => setMobileWorkspace('preview')}
      />
    )
  return (
    <>
      <div className="mobile-builder-shell">
        <div className="mobile-builder-head">
          <button onClick={() => nav('/dashboard')} aria-label="Back to dashboard">
            <Icon icon="fa-solid fa-arrow-left" />
          </button>
          <strong>
            {mobileWorkspace === 'preview'
              ? 'Live preview'
              : mobileWorkspace[0].toUpperCase() + mobileWorkspace.slice(1)}
          </strong>
          <small>{statusText(status)}</small>
        </div>
        <div className="mobile-builder-workspace">{mobileContent}</div>
        <nav className="mobile-builder-nav">
          {(['sections', 'pages', 'preview', 'design', 'more'] as const).map((x) => (
            <button
              className={mobileWorkspace === x ? 'active' : ''}
              onClick={() => setMobileWorkspace(x)}
              key={x}
            >
              <Icon
                icon={
                  x === 'sections'
                    ? 'fa-solid fa-layer-group'
                    : x === 'pages'
                      ? 'fa-regular fa-file-lines'
                      : x === 'preview'
                        ? 'fa-regular fa-eye'
                        : x === 'design'
                          ? 'fa-solid fa-wand-magic-sparkles'
                          : 'fa-solid fa-ellipsis'
                }
              />
              {x === 'more' ? 'More' : x[0].toUpperCase() + x.slice(1)}
            </button>
          ))}
        </nav>
      </div>
      <main className="author-builder">
        <header className="builder-header">
          <button onClick={() => nav('/dashboard')} aria-label="Back">
            <Icon icon="fa-solid fa-arrow-left" />
          </button>
          <span>
            Author Website <b>›</b> {site.authorName || 'Your website'}
          </span>
          <div className="builder-actions">
            <small>{statusText(status)}</small>
            <button className="builder-action">
              <Icon icon="fa-regular fa-eye" />
              Preview
            </button>
            <button
              className="builder-action"
              disabled={!site.published}
              onClick={() =>
                site.published && window.open(`/@${encodeURIComponent(site.authorName)}`, '_blank')
              }
            >
              <Icon icon="fa-solid fa-arrow-up-right-from-square" />
              View live
            </button>
            <button className="builder-action" onClick={() => void save(false)}>
              <Icon icon="fa-regular fa-floppy-disk" />
              Save draft
            </button>
            <button className="builder-publish" onClick={() => void publish()}>
              <Icon icon="fa-solid fa-upload" />
              {status === 'publishing' ? 'Publishing…' : 'Publish'}
            </button>
            <button className="builder-action">
              <Icon icon="fa-solid fa-ellipsis-vertical" />
            </button>
          </div>
        </header>
        <div className="builder-layout">
          <aside className="builder-library">
            <div className="builder-tabs">
              {(['sections', 'pages', 'design', 'content'] as Tab[]).map((t) => (
                <button className={tab === t ? 'active' : ''} onClick={() => setTab(t)} key={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            {tab === 'sections' && (
              <>
                <label className="builder-search">
                  <Icon icon="fa-solid fa-magnifying-glass" />
                  <input
                    placeholder="Search sections..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                {['ESSENTIALS', 'MEDIA', 'EXTRAS'].map((group) => (
                  <div className="builder-group" key={group}>
                    <h3>{group}</h3>
                    <div className="section-grid">
                      {items
                        .filter((x) => x.group === group)
                        .map((x) => (
                          <button className="section-tile" key={x.type} onClick={() => add(x.type)}>
                            <img src="/assets/moonscribebackground.png" alt="" />
                            <span>
                              <Icon icon={x.icon} />
                              {x.name}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </>
            )}
            {tab === 'pages' && (
              <Pages site={site} page={page} setPageId={setPageId} update={update} />
            )}{' '}
            {tab === 'design' && <Design site={site} update={update} />}{' '}
            {tab === 'content' && <Content site={site} update={update} novels={novels} />}
          </aside>
          <section className="builder-preview">
            <div className="preview-head">
              <div className="device-switch">
                {(['desktop', 'tablet', 'mobile'] as Device[]).map((d) => (
                  <button
                    className={device === d ? 'active' : ''}
                    onClick={() => setDevice(d)}
                    key={d}
                  >
                    <Icon
                      icon={
                        d === 'desktop'
                          ? 'fa-solid fa-desktop'
                          : d === 'tablet'
                            ? 'fa-solid fa-tablet-screen-button'
                            : 'fa-solid fa-mobile-screen'
                      }
                    />
                    {d[0].toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
              <div className="preview-tools">
                <button>
                  <Icon icon="fa-solid fa-rotate-left" />
                </button>
                <button>
                  <Icon icon="fa-solid fa-rotate-right" />
                </button>
                <ThemedSelect
                  ariaLabel="Preview page"
                  value={page?.id || 'home'}
                  onChange={setPageId}
                  options={[
                    { value: 'home', label: 'Home' },
                    ...(site.pages
                      ?.filter((x) => x.id !== 'home')
                      .map((x) => ({ value: x.id, label: x.name })) || []),
                  ]}
                />
                <button onClick={() => setInspector('page')}>
                  <Icon icon="fa-solid fa-gear" />
                </button>
              </div>
            </div>
            <div className={`preview-viewport ${device}`}>
              <AuthorSite site={site} pageId={pageId} editable selectedSectionId={selected} onSelectSection={(id) => { setSelected(id); setInspector('section') }} onEditSection={(id) => { setSelected(id); setInspector('section') }} onDeleteSection={removeSection} onMoveSection={moveSection} />
            </div>
          </section>
          <InspectorPanel
            mode={inspector}
            setMode={setInspector}
            site={site}
            update={update}
            page={page}
            selected={selected}
            move={move}
            onDelete={removeSection}
          />
        </div>
        <nav className="builder-mobile-nav">
          <button onClick={() => setTab('sections')}>
            <Icon icon="fa-solid fa-layer-group" />
            Sections
          </button>
          <button>
            <Icon icon="fa-regular fa-eye" />
            Preview
          </button>
          <button onClick={() => setInspector('section')}>
            <Icon icon="fa-solid fa-sliders" />
            Inspector
          </button>
          <button onClick={() => setTab('pages')}>
            <Icon icon="fa-regular fa-file-lines" />
            Pages
          </button>
          <button onClick={() => void publish()}>
            <Icon icon="fa-solid fa-ellipsis" />
            More
          </button>
        </nav>
      </main>
      {deleteCandidate && <DeleteSectionModal onCancel={() => setDeleteCandidate(null)} onConfirm={confirmRemoveSection} />}
    </>
  )
}
function Pages({
  site,
  page,
  setPageId,
  update,
}: {
  site: Site
  page?: WebsitePage
  setPageId: (v: string) => void
  update: (v: Partial<Site>) => void
}) {
  return (
    <div className="builder-content">
      <button
        className="builder-publish w-full"
        onClick={() => {
          const id = `page-${crypto.randomUUID()}`
          update({
            pages: [
              ...(site.pages || []),
              {
                id,
                name: 'New page',
                slug: 'new-page',
                sections: [{ id: `hero-${id}`, type: 'hero' }],
              },
            ],
          })
          setPageId(id)
        }}
      >
        + Add page
      </button>
      {site.pages?.map((p, i) => (
        <div className={`page-item ${p.id === page?.id ? 'selected' : ''}`} key={p.id}>
          <button onClick={() => setPageId(p.id)}>
            <Icon icon="fa-regular fa-file-lines" />
            {p.name}
          </button>
          <span>
            {i > 0 && (
              <button
                onClick={() =>
                  update({
                    pages: site.pages?.map((x, j) =>
                      j === i - 1 ? site.pages![i] : j === i ? site.pages![i - 1] : x
                    ),
                  })
                }
              >
                ↑
              </button>
            )}
            {i < site.pages.length - 1 && (
              <button
                onClick={() =>
                  update({
                    pages: site.pages?.map((x, j) =>
                      j === i + 1 ? site.pages![i] : j === i ? site.pages![i + 1] : x
                    ),
                  })
                }
              >
                ↓
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
function Design({ site, update }: { site: Site; update: (v: Partial<Site>) => void }) {
  return (
    <div className="builder-content">
      <h3 className="subhead">Site theme</h3>
      <div className="theme-grid">
        {WEBSITE_THEMES.map((t) => (
          <button
            className={site.theme === t.id ? 'selected' : ''}
            onClick={() =>
              update({ theme: t.id, accent: t.swatches[2], background: t.swatches[0] })
            }
            key={t.id}
          >
            <span>
              {t.swatches.map((c) => (
                <i style={{ background: c }} key={c} />
              ))}
            </span>
            {t.name}
          </button>
        ))}
      </div>
      <Field label="Accent colour">
        <input
          type="color"
          className="color-field"
          value={site.accent}
          onChange={(e) => update({ accent: e.target.value })}
        />
      </Field>
      <Select
        label="Typography"
        value={site.typography}
        options={['editorial', 'classic', 'modern']}
        onChange={(v) => update({ typography: v as Site['typography'] })}
      />
      <Select
        label="Spacing"
        value={site.sectionSpacing}
        options={['compact', 'comfortable', 'spacious']}
        onChange={(v) => update({ sectionSpacing: v as Site['sectionSpacing'] })}
      />
    </div>
  )
}
function Content({
  site,
  update,
  novels,
}: {
  site: Site
  update: (v: Partial<Site>) => void
  novels: any[]
}) {
  return (
    <div className="builder-content">
      <p className="helper">Only selected public data is published.</p>
      <Field label="Profile bio">
        <textarea
          className={control}
          rows={5}
          value={site.bio}
          onChange={(e) => update({ bio: e.target.value })}
        />
      </Field>
      <h3 className="subhead">Books</h3>
      {novels.map((n: any) => (
        <label className="content-item" key={n.id}>
          <input
            type="checkbox"
            checked={site.books.some((b) => b.novelId === n.id)}
            onChange={(e) =>
              update({
                books: e.target.checked
                  ? [
                      ...site.books,
                      {
                        novelId: n.id,
                        title: n.title,
                        description: n.blurb || '',
                        cover: n.layout?.cover?.frontImage,
                        order: site.books.length,
                      },
                    ]
                  : site.books.filter((b) => b.novelId !== n.id),
              })
            }
          />
          {n.title}
        </label>
      ))}
    </div>
  )
}
function InspectorPanel({
  mode,
  setMode,
  site,
  update,
  page,
  selected,
  move,
  onDelete,
}: {
  mode: Inspector
  setMode: (x: Inspector) => void
  site: Site
  update: (x: Partial<Site>) => void
  page?: WebsitePage
  selected: string
  move: (d: number) => void
  onDelete: (id: string) => void
}) {
  const section = page?.sections.find((x) => x.id === selected)
  const name = catalog.find((x) => x.type === section?.type)?.name || 'Hero Section'
  return (
    <aside className="builder-inspector">
      <div className="inspector-tabs">
        {(['page', 'section', 'element'] as Inspector[]).map((x) => (
          <button className={mode === x ? 'active' : ''} onClick={() => setMode(x)} key={x}>
            {x[0].toUpperCase() + x.slice(1)}
          </button>
        ))}
      </div>
      {mode === 'page' ? (
        <div className="inspector-content">
          <h2>Page settings</h2>
          <Field label="Page title">
            <input
              className={control}
              value={page?.name || ''}
              onChange={(e) =>
                page &&
                update({
                  pages: site.pages?.map((p) =>
                    p.id === page.id ? { ...p, name: e.target.value } : p
                  ),
                })
              }
            />
          </Field>
          <Field label="SEO title">
            <input
              className={control}
              value={site.seoTitle}
              onChange={(e) => update({ seoTitle: e.target.value })}
            />
          </Field>
          <Field label="SEO description">
            <textarea
              className={control}
              rows={4}
              value={site.seoDescription}
              onChange={(e) => update({ seoDescription: e.target.value })}
            />
          </Field>
        </div>
      ) : mode === 'element' ? (
        <div className="inspector-content">
          <h2>Element settings</h2>
          <Field label="Content">
            <input
              className={control}
              value={site.authorName}
              onChange={(e) => update({ authorName: e.target.value })}
            />
          </Field>
          <Select
            label="Alignment"
            value="left"
            options={['left', 'center', 'right']}
            onChange={() => {}}
          />
        </div>
      ) : (
        <div className="inspector-content">
          <h2>
            {name} <span>›</span>
          </h2>
          {!section || section.type === 'hero' ? (
            <Hero site={site} update={update} />
          ) : section.type === 'books' ? (
            <>
              <BookLayout site={site} update={update} />
              <SectionActions
                page={page}
                site={site}
                update={update}
                section={section}
                move={move}
                onDelete={onDelete}
              />
            </>
          ) : (
            <SectionActions page={page} site={site} update={update} section={section} move={move} onDelete={onDelete} />
          )}{' '}
        </div>
      )}
    </aside>
  )
}
function Hero({ site, update }: { site: Site; update: (x: Partial<Site>) => void }) {
  return (
    <>
      <Field label="Heading">
        <input
          className={control}
          value={site.authorName}
          onChange={(e) => update({ authorName: e.target.value })}
        />
      </Field>
      <Field label="Subheading">
        <input
          className={control}
          value={site.tagline}
          onChange={(e) => update({ tagline: e.target.value })}
        />
      </Field>
      <Field label="Description">
        <textarea
          className={control}
          rows={4}
          value={site.intro}
          onChange={(e) => update({ intro: e.target.value })}
        />
      </Field>
      <Field label="Primary button">
        <input
          className={control}
          value={site.primaryCta}
          onChange={(e) => update({ primaryCta: e.target.value })}
        />
      </Field>
      <Field label="Secondary button">
        <input
          className={control}
          value={site.secondaryCta}
          onChange={(e) => update({ secondaryCta: e.target.value })}
        />
      </Field>
      <Field label="Background">
        <div className="background-control">
          <img src={site.heroImage || '/assets/moonscribebackground.png'} alt="Hero background" />
          <button onClick={() => update({ heroImage: '/assets/moonscribebackground.png' })}>
            Change
          </button>
          <button onClick={() => update({ heroImage: undefined })}>Remove</button>
        </div>
      </Field>
      <Toggle label="Dark overlay" checked onChange={() => {}} />
      <Field label={`Overlay opacity · ${site.heroOverlay}%`}>
        <input
          type="range"
          min="20"
          max="90"
          value={site.heroOverlay}
          onChange={(e) => update({ heroOverlay: Number(e.target.value) })}
          className="range-gold"
        />
      </Field>
      <h3 className="subhead">Typography</h3>
      <Select
        label="Heading font"
        value={site.typography}
        options={['editorial', 'classic', 'modern']}
        onChange={(v) => update({ typography: v as Site['typography'] })}
      />
      <Select
        label="Spacing"
        value={site.sectionSpacing}
        options={['compact', 'comfortable', 'spacious']}
        onChange={(v) => update({ sectionSpacing: v as Site['sectionSpacing'] })}
      />
    </>
  )
}
function DeleteSectionModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-5 backdrop-blur-sm" role="presentation" onMouseDown={onCancel}><div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12171c] p-5 text-[#eee8de] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="delete-component-title" onMouseDown={(event) => event.stopPropagation()}><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-400/10 text-red-300"><Icon icon="fa-solid fa-trash" /></div><h2 id="delete-component-title" className="font-serif text-xl">Remove this component?</h2><p className="mt-2 text-sm leading-6 text-white/55">This section will be removed from the current page. Your other website content will stay untouched.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:border-white/25">Keep component</button><button type="button" autoFocus onClick={onConfirm} className="rounded-lg border border-red-300/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-200 hover:bg-red-400/20">Remove component</button></div></div></div>
}
function SectionActions({ page, site, update, section, move, onDelete }: { page?: WebsitePage; site: Site; update: (x: Partial<Site>) => void; section: any; move: (d: number) => void; onDelete: (id: string) => void }) {
  return <><Toggle label="Visible" checked={section.visible !== false} onChange={(v) => page && update({ pages: site.pages?.map((p) => p.id === page.id ? { ...p, sections: p.sections.map((s) => s.id === section.id ? { ...s, visible: v } : s) } : p) })} /><div className="move-controls"><button onClick={() => move(-1)}>↑ Move up</button><button onClick={() => move(1)}>↓ Move down</button></div><button className="remove-section" onClick={() => onDelete(section.id)}><Icon icon="fa-solid fa-trash" /> Delete component</button></>
}
function BookLayout({ site, update }: { site: Site; update: (x: Partial<Site>) => void }) {
  return <Field label="Book display"><ThemedSelect value={site.booksView || 'shelf'} onChange={(v) => update({ booksView: v as Site['booksView'] })} ariaLabel="Book display" width="100%" options={[{ value: 'shelf', label: 'Shelf — 3D presentation' }, { value: 'list', label: 'List — editorial cards' }]} /></Field>
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field-label">
      {label}
      {children}
    </label>
  )
}
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <Field label={label}>
      <ThemedSelect
        value={value}
        onChange={onChange}
        ariaLabel={label}
        width="100%"
        options={options.map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))}
      />
    </Field>
  )
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="toggle-row">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
function statusText(x: Status) {
  return {
    saved: 'Saved locally',
    dirty: 'Unsaved changes',
    saving: 'Saving…',
    'draft-saved': 'Draft saved',
    publishing: 'Publishing…',
    published: 'Published',
    failed: 'Publish failed',
  }[x]
}
function MobileSections({
  items,
  add,
  query,
  setQuery,
}: {
  items: typeof catalog
  add: (x: WebsiteSectionType) => void
  query: string
  setQuery: (x: string) => void
}) {
  return (
    <div className="mobile-sections">
      <h2>Add a Section</h2>
      <label className="builder-search">
        <Icon icon="fa-solid fa-magnifying-glass" />
        <input
          placeholder="Search sections..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {['ESSENTIALS', 'MEDIA', 'EXTRAS'].map((group) => (
        <div className="builder-group" key={group}>
          <h3>{group}</h3>
          <div className="section-grid">
            {items
              .filter((x) => x.group === group)
              .map((x) => (
                <button className="section-tile" key={x.type} onClick={() => add(x.type)}>
                  <img src="/assets/moonscribebackground.png" alt="" />
                  <span>
                    <Icon icon={x.icon} />
                    {x.name}
                  </span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
function MobileMore({
  site,
  save,
  publish,
  preview,
}: {
  site: Site
  save: () => void
  publish: () => void
  preview: () => void
}) {
  return (
    <div className="mobile-more">
      <h2>More</h2>
      <h3>SITE ACTIONS</h3>
      <button onClick={preview}>
        <Icon icon="fa-regular fa-eye" />
        <span>
          Preview<small>Open a full screen preview</small>
        </span>
        <Icon icon="fa-solid fa-chevron-right" />
      </button>
      <button disabled={!site.published}>
        <Icon icon="fa-solid fa-arrow-up-right-from-square" />
        <span>
          View live<small>Visit your published site</small>
        </span>
        <Icon icon="fa-solid fa-chevron-right" />
      </button>
      <button onClick={save}>
        <Icon icon="fa-regular fa-floppy-disk" />
        <span>
          Save draft<small>Save the current website draft</small>
        </span>
        <Icon icon="fa-solid fa-chevron-right" />
      </button>
      <button className="mobile-publish" onClick={publish}>
        <Icon icon="fa-solid fa-upload" />
        Publish
      </button>
      <h3>SITE SETTINGS</h3>
      <button>
        <Icon icon="fa-solid fa-magnifying-glass" />
        <span>SEO & metadata</span>
        <Icon icon="fa-solid fa-chevron-right" />
      </button>
    </div>
  )
}
