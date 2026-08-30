import { htmlToText } from './htmlToText'

const FILLERS = new Set(['just', 'really', 'very', 'quite', 'perhaps', 'actually', 'suddenly', 'somehow'])
export function analyzeProse(html = '') {
  const text = htmlToText(html).replace(/\s+/g, ' ').trim()
  const sentences = text ? text.split(/[.!?]+(?=\s|$)/).map((s) => s.trim()).filter(Boolean) : []
  const words = text ? text.toLowerCase().match(/[\p{L}\p{N}'’-]+/gu) || [] : []
  const counts = new Map()
  words.forEach((word) => counts.set(word, (counts.get(word) || 0) + 1))
  return {
    words: words.length,
    sentences: sentences.length,
    averageSentence: sentences.length ? Math.round(words.length / sentences.length) : 0,
    longSentences: sentences.filter((s) => s.split(/\s+/).length >  thirty).length,
    repeatedWords: [...counts].filter(([word, count]) => count >= 4 && word.length > 4).sort((a, b) => b[1] - a[1]).slice(0, 12),
    fillers: [...counts].filter(([word]) => FILLERS.has(word)).sort((a, b) => b[1] - a[1]),
    passive: (text.match(/\b(?:was|were|is|are|been|being)\s+\w+ed\b/gi) || []).length,
    dialogueWords: (text.match(/“[^”]*”|"[^"]*"|'[^']*'/g) || []).join(' ').split(/\s+/).filter(Boolean).length,
  }
}
const thirty = 30
