import type { BlockType } from '../tasks/types'

export type WikiCategory =
  | 'frontend' // SSR, BFF, edge, realtime
  | 'ai' // LLM API, шлюзы, кэши, векторный поиск
  | 'edge' // DNS, CDN, WAF
  | 'traffic' // балансеры, gateway, proxy
  | 'compute' // сервисы, воркеры, serverless
  | 'database' // OLTP-хранилища
  | 'cache'
  | 'messaging' // очереди, логи событий
  | 'storage' // объектные, файловые
  | 'search-analytics'
  | 'coordination' // etcd, ZooKeeper, service discovery
  | 'observability'

export interface WikiEntry {
  id: string
  title: string
  category: WikiCategory
  /** Block type on the canvas/simulator, if this component exists there. */
  block?: BlockType
  /** One line: what it is, plain words. */
  tagline: string
  /** Markdown: what it is and why it exists, 1–2 paragraphs. */
  what: string
  /** Markdown: how it works under the hood, high level, 2–4 paragraphs. */
  how: string
  whenToUse: string[]
  whenNotToUse: string[]
  /** Typical neighbours in an architecture and why. */
  pairsWith: { id: string; why: string }[]
  pros: string[]
  cons: string[]
  /** Markdown: how it scales (vertical, replicas, sharding...) and the limits. */
  scaling: string
  failureModes: string[]
  /** Order-of-magnitude numbers to remember. */
  numbers: { metric: string; value: string }[]
  alternatives: { name: string; difference: string }[]
  /** Who uses it in Russia / typical RU stack notes. */
  inPractice: string
  /** Optional small ASCII/markdown diagram of a typical setup. */
  diagram?: string
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

/** Game-card layer over a wiki entry: visual, short, with examples and a quiz. */
export interface WikiCard {
  /** One emoji that captures the component. */
  emoji: string
  /** common = basics everyone needs; legendary = advanced/rarely needed. */
  rarity: Rarity
  /** 1..5. cost: 5 = most expensive; complexity: 5 = hardest to operate. */
  stats: { speed: number; scale: number; reliability: number; cost: number; complexity: number }
  /** Card-game style one-liners, Russian. */
  superpower: string
  weakness: string
  /** Everyday analogy, 1–2 sentences. */
  analogy: string
  /** Exactly 3 short bullets: the essence. */
  tldr: string[]
  /** Concrete story with numbers: a product situation where this component saves the day (or hurts). */
  example: { title: string; story: string }
  /** Typical setup infographic, 3–6 nodes, laid out left→right in the order given. */
  setup: {
    nodes: { id: string; block?: BlockType; emoji?: string; label: string }[]
    edges: { source: string; target: string; label?: string }[]
    caption: string
  }
  /** Exactly 3 questions, practical, not trivia. */
  quiz: { q: string; options: string[]; correct: number; why: string }[]
}

/** A concrete product implementing a component role (e.g. Postgres / MySQL / LMDB for "database"). */
export interface Implementation {
  name: string
  emoji: string
  /** mainstream = default choice; niche = great for a narrow task; ru = Russian/domestic; managed = cloud service. */
  tier: 'mainstream' | 'niche' | 'ru' | 'managed'
  /** One line: what it is. */
  tagline: string
  /** When it beats the others (concrete). */
  winsWhen: string
  /** What you pay for it. */
  tradeoff: string
  /** Short traits, e.g. "write-optimized", "embedded", "columnar". */
  tags: string[]
}

/** Side-by-side comparison of conceptually different tools for one component role. */
export interface CompareTable {
  /** One line: what the table helps decide. */
  question: string
  /** 5–7 axes, e.g. "Модель данных", "Транзакции", "Масштаб записи". */
  criteria: string[]
  /** 3–5 conceptually different options (not vendor variants of the same thing). */
  rows: {
    name: string
    emoji: string
    /** One value per criterion: short text + verdict for coloring. */
    cells: { text: string; verdict: 'good' | 'ok' | 'bad' }[]
    /** One line: pick this when… */
    pickWhen: string
  }[]
}
