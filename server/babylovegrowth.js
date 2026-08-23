import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = 'https://api.babylovegrowth.ai/api/integrations'
const LIMIT = 50

function extractItems(payload) {
  if (Array.isArray(payload)) return payload
  return payload?.articles || payload?.data || payload?.items || []
}

function normalizeArticle(article) {
  return {
    id: article.id ?? null,
    title: article.title || 'Untitled article',
    content_html: article.content_html || '',
    content_markdown: article.content_markdown || '',
    slug: String(article.slug || article.id || '').trim(),
    meta_description: article.meta_description || '',
    hero_image_url: article.hero_image_url || '',
    jsonLd: article.jsonLd || null,
    faqJsonLd: article.faqJsonLd || null,
    languageCode: article.languageCode || 'en',
    publishedAt: article.publishedAt || null,
  }
}

function articleFile(dataDir) {
  mkdirSync(dataDir, { recursive: true })
  return join(dataDir, 'babylovegrowth-articles.json')
}

export function loadBabyLoveGrowthArticles(dataDir) {
  try {
    const value = JSON.parse(readFileSync(articleFile(dataDir), 'utf8'))
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

async function request(pathname) {
  const key = String(process.env.BABYLOVEGROWTH_API_KEY || '').trim()
  if (!key) throw new Error('BABYLOVEGROWTH_API_KEY is not configured')
  const response = await fetch(`${BASE_URL}${pathname}`, {
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`BabyLoveGrowth request failed (${response.status})`)
  return response.json()
}

export async function syncBabyLoveGrowthArticles(dataDir) {
  if (!String(process.env.BABYLOVEGROWTH_API_KEY || '').trim()) {
    return { synced: false, articles: loadBabyLoveGrowthArticles(dataDir), reason: 'API key not configured' }
  }
  const bySlug = new Map(loadBabyLoveGrowthArticles(dataDir).map((article) => [article.slug, article]))
  let offset = 0
  let fetched = 0
  while (true) {
    const page = extractItems(await request(`/v1/articles?limit=${LIMIT}&offset=${offset}`))
    for (const summary of page) {
      const full = summary.id ? await request(`/v1/articles/${encodeURIComponent(summary.id)}`) : summary
      const article = normalizeArticle({ ...summary, ...full })
      if (article.slug) bySlug.set(article.slug, { ...article, syncedAt: new Date().toISOString() })
    }
    fetched += page.length
    if (page.length < LIMIT) break
    offset += LIMIT
  }
  const articles = [...bySlug.values()].sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
  const file = articleFile(dataDir)
  const temp = `${file}.tmp`
  writeFileSync(temp, JSON.stringify(articles, null, 2))
  renameSync(temp, file)
  return { synced: true, fetched, articles }
}

export function startBabyLoveGrowthSync(dataDir, log = console) {
  if (!String(process.env.BABYLOVEGROWTH_API_KEY || '').trim()) return () => {}
  const run = () => syncBabyLoveGrowthArticles(dataDir).then((result) => log.log(`[babylovegrowth] synced ${result.articles.length} articles`)).catch((error) => log.error('[babylovegrowth] sync failed:', error.message))
  void run()
  const interval = Number(process.env.BABYLOVEGROWTH_SYNC_INTERVAL_MS || 21600000)
  const timer = setInterval(run, Math.max(interval, 60000))
  timer.unref?.()
  return () => clearInterval(timer)
}
