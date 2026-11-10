import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { allTasks } from './tasks'
import { CARD_XP } from './wiki/cards'
import { hardcoreScenarios } from './sim/hardcore'
import { inheritedScenarios } from './sim/inherited'
import { opsScenarios } from './sim/ops-scenarios'
import { frontendScenarios, llmScenarios } from './sim/fe-llm-scenarios'
import { legendScenarios } from './sim/legend-scenarios'
import { scenarios } from './sim/scenarios'
import type { Scenario } from './sim/types'
import type { DiagramEdge, DiagramNode } from './tasks/types'

export interface Attempt {
  at: number
  score: number
}

export interface DesignDraft {
  nodes: DiagramNode[]
  edges: (DiagramEdge & { id: string; sourceHandle?: string | null; targetHandle?: string | null })[]
  notes: Record<string, string>
}

interface State {
  results: Record<string, { best: number; attempts: Attempt[] }>
  days: string[]
  drafts: Record<string, DesignDraft>
  aiScenarios: Scenario[]
  addAiScenario: (s: Scenario) => void
  record: (taskId: string, score: number) => void
  /** Spaced repetition: box 0..4 → next review in 1/3/7/21/60 days. */
  srs: Record<string, { box: number; due: string }>
  review: (itemId: string, ok: boolean) => void
  saveDraft: (taskId: string, draft: DesignDraft) => void
  reset: () => void

  // ── game layer ──
  credits: number
  /** Consumable perks: itemId → count. */
  inventory: Record<string, number>
  /** Owned cosmetics. */
  owned: string[]
  theme: string
  /** achievementId → ISO date unlocked. */
  achievements: Record<string, string>
  /** day → event type → count (for daily quests). */
  events: Record<string, Record<string, number>>
  /** day → claimed quest ids. */
  questsClaimed: Record<string, string[]>
  toasts: Toast[]
  /** Last credit changes, newest first: where coins came from and where they went. */
  ledger: { at: number; amount: number; reason: string }[]
  addCredits: (n: number, reason: string) => void
  buy: (itemId: string, cost: number, kind: 'perk' | 'cosmetic' | 'unlock') => boolean
  useItem: (itemId: string) => boolean
  /** Streak freeze: mark missed days as covered (they count for the streak). */
  coverDays: (days: string[]) => void
  setTheme: (theme: string) => void
  bumpEvent: (type: string, n?: number) => void
  claimQuest: (day: string, questId: string, reward: number, reason: string) => void
  unlock: (achievementId: string) => void
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

export interface Toast {
  id: number
  kind: 'achievement' | 'rank' | 'credits' | 'quest' | 'info'
  title: string
  text?: string
  emoji?: string
}

let toastSeq = 0

/**
 * Progress is saved to a file by the local API server (data/<name>.json) and mirrored to localStorage.
 * Reads prefer the file; if the server is down, localStorage keeps the game working.
 * Writes are debounced and skipped until hydration, so an empty initial state never overwrites the file.
 */
let hydrated = false
const pending = new Map<string, string>()
let flushTimer: ReturnType<typeof setTimeout> | undefined
const flush = (beacon = false) => {
  clearTimeout(flushTimer)
  for (const [name, value] of pending) {
    const url = `/api/progress/${name}`
    if (beacon && navigator.sendBeacon) navigator.sendBeacon(url, new Blob([value], { type: 'application/json' }))
    else void fetch(url, { method: 'PUT', body: value, headers: { 'Content-Type': 'application/json' } }).catch(() => {})
  }
  pending.clear()
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => flush(true))

/** How much progress a saved snapshot holds: number of result entries. */
function weight(raw: string | null): number {
  if (!raw) return -1
  try {
    return Object.keys(JSON.parse(raw)?.state?.results ?? {}).length
  } catch {
    return -1
  }
}

const fileStorage: StateStorage = {
  getItem: async (name) => {
    let file: string | null = null
    let local: string | null = null
    try {
      const r = await fetch(`/api/progress/${name}`)
      if (r.status === 200) file = await r.text()
    } catch {
      // API server is not running: use the browser copy
    }
    try {
      local = localStorage.getItem(name)
    } catch {
      // storage blocked
    }
    // Both exist: keep the one with more progress, so a fresh browser profile never wipes the file and vice versa.
    return weight(local) > weight(file) ? local : (file ?? local)
  },
  setItem: (name, value) => {
    if (!hydrated) return
    try {
      localStorage.setItem(name, value)
    } catch {
      // storage full or blocked: the file copy is the main one anyway
    }
    pending.set(name, value)
    clearTimeout(flushTimer)
    flushTimer = setTimeout(flush, 500)
  },
  removeItem: () => {},
}

export const dayKey = (d: Date) => d.toISOString().slice(0, 10)
export const SRS_DAYS = [1, 3, 7, 21, 60]
export const DAILY_XP = 30
export const CONCEPT_XP = 15
export const EXPLAIN_XP = 10

export const useProgress = create<State>()(
  persist(
    (set) => ({
      results: {},
      days: [],
      drafts: {},
      aiScenarios: [],
      srs: {},
      review: (itemId, ok) =>
        set((s) => {
          const prev = s.srs[itemId]
          const box = ok ? Math.min(SRS_DAYS.length - 1, prev ? prev.box + 1 : 1) : 0
          const due = new Date()
          due.setDate(due.getDate() + SRS_DAYS[box])
          return { srs: { ...s.srs, [itemId]: { box, due: dayKey(due) } } }
        }),
      addAiScenario: (sc) => set((s) => ({ aiScenarios: [sc, ...s.aiScenarios] })),
      record: (taskId, score) =>
        set((s) => {
          const prev = s.results[taskId] ?? { best: 0, attempts: [] }
          const d = dayKey(new Date())
          return {
            results: {
              ...s.results,
              [taskId]: { best: Math.max(prev.best, score), attempts: [...prev.attempts, { at: Date.now(), score }] },
            },
            days: s.days.includes(d) ? s.days : [...s.days, d],
          }
        }),
      saveDraft: (taskId, draft) => set((s) => ({ drafts: { ...s.drafts, [taskId]: draft } })),
      reset: () =>
        set({ results: {}, days: [], drafts: {}, aiScenarios: [], srs: {}, credits: 0, ledger: [], inventory: {}, owned: [], theme: 'default', achievements: {}, events: {}, questsClaimed: {} }),

      credits: 0,
      inventory: {},
      owned: [],
      theme: 'default',
      achievements: {},
      events: {},
      questsClaimed: {},
      toasts: [],
      ledger: [],
      addCredits: (n, reason) => set((s) => ({ credits: s.credits + n, ledger: logEntry(s.ledger, n, reason) })),
      buy: (itemId, cost, kind) => {
        let ok = false
        set((s) => {
          if (s.credits < cost || (kind !== 'perk' && s.owned.includes(itemId))) return {}
          if (itemId === 'perk-freeze' && (s.inventory[itemId] ?? 0) >= 2) return {}
          ok = true
          return kind === 'perk'
            ? { credits: s.credits - cost, ledger: logEntry(s.ledger, -cost, `покупка: ${itemId}`), inventory: { ...s.inventory, [itemId]: (s.inventory[itemId] ?? 0) + 1 } }
            : { credits: s.credits - cost, ledger: logEntry(s.ledger, -cost, `покупка: ${itemId}`), owned: [...s.owned, itemId] }
        })
        return ok
      },
      useItem: (itemId) => {
        let ok = false
        set((s) => {
          if ((s.inventory[itemId] ?? 0) <= 0) return {}
          ok = true
          return { inventory: { ...s.inventory, [itemId]: s.inventory[itemId] - 1 } }
        })
        return ok
      },
      setTheme: (theme) => set({ theme }),
      coverDays: (missed) => set((s) => ({ days: [...s.days, ...missed.filter((d) => !s.days.includes(d))] })),
      bumpEvent: (type, n = 1) =>
        set((s) => {
          const d = dayKey(new Date())
          const today = s.events[d] ?? {}
          return { events: { ...s.events, [d]: { ...today, [type]: (today[type] ?? 0) + n } } }
        }),
      claimQuest: (day, questId, reward, reason) =>
        set((s) => {
          const claimed = s.questsClaimed[day] ?? []
          if (claimed.includes(questId)) return {}
          return { credits: s.credits + reward, ledger: logEntry(s.ledger, reward, reason), questsClaimed: { ...s.questsClaimed, [day]: [...claimed, questId] } }
        }),
      unlock: (id) => set((s) => (s.achievements[id] ? {} : { achievements: { ...s.achievements, [id]: dayKey(new Date()) } })),
      toast: (t) => set((s) => ({ toasts: [...s.toasts, { ...t, id: ++toastSeq }] })),
      dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'sysdesign-gym',
      storage: createJSONStorage(() => fileStorage),
      onRehydrateStorage: () => () => {
        hydrated = true
        // First run with the file storage: copy whatever the browser had into the file right away.
        useProgress.setState({})
      },
      // v1: экономика пересчитана (кредиты за XP 1:4, квесты и достижения дешевле) — старый баланс делим на 3.
      version: 1,
      migrate: (persisted, from) => {
        const s = persisted as State
        if (from < 1) {
          const credits = Math.round((s.credits ?? 0) / 3)
          return { ...s, credits, ledger: logEntry(s.ledger ?? [], credits - (s.credits ?? 0), 'пересчёт экономики: баланс ÷ 3') }
        }
        return s
      },
      partialize: (s) => {
        const { toasts: _toasts, ...rest } = s
        return rest
      },
    },
  ),
)

const LEDGER_SIZE = 50
function logEntry(ledger: State['ledger'], amount: number, reason: string): State['ledger'] {
  return amount === 0 ? ledger : [{ at: Date.now(), amount, reason }, ...ledger].slice(0, LEDGER_SIZE)
}

export const simKey = (scenarioId: string) => `sim:${scenarioId}`
export const scenarioXp = (level: number) => level * 40

/** XP for a task or scenario counts once, scaled by the best score. */
export function totalXp(results: State['results']): number {
  const tasks = allTasks.reduce((sum, t) => sum + Math.round((t.xp * (results[t.id]?.best ?? 0)) / 100), 0)
  const sims = [...scenarios, ...hardcoreScenarios, ...inheritedScenarios, ...opsScenarios, ...frontendScenarios, ...llmScenarios, ...legendScenarios].reduce(
    (sum, s) => sum + Math.round((scenarioXp(s.level + (s.hardOf ? 2 : s.configOnly ? 1 : 0)) * (results[simKey(s.id)]?.best ?? 0)) / 100),
    0,
  )
  const cards = Object.entries(results).filter(([k, r]) => k.startsWith('card:') && r.best >= 66).length * CARD_XP
  const daily = Object.keys(results).filter((k) => k.startsWith('daily:')).length * DAILY_XP
  const passed = (prefix: string, min: number) => Object.entries(results).filter(([k, r]) => k.startsWith(prefix) && r.best >= min).length
  const lessons = passed('concept:', 66) * CONCEPT_XP + passed('explain:', 60) * EXPLAIN_XP
  const sum = (prefix: string, perPoint: number) =>
    Object.entries(results)
      .filter(([k]) => k.startsWith(prefix))
      .reduce((a, [, r]) => a + Math.round(r.best * perPoint), 0)
  // Blue Team: best = stars × 33 (→ up to ~60 XP); CTF: 30 XP per cracked level
  const security = sum('def:', 0.6) + passed('ctf:', 1) * 30
  // Mock-интервью: до 150 XP за задачу (лучший балл × 1,5)
  const interviews = sum('interview:', 1.5)
  return tasks + sims + cards + daily + lessons + security + interviews
}

export function streak(days: string[]): number {
  const set = new Set(days)
  const d = new Date()
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (set.has(dayKey(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}
