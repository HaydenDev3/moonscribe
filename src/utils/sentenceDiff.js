const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'sentence' }) : null

export function sentences(text) {
  const source = String(text || '').trim()
  if (!source) return []
  if (segmenter) return [...segmenter.segment(source)].map((item) => item.segment.trim()).filter(Boolean)
  return source.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((item) => item.trim()).filter(Boolean) || [source]
}

export function sentenceDiff(before, after) {
  const a = sentences(before)
  const b = sentences(after)
  const table = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  const changes = []
  let i = 0; let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { changes.push({ type: 'same', text: a[i] }); i += 1; j += 1 }
    else if (j < b.length && (i === a.length || table[i][j + 1] >= table[i + 1][j])) { changes.push({ type: 'added', text: b[j] }); j += 1 }
    else { changes.push({ type: 'removed', text: a[i] }); i += 1 }
  }
  return changes
}
