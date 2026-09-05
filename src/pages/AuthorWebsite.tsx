import { useCallback, useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import WebsiteLoading from '../components/WebsiteLoading'
import { useApp } from '../context/AppContext'
import { getAuthorWebsite, saveAuthorWebsite } from '../db/authorWebsite'
import { wordsAndChapters } from '../db/chapters'
import { getConfig } from '../sync/engine'
import AuthorSite from '../websites/AuthorSite'
import {
  WEBSITE_THEMES,
  defaultAuthorWebsite,
  normalizeAuthorWebsite,
  type AuthorWebsite as AuthorWebsiteDocument,
  type WebsiteLink,
} from '../websites/model'

type Status =
  'saved' | 'dirty' | 'saving' | 'syncing' | 'draft-saved' | 'publishing' | 'published' | 'publish-failed'
const field =
  'mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-[#f1ece3] outline-none transition placeholder:text-white/25 focus:border-[#c99a3d]/60 focus:ring-2 focus:ring-[#c99a3d]/10'
const label = 'block text-[11px] font-semibold uppercase tracking-[.14em] text-white/45'

export default function AuthorWebsite() {
  const { novels = [], syncUsername, settings, toast, syncNow } = useApp() as any
  const navigate = useNavigate()
  const [site, setSite] = useState<AuthorWebsiteDocument | null>(null)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [status, setStatus] = useState<Status>('saved')
  const [bookCounts, setBookCounts] = useState<Record<string, any>>({})
  useEffect(() => {
    let live = true
    const name = settings?.writerName || syncUsername || ''
    getAuthorWebsite(name)
      .then((v) => live && setSite(normalizeAuthorWebsite(v, name)))
      .catch(() => live && setSite(defaultAuthorWebsite(name)))
    return () => {
      live = false
    }
  }, [settings?.writerName, syncUsername])
  useEffect(() => {
    let live = true
    Promise.all(novels.map(async (novel: any) => [novel.id, await wordsAndChapters(novel.id)] as const)).then((entries) => { if (live) setBookCounts(Object.fromEntries(entries)) }).catch(() => {})
    return () => { live = false }
  }, [novels])
  const update = (patch: Partial<AuthorWebsiteDocument>) => {
    setSite((s) => (s ? { ...s, ...patch } : s))
    setStatus('dirty')
  }
  const persist = useCallback(async (silent = false) => {
    if (!site) return null
    setStatus('saving')
    try {
      const local = await saveAuthorWebsite(site)
      setSite(normalizeAuthorWebsite(local, site.authorName))
      setStatus('syncing')
      // authorWebsites is a normal syncable IndexedDB store. Trigger the
      // shared engine after the local write so cloud-connected authors see
      // website edits on their other devices without a second data path.
      try { await syncNow?.() } catch { /* retain the local draft for retry */ }
      setStatus('draft-saved')
      if (!silent) toast?.('Website draft saved.')
      window.setTimeout(() => setStatus('saved'), 1600)
      return local
    } catch (error) {
      setStatus('dirty')
      toast?.(error instanceof Error ? error.message : 'Draft could not be saved.')
      return null
    }
  }, [site, syncNow, toast])
  useEffect(() => {
    if (status !== 'dirty' || !site) return undefined
    const timer = window.setTimeout(() => { void persist(true) }, 650)
    return () => window.clearTimeout(timer)
  }, [status, site, persist])
  useEffect(() => {
    const protectPendingSave = (event: globalThis.BeforeUnloadEvent) => {
      if (status === 'dirty' || status === 'saving' || status === 'syncing') {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', protectPendingSave)
    return () => window.removeEventListener('beforeunload', protectPendingSave)
  }, [status])
  const saveRemote = async (current: AuthorWebsiteDocument) => {
    const cfg = await getConfig()
    if (!cfg.server || !cfg.token) throw new Error('Sign in to publish your author website.')
    const base = cfg.server.replace(/\/$/, '')
    let response = await fetch(`${base}/api/author-website`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ website: current }),
    })
    if (!response.ok)
      throw new Error(
        (await response.json().catch(() => ({}))).error ||
          'The website draft could not be uploaded.'
      )
    response = await fetch(`${base}/api/author-website/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}` },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Publishing failed.')
    return data
  }
  const publish = async () => {
    if (!site?.authorName.trim()) {
      toast?.('Add an author name before publishing.')
      return
    }
    setStatus('publishing')
    try {
      const draft = normalizeAuthorWebsite({ ...site, published: false }, site.authorName)
      await saveAuthorWebsite(draft)
      const result = await saveRemote(draft)
      const published = normalizeAuthorWebsite(result.website, site.authorName)
      setSite(published)
      await saveAuthorWebsite(published)
      setStatus('published')
      toast?.(`Published at ${result.url}`)
    } catch (error) {
      setStatus('publish-failed')
      toast?.(error instanceof Error ? error.message : 'Publishing failed.')
    }
  }
  const unpublish = async () => {
    const cfg = await getConfig()
    if (!cfg.server || !cfg.token) { toast?.('Sign in to unpublish your author website.'); return }
    setStatus('publishing')
    try {
      const response = await fetch(`${cfg.server.replace(/\/$/, '')}/api/author-website/unpublish`, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}` } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unpublishing failed.')
      const next = normalizeAuthorWebsite(data.website, site?.authorName)
      setSite(next); await saveAuthorWebsite(next); setStatus('draft-saved'); toast?.('Website unpublished.')
    } catch (error) { setStatus('publish-failed'); toast?.(error instanceof Error ? error.message : 'Unpublishing failed.') }
  }
  const exportSite = () => {
    const root = document.querySelector('.author-site-root')
    if (!root || !site) return
    const css = Array.from(document.styleSheets).map((sheet) => { try { return Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n') } catch { return '' } }).join('\n')
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(site.title)}</title><style>${css}</style></head><body>${root.outerHTML}</body></html>`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${slugify(site.authorName || 'author')}-website.html`; anchor.click(); URL.revokeObjectURL(url); toast?.('Static website exported.')
  }
  const toggleBook = (novel: any) => {
    if (!site) return
    const exists = site.books.some((b) => b.novelId === novel.id)
    update({
      books: exists
        ? site.books.filter((b) => b.novelId !== novel.id)
        : [
            ...site.books,
            {
              novelId: novel.id,
              title: novel.title,
              description: novel.blurb || '',
              cover: novel.layout?.cover?.frontImage || (typeof novel.cover === 'string' ? novel.cover : undefined),
              coverDesign: novel.layout?.cover,
              status: novel.collection === 'finished' ? 'Published' : 'Coming soon',
              url: '',
              order: site.books.length,
            },
          ],
    })
  }
  const moveBook = (index: number, delta: number) => {
    if (!site) return
    const next = [...site.books]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    update({ books: next.map((b, i) => ({ ...b, order: i })) })
  }
  const upload = async (
    event: ChangeEvent<HTMLInputElement>,
    key: 'heroImage' | 'profileImage'
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      update({ [key]: await resizeImage(file, key === 'heroImage' ? 1800 : 900) })
      event.target.value = ''
    } catch {
      toast?.('Choose a JPG, PNG, WebP or GIF image under 10 MB.')
    }
  }
  if (!site) return <WebsiteLoading />
  return (
    <main className="min-h-screen bg-[#08090d] text-[#eee8de]">
      <header className="sticky top-0 z-50 flex min-h-16 flex-wrap items-center gap-3 border-b border-white/10 bg-[#0b0c10]/95 px-4 py-3 backdrop-blur-xl lg:px-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-white/65 hover:border-[#c99a3d]/40 hover:text-[#e9bd68]"
        >
          <Icon icon="fa-solid fa-arrow-left" /> Studio
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[.22em] text-[#c99a3d]">
            AUTHOR WEBSITE
          </p>
          <h1 className="truncate font-serif text-lg">
            {site.authorName || site.title || 'Your website'}
          </h1>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs ${status === 'publish-failed' ? 'bg-red-500/10 text-red-300' : status === 'published' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-white/50'}`}
        >
          {statusText(status)}
        </span>
        <button
          onClick={exportSite}
          className="h-10 rounded-xl border border-white/10 px-4 text-sm hover:border-[#c99a3d]/40"
        >
          Export
        </button>
        {site.published && <button
          disabled={status === 'publishing'}
          onClick={() => void unpublish()}
          className="h-10 rounded-xl border border-red-400/20 px-4 text-sm text-red-200/70 hover:border-red-300/50 disabled:opacity-50"
        >
          Unpublish
        </button>}
        <button
          disabled={status === 'saving' || status === 'publishing'}
          onClick={() => void persist()}
          className="h-10 rounded-xl border border-white/10 px-4 text-sm hover:border-[#c99a3d]/40 disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          disabled={status === 'saving' || status === 'publishing'}
          onClick={() => void publish()}
          className="h-10 rounded-xl bg-[#d6a64b] px-5 text-sm font-semibold text-[#17120b] shadow-[0_8px_24px_rgba(214,166,75,.18)] hover:bg-[#e3b864] disabled:opacity-50"
        >
          {status === 'publishing' ? 'Publishing…' : 'Publish'}
        </button>
      </header>
      <div className="grid min-h-[calc(100vh-65px)] lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-r border-white/10 bg-[#0d0e12] lg:h-[calc(100vh-65px)] lg:overflow-y-auto">
          <div className="space-y-1 p-4">
            <Panel title="Identity" icon="fa-regular fa-user">
              <Text
                labelText="Site title"
                value={site.title}
                onChange={(v) => update({ title: v })}
              />
              <Text
                labelText="Author name"
                value={site.authorName}
                onChange={(v) => update({ authorName: v })}
              />
              <Text
                labelText="Tagline"
                value={site.tagline}
                onChange={(v) => update({ tagline: v })}
              />
              <Text
                labelText="Location"
                value={site.location}
                onChange={(v) => update({ location: v })}
              />
              <Area labelText="Biography" value={site.bio} onChange={(v) => update({ bio: v })} />
              <ImageField
                title="Profile image"
                value={site.profileImage}
                onChange={(e) => void upload(e, 'profileImage')}
                onClear={() => update({ profileImage: undefined })}
              />
            </Panel>
            <Panel title="Hero" icon="fa-regular fa-image">
              <ImageField
                title="Hero background"
                value={site.heroImage}
                onChange={(e) => void upload(e, 'heroImage')}
                onClear={() => update({ heroImage: undefined })}
              />
              <Text
                labelText="Eyebrow"
                value={site.heroEyebrow}
                onChange={(v) => update({ heroEyebrow: v })}
              />
              <Area
                labelText="Intro paragraph"
                value={site.intro}
                onChange={(v) => update({ intro: v })}
              />
              <Text
                labelText="Primary CTA"
                value={site.primaryCta}
                onChange={(v) => update({ primaryCta: v })}
              />
              <Text
                labelText="Secondary CTA"
                value={site.secondaryCta}
                onChange={(v) => update({ secondaryCta: v })}
              />
              <Text
                labelText="Hero quote"
                value={site.heroQuote}
                onChange={(v) => update({ heroQuote: v })}
              />
            </Panel>
            <Panel title="Books" icon="fa-solid fa-book-open">
              <p className="mb-3 text-xs leading-5 text-white/35">
                Only selected metadata is public. Manuscript text stays private.
              </p>
              {novels.map((n: any) => {
                const index = site.books.findIndex((b) => b.novelId === n.id)
                return (
                  <div
                    key={n.id}
                    className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={index >= 0}
                      onChange={() => toggleBook(n)}
                      className="accent-[#d6a64b]"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{n.title}</span>
                    {index >= 0 && (
                      <>
                        <button
                          onClick={() => moveBook(index, -1)}
                          aria-label="Move up"
                          className="text-white/40 hover:text-[#d6a64b]"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveBook(index, 1)}
                          aria-label="Move down"
                          className="text-white/40 hover:text-[#d6a64b]"
                        >
                          ↓
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
              <Toggle
                text="Show descriptions"
                checked={site.showBookDescriptions}
                onChange={(v) => update({ showBookDescriptions: v })}
              />
              <Toggle
                text="Show status"
                checked={site.showBookStatus}
                onChange={(v) => update({ showBookStatus: v })}
              />
            </Panel>
            <Panel title="About" icon="fa-regular fa-address-card">
              <Text
                labelText="Heading"
                value={site.aboutHeading}
                onChange={(v) => update({ aboutHeading: v })}
              />
              <Area
                labelText="About text"
                value={site.aboutText}
                onChange={(v) => update({ aboutText: v })}
              />
              <Text
                labelText="Interests / traits"
                value={site.interests.join(', ')}
                onChange={(v) =>
                  update({
                    interests: v
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean)
                      .slice(0, 6),
                  })
                }
              />
            </Panel>
            <Panel title="Journal" icon="fa-solid fa-feather-pointed">
              <Toggle
                text="Show public journal"
                checked={site.journalEnabled}
                onChange={(v) => update({ journalEnabled: v })}
              />
              <p className="mt-3 text-xs leading-5 text-white/35">
                Only posts explicitly marked public here can appear.
              </p>
              {site.posts.map((p, i) => (
                <div key={p.id} className="mt-3 rounded-xl border border-white/10 p-3">
                  <Text
                    labelText="Post title"
                    value={p.title}
                    onChange={(v) =>
                      update({
                        posts: site.posts.map((x, j) => (j === i ? { ...x, title: v } : x)),
                      })
                    }
                  />
                  <Area
                    labelText="Excerpt"
                    value={p.excerpt}
                    onChange={(v) =>
                      update({
                        posts: site.posts.map((x, j) => (j === i ? { ...x, excerpt: v } : x)),
                      })
                    }
                  />
                  <Toggle
                    text="Published"
                    checked={p.published}
                    onChange={(v) =>
                      update({
                        posts: site.posts.map((x, j) => (j === i ? { ...x, published: v } : x)),
                      })
                    }
                  />
                </div>
              ))}
              <button
                onClick={() =>
                  update({
                    posts: [
                      ...site.posts,
                      {
                        id: crypto.randomUUID(),
                        title: 'New journal post',
                        date: new Date().toISOString().slice(0, 10),
                        excerpt: '',
                        published: false,
                      },
                    ],
                  })
                }
                className="mt-3 text-sm text-[#d6a64b]"
              >
                + Add public post
              </button>
            </Panel>
            <Panel title="Social" icon="fa-solid fa-share-nodes">
              {(['instagram', 'x', 'youtube', 'github'] as const).map((kind) => (
                <Text
                  key={kind}
                  labelText={kind === 'x' ? 'X / Twitter' : kind[0].toUpperCase() + kind.slice(1)}
                  value={site.links.find((l) => l.kind === kind)?.url || ''}
                  onChange={(v) => update({ links: upsertLink(site.links, kind, v) })}
                />
              ))}
            </Panel>
            <Panel title="Design" icon="fa-solid fa-wand-magic-sparkles">
              <div className="grid grid-cols-2 gap-2">
                {WEBSITE_THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() =>
                      update({ theme: t.id, accent: t.swatches[2], background: t.swatches[0] })
                    }
                    className={`rounded-xl border p-3 text-left ${site.theme === t.id ? 'border-[#d6a64b] bg-[#d6a64b]/10' : 'border-white/10 bg-black/20'}`}
                  >
                    <span className="mb-2 flex gap-1">
                      {t.swatches.map((c) => (
                        <i key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />
                      ))}
                    </span>
                    <strong className="text-sm">{t.name}</strong>
                    <small className="mt-1 block text-[10px] leading-4 text-white/35">
                      {t.description}
                    </small>
                  </button>
                ))}
              </div>
              <label className={`${label} mt-4`}>
                Accent colour
                <input
                  type="color"
                  value={site.accent}
                  onChange={(e) => update({ accent: e.target.value })}
                  className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/20 p-1"
                />
              </label>
              <Select
                labelText="Typography"
                value={site.typography}
                options={['editorial', 'classic', 'modern']}
                onChange={(v) => update({ typography: v as AuthorWebsiteDocument['typography'] })}
              />
              <Select
                labelText="Section spacing"
                value={site.sectionSpacing}
                options={['compact', 'comfortable', 'spacious']}
                onChange={(v) => update({ sectionSpacing: v as AuthorWebsiteDocument['sectionSpacing'] })}
              />
              <label className={`${label} mt-4`}>
                Hero overlay · {site.heroOverlay}%
                <input
                  type="range"
                  min="20"
                  max="90"
                  value={site.heroOverlay}
                  onChange={(e) => update({ heroOverlay: Number(e.target.value) })}
                  className="mt-3 w-full accent-[#d6a64b]"
                />
              </label>
            </Panel>
            <Panel title="Footer" icon="fa-solid fa-shoe-prints">
              <Toggle
                text="Show MoonScribe attribution"
                checked={site.showMoonScribe}
                onChange={(v) => update({ showMoonScribe: v })}
              />
              <Text
                labelText="Privacy link"
                value={site.privacyUrl}
                onChange={(v) => update({ privacyUrl: v })}
              />
              <Text
                labelText="Contact link"
                value={site.contactUrl}
                onChange={(v) => update({ contactUrl: v })}
              />
            </Panel>
          </div>
        </aside>
        <section className="min-w-0 self-start bg-[#090a0d] p-4">
          <div className="mx-auto mb-3 flex max-w-[1220px] items-center justify-between">
            <div>
              <strong className="text-sm">Live preview</strong>
              <span className="ml-3 text-xs text-white/35">
                {site.published ? 'Published' : 'Draft'}
              </span>
            </div>
            <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
              <button
                onClick={() => setDevice('desktop')}
                className={`grid h-9 w-10 place-items-center rounded-lg ${device === 'desktop' ? 'bg-white/10 text-[#d6a64b]' : 'text-white/35'}`}
                aria-label="Desktop preview"
              >
                <Icon icon="fa-solid fa-desktop" />
              </button>
              <button
                onClick={() => setDevice('mobile')}
                className={`grid h-9 w-10 place-items-center rounded-lg ${device === 'mobile' ? 'bg-white/10 text-[#d6a64b]' : 'text-white/35'}`}
                aria-label="Mobile preview"
              >
                <Icon icon="fa-solid fa-mobile-screen" />
              </button>
            </div>
          </div>
          <div
            className={`mx-auto overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,.45)] transition-[max-width] duration-300 ${device === 'mobile' ? 'max-w-[390px]' : 'max-w-[1220px]'}`}
          >
            <div className={device === 'mobile' ? 'h-[780px] overflow-y-auto' : 'min-h-[760px]'}>
              <AuthorSite site={site} compact={device === 'mobile'} counts={bookCounts} />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function Panel({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <details open className="group rounded-2xl border border-white/10 bg-white/[.025]">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 text-sm font-semibold">
        <Icon icon={icon} />
        <span>{title}</span>
        <Icon
          icon="fa-solid fa-chevron-down"
          className="ml-auto text-xs text-white/30 transition group-open:rotate-180"
        />
      </summary>
      <div className="space-y-4 border-t border-white/10 px-4 py-4">{children}</div>
    </details>
  )
}
function Text({
  labelText,
  value,
  onChange,
}: {
  labelText: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className={label}>
      {labelText}
      <input className={field} value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
function Area({
  labelText,
  value,
  onChange,
}: {
  labelText: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className={label}>
      {labelText}
      <textarea
        rows={4}
        className={`${field} resize-y normal-case tracking-normal`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
function Select({
  labelText,
  value,
  options,
  onChange,
}: {
  labelText: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <label className={label}>
      {labelText}
      <select className={field} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((x) => (
          <option key={x} value={x}>
            {x[0].toUpperCase() + x.slice(1)}
          </option>
        ))}
      </select>
    </label>
  )
}
function Toggle({
  text,
  checked,
  onChange,
}: {
  text: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-white/65">
      <span>{text}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#d6a64b]"
      />
    </label>
  )
}
function ImageField({
  title,
  value,
  onChange,
  onClear,
}: {
  title: string
  value?: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
}) {
  return (
    <label className={label}>
      {title}
      <span className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-white/15 bg-black/20 p-3">
        {value ? (
          <img src={value} alt="" className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-white/5 text-[#d6a64b]">
            ☾
          </span>
        )}
        <span className="min-w-0 flex-1 normal-case tracking-normal text-white/45">
          JPG, PNG or WebP
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onChange}
          className="hidden"
        />
        <span className="rounded-lg border border-white/10 px-2 py-1 normal-case tracking-normal text-white/70">
          Choose
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              onClear()
            }}
            className="text-white/35"
          >
            ×
          </button>
        )}
      </span>
    </label>
  )
}
function upsertLink(links: WebsiteLink[], kind: NonNullable<WebsiteLink['kind']>, url: string) {
  const existing = links.find((l) => l.kind === kind)
  if (existing) return links.map((l) => (l.id === existing.id ? { ...l, url } : l))
  return [
    ...links,
    {
      id: crypto.randomUUID(),
      kind,
      label: kind === 'x' ? 'X / Twitter' : kind[0].toUpperCase() + kind.slice(1),
      url,
    },
  ]
}
function statusText(status: Status) {
  return {
    saved: 'Saved locally',
    dirty: 'Unsaved changes',
    saving: 'Saving…',
    syncing: 'Syncing…',
    'draft-saved': 'Draft saved',
    publishing: 'Publishing…',
    published: 'Published',
    'publish-failed': 'Publish failed',
  }[status]
}
function escapeHtml(value: string) { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char) }
function slugify(value: string) { return String(value || 'author').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'author' }
async function resizeImage(file: File, maxWidth: number) {
  if (file.size > 10 * 1024 * 1024 || !/^image\/(jpeg|png|webp|gif)$/.test(file.type))
    throw new Error('Unsupported image')
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image()
    next.onload = () => resolve(next)
    next.onerror = reject
    next.src = source
  })
  if (image.width <= maxWidth) return source
  const canvas = document.createElement('canvas')
  canvas.width = maxWidth
  canvas.height = Math.round(image.height * (maxWidth / image.width))
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.86)
}
