import { rankOf } from '../lib/blocks'
import { dayKey, totalXp, useProgress } from '../store'
import { achievements, XP_PER_CREDIT } from './defs'

/** Which daily-quest event a result key produces, and the score needed to count. */
function eventOf(key: string): { type: string; min: number } | null {
  if (key.startsWith('card:')) return { type: 'quiz', min: 66 }
  if (key.startsWith('concept:')) return { type: 'lesson', min: 66 }
  if (key.startsWith('explain:')) return { type: 'explain', min: 60 }
  if (key.startsWith('sim:')) return { type: key.startsWith('sim:inh-') ? 'inherited' : 'scenario', min: 1 }
  if (key.startsWith('daily:')) return { type: 'daily', min: 1 }
  if (key.startsWith('def:')) return { type: 'defense', min: 1 }
  if (key.startsWith('ctf:')) return { type: 'ctf', min: 1 }
  if (key.startsWith('interview:')) return { type: 'interview', min: 1 }
  if (key.includes(':')) return null
  return { type: 'task', min: 1 }
}

/**
 * Game layer reacts to progress changes: credits for XP gained, daily-quest events,
 * achievements and rank-ups (with toasts). Kept outside the store to avoid import cycles.
 */
/**
 * Streak freeze: on start, if the streak broke by 1–2 missed days and freezes are in stock,
 * spend one freeze per missed day so the streak survives.
 */
function applyStreakFreeze() {
  const g = useProgress.getState()
  const have = g.inventory['perk-freeze'] ?? 0
  if (!have || !g.days.length) return
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const missed: string[] = []
  while (!g.days.includes(dayKey(d)) && missed.length < have) {
    missed.push(dayKey(d))
    d.setDate(d.getDate() - 1)
  }
  // Freeze only bridges a gap to an existing streak; otherwise keep the freezes.
  if (!missed.length || !g.days.includes(dayKey(d))) return
  for (const _ of missed) g.useItem('perk-freeze')
  g.coverDays(missed)
  g.toast({ kind: 'info', emoji: '🧊', title: 'Серия спасена', text: `Заморозка закрыла пропуск: ${missed.length} дн.` })
}

export function startGameWatcher() {
  applyStreakFreeze()
  return useProgress.subscribe((s, prev) => {
    if (s.results === prev.results && s.srs === prev.srs && s.inventory === prev.inventory && s.owned === prev.owned) return
    const g = useProgress.getState()

    if (s.results !== prev.results) {
      for (const [key, r] of Object.entries(s.results)) {
        const before = prev.results[key]
        if (before && before.attempts.length === r.attempts.length) continue
        const ev = eventOf(key)
        const last = r.attempts.at(-1)
        if (ev && last && last.score >= ev.min) g.bumpEvent(ev.type)
      }
      const xp0 = totalXp(prev.results)
      const xp1 = totalXp(s.results)
      const coins = Math.floor(xp1 / XP_PER_CREDIT) - Math.floor(xp0 / XP_PER_CREDIT)
      if (xp1 > xp0) {
        if (coins > 0) g.addCredits(coins, `+${xp1 - xp0} XP`)
        g.toast({ kind: 'credits', emoji: '🪙', title: `+${xp1 - xp0} XP`, text: coins > 0 ? `+${coins} 🪙` : `монета каждые ${XP_PER_CREDIT} XP` })
      }
      const r0 = rankOf(totalXp(prev.results)).current
      const r1 = rankOf(totalXp(s.results)).current
      if (r1.xp > r0.xp) g.toast({ kind: 'rank', emoji: '🚀', title: `Новое звание: ${r1.name}!`, text: 'Повышение — так держать' })
    }

    if (s.srs !== prev.srs) {
      for (const [key, r] of Object.entries(s.srs)) {
        if (!key.startsWith('duel:')) continue
        const before = prev.srs[key]
        if (r.box >= 1 && (!before || r.box > before.box)) g.bumpEvent('duel')
      }
    }

    const now = useProgress.getState()
    for (const a of achievements) {
      if (now.achievements[a.id] || !a.test(now)) continue
      g.unlock(a.id)
      g.addCredits(a.reward, `достижение: ${a.title}`)
      g.toast({ kind: 'achievement', emoji: a.emoji, title: `Достижение: ${a.title}`, text: `${a.text} · +${a.reward} 🪙` })
    }
  })
}
