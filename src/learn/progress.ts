import { allDuels as duels } from '../duels'
import { aspectMeta } from '../practice/aspects'
import { hardcoreScenarios } from '../sim/hardcore'
import { inheritedScenarios } from '../sim/inherited'
import { opsScenarios } from '../sim/ops-scenarios'
import { frontendScenarios, llmScenarios } from '../sim/fe-llm-scenarios'
import { legendScenarios } from '../sim/legend-scenarios'
import { scenarios } from '../sim/scenarios'
import { defenseLevels } from '../defense/levels'
import { simKey } from '../store'
import { getTask } from '../tasks'
import { getEntry } from '../wiki'
import { cardKey, getCard } from '../wiki/cards'
import { conceptKey, getConcept } from './concepts'
import { curriculum, type Module, type Step } from './curriculum'

type Results = Record<string, { best: number }>
type Srs = Record<string, { box: number }>

const allScenarios = [...scenarios, ...hardcoreScenarios, ...inheritedScenarios, ...opsScenarios, ...frontendScenarios, ...llmScenarios, ...legendScenarios]

export function stepDone(s: Step, results: Results, srs: Srs): boolean {
  switch (s.kind) {
    case 'concept':
      return (results[conceptKey(s.id)]?.best ?? 0) >= 66
    case 'card':
      return (results[cardKey(s.id)]?.best ?? 0) >= 66
    case 'task':
      return (results[s.id]?.best ?? 0) > 0
    case 'duel':
      return (srs[`duel:${s.id}`]?.box ?? 0) >= 1
    case 'explain':
      return (results[`explain:${s.id}:${s.aspect}`]?.best ?? 0) >= 60
    case 'scenario':
      return (results[simKey(s.id)]?.best ?? 0) > 0
    case 'defense':
      return (results[`def:${s.id}`]?.best ?? 0) > 0
    case 'ctf':
      return (results[`ctf:${s.id}`]?.best ?? 0) > 0
  }
}

export const bossStep = (m: Module): Step => ({ kind: m.boss.kind, id: m.boss.id }) as Step

export function moduleProgress(m: Module, results: Results, srs: Srs) {
  const required = m.steps.filter((s) => !(s.kind === 'scenario' && s.optional))
  const done = required.filter((s) => stepDone(s, results, srs)).length
  const bossDone = stepDone(bossStep(m), results, srs)
  const total = required.length + 1
  const count = done + (bossDone ? 1 : 0)
  return { done: count, total, pct: count / total, bossDone, complete: count === total }
}

/** A module opens when every prerequisite is at least 70% done. */
export function isUnlocked(m: Module, results: Results, srs: Srs): boolean {
  return m.requires.every((id) => moduleProgress(curriculum.find((x) => x.id === id)!, results, srs).pct >= 0.7)
}

export function nextStep(results: Results, srs: Srs): { module: Module; step: Step } | null {
  for (const m of curriculum) {
    if (!isUnlocked(m, results, srs)) continue
    const s = m.steps.find((x) => !(x.kind === 'scenario' && x.optional) && !stepDone(x, results, srs))
    if (s) return { module: m, step: s }
    if (!stepDone(bossStep(m), results, srs)) return { module: m, step: bossStep(m) }
  }
  return null
}

export const kindMeta: Record<Step['kind'], { label: string; emoji: string }> = {
  concept: { label: 'Урок', emoji: '📘' },
  card: { label: 'Карточка', emoji: '🃏' },
  task: { label: 'Задача', emoji: '🧩' },
  duel: { label: 'Дуэль', emoji: '⚔️' },
  explain: { label: 'Объясни сам', emoji: '🗣️' },
  scenario: { label: 'Сценарий', emoji: '🚨' },
  defense: { label: 'Blue Team', emoji: '🛡️' },
  ctf: { label: 'Взлом агента', emoji: '🧙' },
}

/** Title + link for a step. */
export function stepInfo(s: Step): { title: string; href: string; emoji: string } {
  switch (s.kind) {
    case 'concept': {
      const c = getConcept(s.id)
      return { title: c?.title ?? s.id, href: `/learn/${s.id}`, emoji: c?.emoji ?? '📘' }
    }
    case 'card':
      return { title: getEntry(s.id)?.title ?? s.id, href: `/wiki/${s.id}`, emoji: getCard(s.id)?.emoji ?? '🃏' }
    case 'task':
      return { title: getTask(s.id)?.title ?? s.id, href: `/task/${s.id}`, emoji: '🧩' }
    case 'duel': {
      const d = duels.find((x) => x.id === s.id)
      return { title: d ? d.options.map((o) => o.name).join(' vs ') : s.id, href: `/duels?d=${s.id}`, emoji: '⚔️' }
    }
    case 'explain':
      return {
        title: `${getEntry(s.id)?.title ?? s.id}: ${aspectMeta[s.aspect].label.toLowerCase()}`,
        href: `/wiki/${s.id}?explain=${s.aspect}`,
        emoji: '🗣️',
      }
    case 'scenario':
      return { title: allScenarios.find((x) => x.id === s.id)?.title ?? s.id, href: `/oncall/${s.id}`, emoji: '🚨' }
    case 'defense':
      return { title: `Blue Team: ${defenseLevels.find((l) => l.id === s.id)?.title ?? s.id}`, href: `/security/defense/${s.id}`, emoji: '🛡️' }
    case 'ctf':
      return { title: `Взломай агента: уровень ${s.id}`, href: `/security/ctf/${s.id}`, emoji: '🧙' }
  }
}
