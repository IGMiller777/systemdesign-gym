import { attacks, defenses } from './catalog'
import type { Attack, AttackResult, Defense, DefenseLevel, Wave, Zone } from './types'

/** Deterministic seeded RNG, returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const defenseMap = new Map<string, Defense>(defenses.map((d) => [d.id, d]))
const attackMap = new Map<string, Attack>(attacks.map((a) => [a.id, a]))

export function defenseById(id: string): Defense | undefined {
  return defenseMap.get(id)
}

export function attackById(id: string): Attack | undefined {
  return attackMap.get(id)
}

/**
 * Simulates one wave. Each attack instance walks its path zone by zone; every
 * installed counter whose defense lives in the current zone rolls to block.
 * Defenses preinstalled by the level are always included.
 */
export function runWave(level: DefenseLevel, wave: Wave, installed: string[], seed: number): AttackResult[] {
  const rng = mulberry32(seed)
  const have = new Set([...(level.preinstalled ?? []), ...installed])
  const results: AttackResult[] = []
  let i = 0
  for (const entry of wave.attacks) {
    const attack = attackById(entry.attack)
    if (!attack) continue
    for (let k = 0; k < entry.count; k++) {
      let result: AttackResult | undefined
      for (const zone of attack.path) {
        for (const c of attack.counters) {
          if (!have.has(c.defense)) continue
          if (defenseById(c.defense)?.zone !== zone) continue
          if (rng() < c.effectiveness) {
            result = { attack: attack.id, i, blocked: true, by: c.defense, zone, damage: 0 }
            break
          }
        }
        if (result) break
      }
      results.push(
        result ?? {
          attack: attack.id,
          i,
          blocked: false,
          zone: attack.path[attack.path.length - 1] as Zone,
          damage: attack.impact,
        },
      )
      i++
    }
  }
  return results
}

/** Base budget plus all wave bonuses. */
export function totalBudget(level: DefenseLevel): number {
  return level.budget + level.waves.reduce((s, w) => s + w.bonusBudget, 0)
}

export function installedCost(ids: string[]): number {
  return ids.reduce((s, id) => s + (defenseById(id)?.cost ?? 0), 0)
}

export function scoreLevel(
  level: DefenseLevel,
  trustLeft: number,
  budgetSpent: number,
  installed: string[],
): { stars: number; friction: number; notes: string[] } {
  const all = [...new Set([...(level.preinstalled ?? []), ...installed])]
  const friction = all.reduce((s, id) => s + (defenseById(id)?.friction ?? 0), 0)
  const total = totalBudget(level)
  const notes: string[] = []
  const frictionLimit = 8
  let stars = 0
  if (trustLeft > 0) stars = 1
  if (trustLeft >= 60) stars = 2
  if (trustLeft >= 80 && friction <= frictionLimit && budgetSpent <= total) stars = 3

  if (trustLeft <= 0) notes.push('Доверие обнулено: пользователи и пресса ушли. Смотрите разбор и пробуйте слои в других зонах.')
  else if (trustLeft >= 80) notes.push('Репутация почти не пострадала.')
  else if (trustLeft < 60) notes.push('Доверие сильно просело: часть атак прошла сквозь слои.')
  if (trustLeft >= 80 && friction > frictionLimit) {
    notes.push(
      `Трения слишком много (${friction} при пороге ${frictionLimit}): защиту, которую все ненавидят, обходят. Третья звезда уплыла.`,
    )
  } else if (friction <= 3) {
    notes.push('Очень мало трения: пользователи защиты не заметили.')
  }
  const saved = total - budgetSpent
  if (saved > 0 && trustLeft > 0) notes.push(`Сэкономлено бюджета: ${saved}. Можно потратить на что-то полезное.`)
  if (budgetSpent > total) notes.push('Бюджет превышен.')
  const zones = new Set(all.map((id) => defenseById(id)?.zone))
  if (zones.size >= 3) notes.push(`Эшелонированная защита: слои в ${zones.size} зонах.`)
  else if (all.length > 0) notes.push('Защита сосредоточена в 1–2 зонах: один обход, и слоёв не остаётся.')
  return { stars, friction, notes }
}
