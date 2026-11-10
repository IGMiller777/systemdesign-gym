import { getEntry } from '../wiki'
import type { WikiEntry } from '../wiki/types'

export const aspects = ['essence', 'pros', 'cons', 'whenNot', 'breaks', 'scale', 'compare'] as const
export type Aspect = (typeof aspects)[number]

export const aspectMeta: Record<Aspect, { label: string; emoji: string }> = {
  essence: { label: 'Суть', emoji: '🎯' },
  pros: { label: 'Преимущества', emoji: '💪' },
  cons: { label: 'Недостатки', emoji: '🩸' },
  whenNot: { label: 'Когда не брать', emoji: '🚫' },
  breaks: { label: 'Что сломается', emoji: '💥' },
  scale: { label: 'Масштабирование', emoji: '📈' },
  compare: { label: 'Сравнение', emoji: '⚖️' },
}

const rival = (e: WikiEntry) => getEntry(e.pairsWith[0]?.id ?? '')?.title ?? e.alternatives[0]?.name ?? 'альтернатив'

export function explainQuestion(e: WikiEntry, a: Aspect): string {
  switch (a) {
    case 'essence':
      return `Объясни суть ${e.title} коллеге-фронтендеру в 2–3 предложениях: какую проблему решает и как.`
    case 'pros':
      return `Назови 2–3 главных преимущества ${e.title} и почему они важны на практике.`
    case 'cons':
      return `Какие у ${e.title} недостатки и подводные камни? Чем за него платишь?`
    case 'whenNot':
      return `Когда ${e.title} брать НЕ стоит? Приведи пример ситуации и что взять вместо.`
    case 'breaks':
      return `Что у ${e.title} ломается первым под нагрузкой или при сбое, и как это заметить по метрикам?`
    case 'scale':
      return `Как масштабируется ${e.title} и где у этого предел?`
    case 'compare':
      return `Чем ${e.title} отличается от ${rival(e)}? Когда что выбрать?`
  }
}

/** Reference for the grader: the relevant slice of the encyclopedia entry. */
export function explainReference(e: WikiEntry, a: Aspect): string {
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join('\n')
  switch (a) {
    case 'essence':
      return `${e.tagline}\n\n${e.what}`
    case 'pros':
      return list(e.pros)
    case 'cons':
      return list(e.cons)
    case 'whenNot':
      return list(e.whenNotToUse)
    case 'breaks':
      return list(e.failureModes)
    case 'scale':
      return e.scaling
    case 'compare':
      return `${e.alternatives.map((x) => `${x.name}: ${x.difference}`).join('\n')}\n${e.pairsWith.map((p) => `${p.id}: ${p.why}`).join('\n')}`
  }
}
