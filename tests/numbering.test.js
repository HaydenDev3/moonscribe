import { describe, expect, it } from 'vitest'
import {
  toRoman,
  toWords,
  buildTree,
  flatOrder,
  computeNumbers,
  titleFor,
  isContainer
} from '../src/utils/numbering'

const ch = (id, over = {}) => ({
  id,
  title: over.title ?? '',
  kind: over.kind ?? 'chapter',
  parentId: over.parentId ?? null,
  order: over.order ?? 1,
  content: ''
})

describe('numbering', () => {
  it('renders roman and word numerals', () => {
    expect(toRoman(1)).toBe('I')
    expect(toRoman(4)).toBe('IV')
    expect(toRoman(9)).toBe('IX')
    expect(toRoman(47)).toBe('XLVII')
    expect(toWords(1)).toBe('One')
    expect(toWords(12)).toBe('Twelve')
    expect(toWords(37)).toBe('Thirty-Seven')
    expect(toWords(210)).toBe('Two Hundred Ten')
    expect(toRoman(0)).toBe('')
    expect(toWords(0)).toBe('')
  })

  it('numbers containers and runs chapters continuously', () => {
    const chapters = [
      ch('b1', { kind: 'book', order: 1, title: 'Book I — The Rising' }),
      ch('p1', { kind: 'part', parentId: 'b1', order: 2, title: '' }),
      ch('c1', { parentId: 'p1', order: 3, title: '' }),
      ch('c2', { parentId: 'p1', order: 4, title: 'The Moonlit Road' }),
      ch('a1', { kind: 'act', parentId: 'b1', order: 5, title: '' }),
      ch('c3', { parentId: 'a1', order: 6, title: '' }),
      ch('b2', { kind: 'book', order: 7, title: '' }),
      ch('c4', { parentId: 'b2', order: 8, title: '' })
    ]
    const numbers = computeNumbers(chapters)
    expect(numbers.get('b1').label).toBe('Book I')
    expect(numbers.get('p1').label).toBe('Part One')
    expect(numbers.get('c1').label).toBe('Chapter 1')
    expect(numbers.get('c2').label).toBe('Chapter 2')
    expect(numbers.get('a1').label).toBe('Act I')
    expect(numbers.get('c3').label).toBe('Chapter 3')
    expect(numbers.get('b2').label).toBe('Book II')
    expect(numbers.get('c4').label).toBe('Chapter 4')
  })

  it('numbers subchapters against their parent chapter', () => {
    const chapters = [
      ch('c1', { order: 1 }),
      ch('s1', { kind: 'subchapter', parentId: 'c1', order: 2 }),
      ch('s2', { kind: 'subchapter', parentId: 'c1', order: 3 }),
      ch('c2', { order: 4 }),
      ch('s3', { kind: 'subchapter', parentId: 'c2', order: 5 })
    ]
    const numbers = computeNumbers(chapters)
    expect(numbers.get('c1').label).toBe('Chapter 1')
    expect(numbers.get('s1').label).toBe('Section 1.1')
    expect(numbers.get('s2').label).toBe('Section 1.2')
    expect(numbers.get('c2').label).toBe('Chapter 2')
    expect(numbers.get('s3').label).toBe('Section 2.1')
  })

  it('builds the tree and gives display order', () => {
    const chapters = [
      ch('b', { kind: 'book', order: 1 }),
      ch('c1', { parentId: 'b', order: 2 }),
      ch('s1', { kind: 'subchapter', parentId: 'c1', order: 3 }),
      ch('c2', { parentId: 'b', order: 4 })
    ]
    expect(flatOrder(chapters)).toEqual(['b', 'c1', 's1', 'c2'])
    expect(isContainer({ kind: 'book' })).toBe(true)
    expect(isContainer({ kind: 'part' })).toBe(true)
    expect(isContainer({ kind: 'act' })).toBe(true)
    expect(isContainer({ kind: 'chapter' })).toBe(false)
    expect(isContainer({ kind: 'subchapter' })).toBe(false)
  })

  it('derives display titles without duplicating labels', () => {
    const chapters = [
      ch('a', { order: 1, title: '' }),
      ch('b', { order: 2, title: 'Chapter 2 — The Moon' }),
      ch('c', { order: 3, title: 'A Handful of Dust' })
    ]
    const numbers = computeNumbers(chapters)
    expect(titleFor(chapters[0], numbers)).toBe('Chapter 1')
    expect(titleFor(chapters[1], numbers)).toBe('Chapter 2 — The Moon')
    expect(titleFor(chapters[2], numbers)).toBe('Chapter 3 — A Handful of Dust')
  })
})
