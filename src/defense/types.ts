import type { BlockType } from '../tasks/types'

/** Security zones an attack passes through, outer → inner. */
export type Zone = 'edge' | 'app' | 'data' | 'agent' | 'supply' | 'people'

export interface Defense {
  id: string
  name: string
  emoji: string
  zone: Zone
  /** Budget points to install. */
  cost: number
  /** 0..3: how much it annoys users or slows developers. */
  friction: number
  /** One line: what it does (Russian). */
  blurb: string
  /** Real-world tools/practices, e.g. "Cloudflare WAF, ModSecurity". */
  realWorld: string
}

export interface Attack {
  id: string
  name: string
  emoji: string
  /** Short line: how the attacker gets in. */
  vector: string
  /** Zones traversed in order; each installed counter in a zone gets a chance to block. */
  path: Zone[]
  /** Which defenses stop it and how reliably (0..1). */
  counters: { defense: string; effectiveness: number }[]
  /** Trust damage if it gets through. */
  impact: number
  /** Markdown: how the attack works, 2–4 sentences. */
  explain: string
  /** Markdown: what a well-known class of real incidents looked like (no fabricated specifics). */
  incident: string
}

export interface Wave {
  /** Wave number (1..n). */
  n: number
  attacks: { attack: string; count: number }[]
  /** Extra budget granted before this wave (0 for the first). */
  bonusBudget: number
  /** Intel shown before the wave: hint at what's coming (Russian). */
  intel: string
}

export interface DefenseLevel {
  id: string
  level: number
  title: string
  /** Markdown: the company, the system, what's at stake. */
  briefing: string
  system: {
    nodes: { id: string; zone: Zone; label: string; block?: BlockType; emoji?: string }[]
    edges: { source: string; target: string }[]
  }
  /** Starting trust (health), e.g. 100. */
  trust: number
  budget: number
  /** Defense ids the player may buy in this level. */
  available: string[]
  /** Defenses already installed at start (free). */
  preinstalled?: string[]
  waves: Wave[]
  /** Markdown: ideal setup and why. */
  debrief: string
}

export interface AttackResult {
  attack: string
  /** Index of the instance within its wave. */
  i: number
  blocked: boolean
  /** Defense that blocked it. */
  by?: string
  /** Zone where it was blocked, or where it hit if not blocked. */
  zone: Zone
  damage: number
}
