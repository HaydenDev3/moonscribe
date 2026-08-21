import { beforeEach, describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { getDB } from '../src/db/db'
import { createTerm, listGlossary, updateTerm, trashTerm, spellingsOf } from '../src/db/glossary'
import { annotateProse } from '../src/utils/highlight'

beforeEach(async () => {
  const db = await getDB()
  await Promise.all(['glossary'].map((s) => db.clear(s)))
})

describe('glossary db', () => {
  it('creates, lists (sorted), updates and trashes terms', async () => {
    await createTerm('n1', { term: 'Zephyr', definition: 'a wind spirit', category: 'faction' })
    await createTerm('n1', { term: 'Aether', definition: 'the fabric of magic' })
    let all = await listGlossary('n1')
    expect(all.map((t) => t.term)).toEqual(['Aether', 'Zephyr']) // alphabetical

    const z = all.find((t) => t.term === 'Zephyr')
    await updateTerm(z.id, { definition: 'a storm spirit' })
    all = await listGlossary('n1')
    expect(all.find((t) => t.term === 'Zephyr').definition).toBe('a storm spirit')

    await trashTerm(z.id)
    all = await listGlossary('n1')
    expect(all.map((t) => t.term)).toEqual(['Aether'])
  })

  it('scopes terms to their novel', async () => {
    await createTerm('n1', { term: 'Only-Mine' })
    await createTerm('n2', { term: 'Other' })
    expect((await listGlossary('n1')).map((t) => t.term)).toEqual(['Only-Mine'])
  })

  it('collects term spellings including aliases', () => {
    expect(spellingsOf({ term: 'Aether', aliases: ['aether-glass', ' ', ''] })).toEqual(['Aether', 'aether-glass'])
  })
})

describe('annotateProse with glossary terms', () => {
  it('marks glossary terms with hl-term and the term id', () => {
    const out = annotateProse('<p>The Aether shimmered.</p>', {
      terms: [{ id: 't1', term: 'Aether' }]
    })
    expect(out).toContain('hl-term')
    expect(out).not.toContain('hl-name')
    expect(out).toContain('>Aether<')
  })

  it('matches aliases too', () => {
    const out = annotateProse('<p>An aether-glass lens.</p>', {
      terms: [{ id: 't1', term: 'Aether', aliases: ['aether-glass'] }]
    })
    expect(out).toContain('hl-term')
    expect(out).toContain('>aether-glass<')
  })

  it('prefers the longer character name over an overlapping term', () => {
    const out = annotateProse('<p>Anabelle waited.</p>', {
      characters: [{ id: 'c1', name: 'Anabelle', color: '#fff' }],
      terms: [{ id: 't1', term: 'Ana' }]
    })
    expect(out).toContain('hl-name')
    expect(out).not.toContain('hl-term')
  })
})
