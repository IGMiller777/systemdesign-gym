import { describe, expect, it } from 'vitest'
import { curriculum } from './curriculum'

describe('curriculum', () => {
  it('module ids are unique', () => {
    const ids = curriculum.map((m) => m.id)
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
  })

  it('prerequisites point to existing modules', () => {
    const ids = new Set(curriculum.map((m) => m.id))
    for (const m of curriculum) for (const r of m.requires) expect(ids.has(r), `${m.id} requires ${r}`).toBe(true)
  })
})
