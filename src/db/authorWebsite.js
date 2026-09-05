import { getDB, putRecord, removeRecord } from './db'
import { defaultAuthorWebsite, normalizeAuthorWebsite } from '../websites/model'
export async function getAuthorWebsite(authorName = '') { const db = await getDB(); return normalizeAuthorWebsite((await db.get('authorWebsites', 'author-website')) || defaultAuthorWebsite(authorName), authorName) }
export async function saveAuthorWebsite(patch) { const current = await getAuthorWebsite(patch.authorName); return putRecord('authorWebsites', { ...current, ...patch, id: 'author-website', kind: 'author-website', version: 2, updatedAt: Date.now() }) }
export async function deleteAuthorWebsite() { return removeRecord('authorWebsites', 'author-website', null) }
