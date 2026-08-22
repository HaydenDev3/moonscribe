import { useCallback, useEffect, useState } from 'react'
import { listChapters } from '../../db/chapters'
import { currentStreak, dailyHistory, monthlyWordsAllNovels, todayWords } from '../../db/stats'
import { finiteNumber, safeArray, sumWords } from '../utils/dashboardMetrics'

export type DashboardData = {
  novels: any[]
  currentNovel: any | null
  currentChapter: any | null
  recentChapters: any[]
  todayWords: number
  weekWords: number
  monthWords: number
  dailyGoal: number
  streak: number
  totalWords: number
  chapterCount: number
  rhythm: { date: string; words: number }[]
  loading: boolean
  error: Error | null
}

const EMPTY: DashboardData = {
  novels: [], currentNovel: null, currentChapter: null, recentChapters: [],
  todayWords: 0, weekWords: 0, monthWords: 0, dailyGoal: 0, streak: 0,
  totalWords: 0, chapterCount: 0, rhythm: [], loading: true, error: null,
}

export function useDashboardData(rawNovels: unknown) {
  const novels = safeArray<any>(rawNovels)
  const [data, setData] = useState<DashboardData>(EMPTY)
  const [reloadKey, setReloadKey] = useState(0)
  const retry = useCallback(() => setReloadKey((key) => key + 1), [])

  useEffect(() => {
    let cancelled = false
    setData((current) => ({ ...current, novels, loading: true, error: null }))

    async function load() {
      const activeNovels = novels.filter((novel) => novel && !novel.archived)
      if (!activeNovels.length) {
        if (!cancelled) setData({ ...EMPTY, novels: [], loading: false })
        return
      }

      try {
        const chapterGroups = await Promise.all(activeNovels.map(async (novel) => {
          try { return { novel, chapters: safeArray<any>(await listChapters(novel.id)) } }
          catch (error) {
            if (import.meta.env.DEV) console.error(`Dashboard could not load chapters for ${novel.id}`, error)
            return { novel, chapters: [] }
          }
        }))
        const allChapters = chapterGroups.flatMap(({ novel, chapters }) => chapters.map((chapter) => ({
          ...chapter, novelTitle: novel.title || 'Untitled story',
        })))
        const currentNovel = [...activeNovels].sort((a, b) => finiteNumber(b.lastOpened || b.updatedAt) - finiteNumber(a.lastOpened || a.updatedAt))[0] || null
        const currentChapter = currentNovel ? allChapters.filter((chapter) => chapter.novelId === currentNovel.id)
          .sort((a, b) => finiteNumber(b.updatedAt) - finiteNumber(a.updatedAt))[0] || null : null

        const histories = await Promise.all(activeNovels.map(async (novel) => {
          try { return safeArray<{ date: string; words: number }>(await dailyHistory(novel.id, 7)) }
          catch { return [] }
        }))
        const rhythm = Array.from({ length: 7 }, (_, index) => ({
          date: histories.find((history) => history[index]?.date)?.[index]?.date || '',
          words: histories.reduce((sum, history) => sum + finiteNumber(history[index]?.words), 0),
        }))
        const todayResults = await Promise.all(activeNovels.map(async (novel) => {
          try { return finiteNumber(await todayWords(novel.id)) } catch { return 0 }
        }))
        const [monthWords, streak] = await Promise.all([
          monthlyWordsAllNovels().catch(() => 0), currentStreak().catch(() => 0),
        ])
        if (cancelled) return
        setData({
          novels: activeNovels, currentNovel, currentChapter,
          recentChapters: [...allChapters].sort((a, b) => finiteNumber(b.updatedAt) - finiteNumber(a.updatedAt)).slice(0, 4),
          todayWords: todayResults.reduce((sum, value) => sum + value, 0),
          weekWords: rhythm.reduce((sum, day) => sum + day.words, 0),
          monthWords: finiteNumber(monthWords), dailyGoal: Math.max(0, finiteNumber(currentNovel?.goalWords)),
          streak: finiteNumber(streak), totalWords: sumWords(allChapters), chapterCount: allChapters.length,
          rhythm, loading: false, error: null,
        })
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error('Dashboard data could not be loaded')
        if (import.meta.env.DEV) console.error('Dashboard data load failed', error)
        if (!cancelled) setData((current) => ({ ...current, novels, loading: false, error }))
      }
    }
    void load()
    return () => { cancelled = true }
  }, [rawNovels, novels, reloadKey])

  return { ...data, retry }
}
