export const postmortemSystem = `Ты — SRE-лид, который проводит blameless-постмортем после учебного дежурства в симуляторе.
Пиши по-русски, markdown, структура:
## Что произошло (таймлайн ключевых моментов с минутами)
## Что сделано хорошо
## Что стоило сделать иначе (конкретно: какое действие, на какой минуте, почему)
## Компромиссы (цена vs надёжность vs сложность)
## Как это выглядит в реальном проде (инструменты, практики)
Будь конкретным, опирайся на цифры из таймлайна. До ~400 слов.`

export interface PostmortemRequest {
  scenario: { title: string; briefing: string; slo: { p99Ms: number; errorRate: number }; budgetPerMonth: number }
  outcome: 'survived' | 'failed'
  /** Sampled ticks. */
  timeline: { t: number; rps: number; p99Ms: number; errorRate: number; costPerMonth: number; health: number; hot: string[] }[]
  actions: { t: number; text: string }[]
  alerts: { t: number; text: string }[]
  finalGraph: string
}

export function buildPostmortemPrompt(b: PostmortemRequest): string {
  const tl = b.timeline
    .map(
      (x) =>
        `t=${x.t} rps=${Math.round(x.rps)} p99=${Math.round(x.p99Ms)}ms err=${(x.errorRate * 100).toFixed(1)}% cost=$${Math.round(x.costPerMonth)} health=${Math.round(x.health)}${x.hot.length ? ` горячие: ${x.hot.join(', ')}` : ''}`,
    )
    .join('\n')
  return `# Сценарий: ${b.scenario.title}
${b.scenario.briefing}

SLO: p99 ≤ ${b.scenario.slo.p99Ms}ms, ошибки ≤ ${(b.scenario.slo.errorRate * 100).toFixed(1)}%. Бюджет $${b.scenario.budgetPerMonth}/мес.
Итог: ${b.outcome === 'survived' ? 'дежурство пережито' : 'сервис упал (бюджет ошибок исчерпан)'}

## Алерты
${b.alerts.map((a) => `t=${a.t}: ${a.text}`).join('\n') || '(нет)'}

## Действия игрока
${b.actions.map((a) => `t=${a.t}: ${a.text}`).join('\n') || '(никаких)'}

## Таймлайн метрик
${tl}

## Финальная архитектура
${b.finalGraph}`
}
