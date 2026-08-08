// Tiny download helpers — kept separate from exportDocx so the heavy `docx`
// library only loads when a Word document is actually exported.

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function downloadText(text, filename) {
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename)
}

export function safeName(title) {
  return (title || 'novel').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, '_').slice(0, 60) || 'novel'
}
