import { describe, expect, it } from 'vitest'
import { attacks, defenses } from './catalog'
import { defenseById, attackById, installedCost, mulberry32, runWave, scoreLevel, totalBudget } from './engine'
import { defenseLevels, referenceSetups } from './levels'
import type { AttackResult, DefenseLevel } from './types'

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)

function runLevel(level: DefenseLevel, installed: string[], seed: number): AttackResult[] {
  return level.waves.flatMap((w, idx) => runWave(level, w, installed, seed * 100 + idx))
}

function blockRate(level: DefenseLevel, installed: string[]): number {
  let blocked = 0
  let total = 0
  for (const seed of SEEDS) {
    for (const r of runLevel(level, installed, seed)) {
      total++
      if (r.blocked) blocked++
    }
  }
  return blocked / total
}

describe('catalog integrity', () => {
  it('has unique ids and sane ranges', () => {
    expect(new Set(defenses.map((d) => d.id)).size).toBe(defenses.length)
    expect(new Set(attacks.map((a) => a.id)).size).toBe(attacks.length)
    for (const d of defenses) {
      expect(d.cost).toBeGreaterThanOrEqual(1)
      expect(d.cost).toBeLessThanOrEqual(5)
      expect(d.friction).toBeGreaterThanOrEqual(0)
      expect(d.friction).toBeLessThanOrEqual(3)
    }
  })

  it('attacks are layered and consistent', () => {
    for (const a of attacks) {
      expect(a.impact).toBeGreaterThanOrEqual(5)
      expect(a.impact).toBeLessThanOrEqual(30)
      expect(a.counters.length).toBeGreaterThanOrEqual(2)
      expect(a.counters.length).toBeLessThanOrEqual(4)
      // pure edge-volume attacks are legitimately stopped only at the edge
      const minZones = ['ddos-l7', 'scraping-bots'].includes(a.id) ? 1 : 2
      expect(new Set(a.counters.map((c) => defenseById(c.defense)?.zone)).size).toBeGreaterThanOrEqual(minZones)
      for (const c of a.counters) {
        const d = defenseById(c.defense)
        expect(d, `${a.id} -> ${c.defense}`).toBeDefined()
        expect(a.path, `${a.id}: zone of ${c.defense} must be on path`).toContain(d!.zone)
        expect(c.effectiveness).toBeGreaterThanOrEqual(0.5)
        expect(c.effectiveness).toBeLessThanOrEqual(0.95)
      }
    }
  })

  it('levels reference existing things', () => {
    expect(defenseLevels).toHaveLength(6)
    for (const l of defenseLevels) {
      for (const id of l.available) expect(defenseById(id), id).toBeDefined()
      for (const w of l.waves) for (const e of w.attacks) expect(attackById(e.attack), e.attack).toBeDefined()
      expect(l.waves).toHaveLength(3)
      expect(l.system.nodes.length).toBeGreaterThanOrEqual(5)
      expect(l.system.nodes.length).toBeLessThanOrEqual(8)
      const ids = new Set(l.system.nodes.map((n) => n.id))
      for (const e of l.system.edges) {
        expect(ids.has(e.source)).toBe(true)
        expect(ids.has(e.target)).toBe(true)
      }
    }
  })
})

describe('engine', () => {
  it('mulberry32 is deterministic and in [0,1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 20; i++) {
      const x = a()
      expect(x).toBe(b())
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('runWave is deterministic by seed', () => {
    const level = defenseLevels[1]
    const setup = referenceSetups[level.id].slice(0, 4)
    const w = level.waves[2]
    expect(runWave(level, w, setup, 7)).toEqual(runWave(level, w, setup, 7))
    const differs = SEEDS.some((s) => JSON.stringify(runWave(level, w, setup, s)) !== JSON.stringify(runWave(level, w, setup, 7)))
    expect(differs).toBe(true)
  })

  it('without defenses every attack hits for its full impact', () => {
    for (const l of defenseLevels) {
      for (const w of l.waves) {
        const res = runWave(l, w, [], 1)
        expect(res).toHaveLength(w.attacks.reduce((s, e) => s + e.count, 0))
        for (const r of res) {
          expect(r.blocked).toBe(false)
          expect(r.damage).toBe(attackById(r.attack)!.impact)
        }
      }
    }
  })

  it('blocked results name a defense in the right zone', () => {
    const l = defenseLevels[5]
    for (const r of runLevel(l, referenceSetups[l.id], 3)) {
      if (r.blocked) {
        expect(r.by).toBeDefined()
        expect(defenseById(r.by!)!.zone).toBe(r.zone)
        expect(r.damage).toBe(0)
      }
    }
  })

  it('scoreLevel gives stars by trust, budget and friction', () => {
    const l = defenseLevels[0]
    expect(scoreLevel(l, 0, 5, []).stars).toBe(0)
    expect(scoreLevel(l, 30, 5, ['waf']).stars).toBe(1)
    expect(scoreLevel(l, 65, 5, ['waf']).stars).toBe(2)
    expect(scoreLevel(l, 95, 5, ['waf', 'rate-limit']).stars).toBe(3)
    expect(scoreLevel(l, 95, totalBudget(l) + 1, ['waf']).stars).toBe(2)
    const heavy = ['mfa', 'human-in-loop', 'pinned-provenance', 'rate-limit', 'secrets-vault', 'untrusted-isolation']
    expect(scoreLevel(l, 95, 5, heavy).stars).toBe(2)
    expect(scoreLevel(l, 95, 5, heavy).friction).toBe(2 + 2 + 2 + 1 + 1 + 1)
  })
})

describe('levels are winnable and need layers', () => {
  for (const level of defenseLevels) {
    const ref = referenceSetups[level.id]

    it(`${level.id} «${level.title}»: reference setup fits budget and is available`, () => {
      expect(ref).toBeDefined()
      for (const id of ref) expect(level.available).toContain(id)
      expect(installedCost(ref)).toBeLessThanOrEqual(totalBudget(level))
      // can't buy everything
      expect(installedCost(level.available)).toBeGreaterThan(totalBudget(level))
      // first wave must be playable with the base budget
      expect(level.waves[0].bonusBudget).toBe(0)
    })

    it(`${level.id}: reference setup blocks >= 90% across seeds and survives`, () => {
      expect(blockRate(level, ref)).toBeGreaterThanOrEqual(0.9)
      let alive = 0
      let trustSum = 0
      for (const seed of SEEDS) {
        const dmg = runLevel(level, ref, seed).reduce((s, r) => s + r.damage, 0)
        const trust = level.trust - dmg
        trustSum += trust
        if (trust > 0) alive++
      }
      expect(alive / SEEDS.length).toBeGreaterThanOrEqual(0.95)
      expect(trustSum / SEEDS.length).toBeGreaterThanOrEqual(60)
    })

    it(`${level.id}: no defenses is a loss`, () => {
      const dmg = runLevel(level, [], 1).reduce((s, r) => s + r.damage, 0)
      expect(level.trust - dmg).toBeLessThanOrEqual(0)
    })

    if (level.level >= 3) {
      it(`${level.id}: no single defense is a silver bullet`, () => {
        for (const id of level.available) {
          expect(blockRate(level, [id]), id).toBeLessThan(0.9)
        }
      })
    }
  }
})
