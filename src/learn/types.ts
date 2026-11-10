import type { WikiCard } from '../wiki/types'

/** A fundamentals lesson (not a component): latency numbers, indexes, replication, CAP… */
export interface Concept {
  id: string
  title: string
  emoji: string
  /** One line, plain words. */
  tagline: string
  /** Everyday analogy, 1–2 sentences. */
  analogy: string
  /** 3–5 short sections, markdown, concrete numbers and examples. */
  sections: { title: string; body: string }[]
  /** 3–5 bullets to remember. */
  keyPoints: string[]
  /** Optional comparison table. */
  compare?: { headers: string[]; rows: string[][] }
  /** Optional diagram, same format as card setups. */
  diagram?: WikiCard['setup']
  /** Wiki entry ids worth opening next. */
  related: string[]
  /** Exactly 3 questions with plausible distractors. */
  quiz: WikiCard['quiz']
}
