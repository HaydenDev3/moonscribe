export type RankedNovel = {
  novel: any
  activityAt: number
  activityKind: 'chapter' | 'novel' | 'opened'
  timeOfDayMatch: boolean
  latestChapter?: any
}

const timestamp = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function hourDistance(a: number, b: number) {
  const distance = Math.abs(a - b) % 24
  return Math.min(distance, 24 - distance)
}

export function rankRecentNovels(novels: any[] = [], chapters: any[] = [], now = Date.now()): RankedNovel[] {
  const latestByNovel = new Map<string, any>()
  chapters.forEach((chapter) => {
    if (!chapter?.novelId || timestamp(chapter.updatedAt) <= timestamp(latestByNovel.get(chapter.novelId)?.updatedAt)) return
    latestByNovel.set(chapter.novelId, chapter)
  })
  const currentHour = new Date(now).getHours()

  return novels
    .map((novel, index) => {
      const chapter = latestByNovel.get(novel?.id)
      const chapterAt = timestamp(chapter?.updatedAt)
      const novelAt = timestamp(novel?.updatedAt)
      const openedAt = timestamp(novel?.lastOpened)
      const activityAt = Math.max(chapterAt, novelAt, openedAt)
      const activityKind: RankedNovel['activityKind'] = chapterAt >= novelAt && chapterAt >= openedAt && chapterAt > 0
        ? 'chapter'
        : novelAt >= openedAt && novelAt > 0 ? 'novel' : 'opened'
      const timeOfDayMatch = openedAt > 0 && hourDistance(new Date(openedAt).getHours(), currentHour) <= 1
      return { novel, activityAt, activityKind, timeOfDayMatch, latestChapter: chapter, lastOpened: openedAt, index }
    })
    .filter(({ novel }) => novel && !novel.archived)
    .sort((a, b) => b.activityAt - a.activityAt || Number(b.timeOfDayMatch) - Number(a.timeOfDayMatch) || b.lastOpened - a.lastOpened || a.index - b.index)
    .map(({ novel, activityAt, activityKind, timeOfDayMatch, latestChapter }) => ({ novel, activityAt, activityKind, timeOfDayMatch, latestChapter }))
}
