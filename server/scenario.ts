import { blockSpecs, createState, staticAnalysis, step } from '../src/sim/engine'
import type { Scenario } from '../src/sim/types'
import { scenarios } from '../src/sim/scenarios'

const blockTypes = Object.keys(blockSpecs)

const load = {
  type: 'object',
  properties: { read: { type: 'number' }, write: { type: 'number' }, static: { type: 'number' } },
  required: ['read', 'write', 'static'],
}

export const scenarioSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    level: { type: 'integer' },
    briefing: { type: 'string' },
    durationMin: { type: 'integer', minimum: 10, maximum: 60 },
    baseLoad: load,
    trafficCurve: {
      type: 'array',
      items: { type: 'object', properties: { at: { type: 'number' }, mult: { type: 'number' } }, required: ['at', 'mult'] },
    },
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          at: { type: 'integer' },
          kind: { type: 'string', enum: ['traffic', 'kill', 'killOne', 'slow', 'cacheFlush', 'ddos'] },
          target: { type: 'string' },
          value: { type: 'number' },
          duration: { type: 'integer' },
          message: { type: 'string' },
        },
        required: ['at', 'kind', 'message'],
      },
    },
    slo: {
      type: 'object',
      properties: { p99Ms: { type: 'number' }, errorRate: { type: 'number' } },
      required: ['p99Ms', 'errorRate'],
    },
    errorBudgetMin: { type: 'integer' },
    budgetPerMonth: { type: 'number' },
    startGraph: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string', enum: blockTypes },
              label: { type: 'string' },
              instances: { type: 'integer', minimum: 1 },
              size: { type: 'string', enum: ['S', 'M', 'L', 'XL'] },
              hitRatio: { type: 'number' },
              rateLimit: { type: 'number' },
            },
            required: ['id', 'type', 'label', 'instances', 'size'],
          },
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            properties: { source: { type: 'string' }, target: { type: 'string' } },
            required: ['source', 'target'],
          },
        },
      },
      required: ['nodes', 'edges'],
    },
    debrief: { type: 'string' },
    bannedBlocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { type: { type: 'string', enum: blockTypes }, reason: { type: 'string' } },
        required: ['type', 'reason'],
      },
    },
  },
  required: [
    'id', 'title', 'level', 'briefing', 'durationMin', 'baseLoad', 'events',
    'slo', 'errorBudgetMin', 'budgetPerMonth', 'startGraph', 'debrief',
  ],
}

export const scenarioSystem = `Ты — гейм-дизайнер учебного симулятора дежурств по проектированию систем.
Генерируешь сценарий цепочки инцидентов строго по JSON-схеме. Тексты по-русски.
Сценарий должен быть проходимым: стартовая архитектура держит начальную нагрузку, но без правильных действий игрока падает.
Цифры согласуй с ёмкостями блоков. Алерты пиши как настоящие (Grafana/PagerDuty). debrief — разбор идеальных действий с таймингом и компромиссами.
При сложности ≥ 6 можешь запретить 1–2 очевидных блока (bannedBlocks) с правдоподобной причиной из жизни компании (аудит ИБ, релиз-фриз, санкции, требования продукта) — только если остаётся честный альтернативный путь, и опиши его в debrief.`

export interface ScenarioRequest {
  topic: string
  difficulty: number
}

export function buildScenarioPrompt({ topic, difficulty }: ScenarioRequest): string {
  const specs = Object.entries(blockSpecs)
    .map(([k, s]) => `- ${k}: ${s.capacity} rps/инстанс S, ${s.baseLatencyMs}ms, $${s.cost}/мес, scaling=${s.scaling}, warmup=${s.warmupTicks} — ${s.modelNote}`)
    .join('\n')
  return `Ёмкости блоков (размер S; M/L/XL = ×2/×4/×8 ёмкости при ×2.2/×5/×11 цены):
${specs}

Пример сценария (формат и масштаб цифр):
${JSON.stringify(scenarios[2] ?? scenarios[0], null, 1)}

Сгенерируй НОВЫЙ сценарий. Тема/акцент: ${topic}. Сложность: ${difficulty} из 10.
1 тик = 1 минута. id — kebab-case с префиксом "ai-".`
}

/** Playtest without player actions: must hold at the start, must fall later. Returns a problem or null. */
export function checkScenario(sc: Scenario): string | null {
  const cost = staticAnalysis(sc.startGraph).costPerMonth
  if (cost > sc.budgetPerMonth * 0.8) return `стартовая архитектура стоит $${cost}, почти весь бюджет $${sc.budgetPerMonth} — игроку не на что действовать`
  let st = createState(sc.startGraph)
  let firstViolation = -1
  let lost = false
  for (let i = 0; i < sc.durationMin; i++) {
    const r = step(sc.startGraph, st, { scenario: sc })
    st = r.state
    if (r.result.sloViolated && firstViolation < 0) firstViolation = r.result.t
    if (r.result.health <= 0) { lost = true; break }
  }
  if (firstViolation >= 0 && firstViolation < 3) return `SLO нарушается уже на минуте ${firstViolation} без всяких событий — стартовая нагрузка слишком велика для стартовой архитектуры`
  if (!lost) return 'без действий игрока сервис доживает до конца — сценарий слишком лёгкий, усиль нагрузку или инциденты'
  return null
}
