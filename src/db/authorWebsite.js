import { getDB, putRecord, removeRecord } from './db'
import { defaultAuthorWebsite, normalizeAuthorWebsite } from '../websites/model'

// A blocked IndexedDB open must not leave a route blank forever. The active
// database is already profile-scoped by db.js, so the fallback is safe for the
// current account and a later successful read can still replace it.
export async function getAuthorWebsite(authorName = '') {
  const fallback = defaultAuthorWebsite(authorName)
  const read = (async () => {
    const db = await getDB()
    return (await db.get('authorWebsites', 'author-website')) || fallback
  })()
  const timeout = new Promise((resolve) => setTimeout(() => resolve(fallback), 2500))
  return normalizeAuthorWebsite(await Promise.race([read, timeout]), authorName)
}
export async function saveAuthorWebsite(patch) { const current = await getAuthorWebsite(patch.authorName); return putRecord('authorWebsites', { ...current, ...patch, id: 'author-website', kind: 'author-website', version: 2, updatedAt: Date.now() }) }
export async function deleteAuthorWebsite() { return removeRecord('authorWebsites', 'author-website', null) }
