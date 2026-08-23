const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string))

export function markdownToAnnouncementHtml(source: string) {
  let html = escapeHtml(source.trim())
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>')
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/__(.+?)__/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/_(.+?)_/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>')
  return html.split(/\n{2,}/).map((block) => /^<(h[1-3]|blockquote)/.test(block) ? block : `<p>${block.replace(/\n/g, '<br />')}</p>`).join('')
}

export function sanitizeAnnouncementHtml(source: string) {
  if (typeof window === 'undefined') return source.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*(["']).*?\1/gi, '')
  const doc = new DOMParser().parseFromString(source, 'text/html')
  doc.querySelectorAll('script,style,iframe,object,embed,form').forEach((node) => node.remove())
  doc.querySelectorAll('*').forEach((node) => [...node.attributes].forEach((attr) => {
    if (/^on/i.test(attr.name) || (attr.name === 'href' && /^javascript:/i.test(attr.value))) node.removeAttribute(attr.name)
  }))
  return doc.body.innerHTML
}
