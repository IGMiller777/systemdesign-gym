import type { Topic } from '../tasks/types'

export interface Duel {
  id: string
  track: 'backend' | 'frontend'
  topic: Topic
  /** Markdown, 2–4 sentences with concrete numbers/constraints. */
  situation: string
  /** 2–3 options. cardId = wiki entry id if the option is a component from the encyclopedia. */
  options: { name: string; emoji: string; cardId?: string }[]
  correct: number
  /** Why the winner fits these constraints (2–3 sentences). */
  why: string
  /** What you pay for choosing the winner (1–2 sentences). */
  price: string
  /** When the other option(s) would win instead (1–2 sentences). */
  flip: string
}
