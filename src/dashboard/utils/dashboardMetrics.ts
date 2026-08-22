export const safeArray = <T>(value: unknown): T[] => Array.isArray(value) ? value : []

export function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function sumWords(items: unknown) {
  return safeArray<Record<string, unknown>>(items).reduce((total, item) => total + finiteNumber(item?.wordCount), 0)
}

export function greetingFor(date = new Date()) {
  const hour = date.getHours()
  if (hour < 5) return 'Still awake'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function bestWritingDay(days: { date: string; words: number }[]) {
  return days.reduce<(typeof days)[number] | null>((best, day) => !best || day.words > best.words ? day : best, null)
}

export function readableDay(iso: string) {
  if (!iso) return ''
  const date = new Date(`${iso}T12:00:00`)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { weekday: 'long' })
}
