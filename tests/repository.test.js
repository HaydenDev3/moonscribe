import { describe, expect, it, vi } from 'vitest'
import { createRepository, REPOSITORY_SCHEMA_VERSION } from '../src/repository/repository'

describe('repository contract', () => {
  it('exposes a stable version and delegates reads and writes', async () => {
    const database = { get: vi.fn().mockResolvedValue({ id: 'n1' }), getAll: vi.fn().mockResolvedValue([]) }
    const repo = createRepository({ database })
    expect(repo.version).toBe(REPOSITORY_SCHEMA_VERSION)
    await expect(repo.get('novels', 'n1')).resolves.toEqual({ id: 'n1' })
    await expect(repo.list('novels')).resolves.toEqual([])
  })
})
