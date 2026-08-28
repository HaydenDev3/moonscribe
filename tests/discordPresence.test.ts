import { describe, expect, it } from 'vitest'
import { activityForPath } from '../src/platform/discordPresence'

describe('Discord Rich Presence activity mapping', () => {
  it('keeps activity generic across workspace routes', () => {
    for (const path of ['/novel/abc', '/novel/abc/characters', '/novel/abc/design', '/novel/abc/analytics', '/novel/abc/media']) {
      const activity = activityForPath(path)
      expect(activity.state).toBe('MoonScribe')
      expect(activity.details).not.toMatch(/abc|chapter|document/i)
    }
  })

  it('maps the major workspaces', () => {
    expect(activityForPath('/dashboard').details).toBe('Browsing the library')
    expect(activityForPath('/novel/a').details).toBe('Writing')
    expect(activityForPath('/novel/a/characters').details).toBe('Planning a story')
    expect(activityForPath('/novel/a/design').details).toBe('Designing a book')
    expect(activityForPath('/novel/a/analytics').details).toBe('Reviewing progress')
    expect(activityForPath('/novel/a/media').details).toBe('Organising story assets')
  })
})
