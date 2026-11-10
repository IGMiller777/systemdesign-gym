import clsx from 'clsx'
import { Check, Gift, Lock } from 'lucide-react'
import { Link } from 'react-router'
import { achievements, CHEST_REWARD, questsFor, shop, XP_PER_CREDIT } from '../game/defs'
import { rankOf, ranks } from '../lib/blocks'
import { dayKey, streak, totalXp, useProgress } from '../store'

/** Purchases are logged by item id; show the item's name. */
const ledgerReason = (reason: string) =>
  reason.startsWith('покупка: ') ? `покупка: ${shop.find((i) => `покупка: ${i.id}` === reason)?.name ?? reason.slice(9)}` : reason

// Stable empties: a selector returning a fresh {} / [] makes zustand re-render forever
const NO_EVENTS: Record<string, number> = {}
const NO_CLAIMS: string[] = []

export function QuestsPanel({ compact }: { compact?: boolean }) {
  const today = dayKey(new Date())
  const events = useProgress((s) => s.events[today]) ?? NO_EVENTS
  const claimed = useProgress((s) => s.questsClaimed[today]) ?? NO_CLAIMS
  const claimQuest = useProgress((s) => s.claimQuest)
  const toast = useProgress((s) => s.toast)
  const quests = questsFor(today)
  const allClaimed = quests.every((q) => claimed.includes(q.id))
  const chestClaimed = claimed.includes('chest')

  const claim = (id: string, reward: number, title: string) => {
    claimQuest(today, id, reward, id === 'chest' ? 'сундук дня' : `квест: ${quests.find((q) => q.id === id)?.text ?? id}`)
    toast({ kind: 'quest', emoji: id === 'chest' ? '🎁' : '📜', title, text: `+${reward} 🪙` })
  }

  return (
    <div className="space-y-2">
      {quests.map((q) => {
        const n = Math.min(q.target, events[q.event] ?? 0)
        const done = n >= q.target
        const got = claimed.includes(q.id)
        return (
          <div key={q.id} className={clsx('flex items-center gap-3 rounded-xl border p-3', got ? 'border-zinc-800 opacity-60' : done ? 'border-emerald-400/50 bg-emerald-400/5' : 'border-zinc-800')}>
            <span className="text-2xl">{q.emoji}</span>
            <div className="min-w-0 flex-1">
              <Link to={q.link} className="text-sm font-medium text-zinc-100 hover:underline">
                {q.text}
              </Link>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${(n / q.target) * 100}%` }} />
              </div>
            </div>
            {got ? (
              <Check size={18} className="text-emerald-400" />
            ) : (
              <button
                disabled={!done}
                onClick={() => claim(q.id, q.reward, `Квест выполнен: ${q.text}`)}
                className="rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-semibold text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {done ? `Забрать ${q.reward} 🪙` : `${n}/${q.target} · ${q.reward} 🪙`}
              </button>
            )}
          </div>
        )
      })}
      {!compact && (
        <button
          disabled={!allClaimed || chestClaimed}
          onClick={() => claim('chest', CHEST_REWARD, 'Сундук дня открыт!')}
          className={clsx(
            'flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 text-sm font-medium',
            allClaimed && !chestClaimed ? 'animate-pulse border-amber-300 text-amber-200' : 'border-zinc-800 text-zinc-500',
          )}
        >
          <Gift size={16} /> {chestClaimed ? 'Сундук дня открыт' : `Сундук дня: все 3 квеста → +${CHEST_REWARD} 🪙`}
        </button>
      )}
    </div>
  )
}

export function Profile() {
  const s = useProgress()
  const xp = totalXp(s.results)
  const { current, next } = rankOf(xp)
  const unlocked = achievements.filter((a) => s.achievements[a.id]).length

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-sky-400/30 bg-sky-400/[0.06] p-5 md:col-span-2">
          <div className="text-xs text-sky-300">Звание</div>
          <div className="mt-1 text-3xl font-bold">{current.name}</div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400" style={{ width: `${next ? ((xp - current.xp) / (next.xp - current.xp)) * 100 : 100}%` }} />
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            {xp} XP{next && ` · до ${next.name} ещё ${next.xp - xp}`}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {ranks.map((r) => (
              <span key={r.name} className={clsx('rounded-full px-2.5 py-0.5 text-xs', xp >= r.xp ? 'bg-sky-400/20 text-sky-200' : 'bg-zinc-900 text-zinc-600')}>
                {r.name}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-5">
          <div className="text-xs text-amber-300">Кошелёк</div>
          <div className="text-4xl font-bold text-amber-200">🪙 {s.credits}</div>
          <div className="text-xs text-zinc-400">1 XP = 1 кредит, плюс квесты и достижения</div>
          <div className="text-sm text-orange-300">🔥 серия {streak(s.days)} дн.</div>
          <Link to="/shop" className="block rounded-lg bg-amber-400 py-2 text-center text-sm font-semibold text-zinc-950 hover:bg-amber-300">
            🛒 В магазин
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">📜 Квесты дня</h2>
        <QuestsPanel />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🪙 Откуда кредиты</h2>
        <p className="text-sm text-zinc-400">1 монета за каждые {XP_PER_CREDIT} XP, плюс квесты, сундук дня и достижения.</p>
        {s.ledger.length === 0 ? (
          <div className="text-sm text-zinc-500">Пока ничего: начисления появятся здесь.</div>
        ) : (
          <div className="max-h-64 divide-y divide-zinc-800/80 overflow-y-auto rounded-xl border border-zinc-800 text-sm">
            {s.ledger.map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <span className="w-24 shrink-0 font-mono text-xs text-zinc-500">
                  {new Date(e.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="min-w-0 flex-1 truncate text-zinc-300">{ledgerReason(e.reason)}</span>
                <span className={clsx('font-mono', e.amount > 0 ? 'text-amber-200' : 'text-zinc-400')}>
                  {e.amount > 0 ? '+' : ''}
                  {e.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🎒 Инвентарь</h2>
        <div className="flex flex-wrap gap-2">
          {shop
            .filter((i) => i.kind === 'perk')
            .map((i) => (
              <div key={i.id} className="flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm">
                <span className="text-xl">{i.emoji}</span>
                {i.name}
                <span className="font-mono text-amber-200">×{s.inventory[i.id] ?? 0}</span>
              </div>
            ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          🏆 Достижения <span className="text-sm font-normal text-zinc-500">{unlocked} / {achievements.length}</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {achievements.map((a) => {
            const got = s.achievements[a.id]
            const hidden = a.secret && !got
            return (
              <div
                key={a.id}
                className={clsx('rounded-2xl border p-3 text-center transition', got ? 'border-amber-300/50 bg-amber-300/5 shadow-lg shadow-amber-400/10' : 'border-zinc-800 opacity-60')}
              >
                <div className={clsx('text-4xl', !got && 'grayscale')}>{hidden ? '❓' : a.emoji}</div>
                <div className="mt-1 text-sm font-semibold">{hidden ? 'Секрет' : a.title}</div>
                <div className="text-xs text-zinc-400">{hidden ? 'Откроется само' : a.text}</div>
                <div className="mt-1 text-[11px] text-amber-300">{got ? `✓ ${got}` : `+${a.reward} 🪙`}</div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export function Shop() {
  const credits = useProgress((s) => s.credits)
  const inventory = useProgress((s) => s.inventory)
  const owned = useProgress((s) => s.owned)
  const theme = useProgress((s) => s.theme)
  const buy = useProgress((s) => s.buy)
  const setTheme = useProgress((s) => s.setTheme)
  const toast = useProgress((s) => s.toast)

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🛒 Магазин</h1>
          <p className="mt-1 text-sm text-zinc-400">Перки помогают в бою, косметика — для красоты. Кредиты зарабатываются любым прогрессом.</p>
        </div>
        <div className="text-2xl font-bold text-amber-200">🪙 {credits}</div>
      </div>
      {(['perk', 'unlock', 'cosmetic'] as const).map((kind) => (
        <section key={kind} className="space-y-3">
          <h2 className="text-lg font-semibold">{kind === 'perk' ? '⚡ Перки' : kind === 'unlock' ? '🏛️ Легендарные дежурства' : '🎨 Косметика'}</h2>
          {kind === 'unlock' && <p className="text-sm text-zinc-400">Упрощённые модели известных публичных аварий. После покупки появляются в разделе «Дежурство».</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shop
              .filter((i) => i.kind === kind)
              .map((i) => {
                const has = owned.includes(i.id)
                const isTheme = i.id.startsWith('theme-')
                const active = isTheme && theme === i.id
                return (
                  <div key={i.id} className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:-translate-y-0.5 hover:border-zinc-600">
                    <div className="text-4xl">{i.emoji}</div>
                    <div className="mt-2 font-semibold">{i.name}</div>
                    <div className="flex-1 text-xs text-zinc-400">{i.text}</div>
                    {kind === 'perk' && <div className="mt-2 text-xs text-zinc-500">В инвентаре: {inventory[i.id] ?? 0}</div>}
                    {has && isTheme ? (
                      <button
                        onClick={() => setTheme(active ? 'default' : i.id)}
                        className={clsx('mt-3 rounded-lg py-1.5 text-sm font-medium', active ? 'bg-emerald-400 text-zinc-950' : 'bg-zinc-800 hover:bg-zinc-700')}
                      >
                        {active ? 'Включена ✓' : 'Включить'}
                      </button>
                    ) : has && kind === 'unlock' ? (
                      <Link to={`/oncall/${i.id}`} className="mt-3 rounded-lg bg-emerald-400 py-1.5 text-center text-sm font-semibold text-zinc-950 hover:bg-emerald-300">
                        Играть
                      </Link>
                    ) : has ? (
                      <div className="mt-3 rounded-lg bg-zinc-800 py-1.5 text-center text-sm text-emerald-300">Куплено ✓</div>
                    ) : (
                      <button
                        disabled={credits < i.cost}
                        onClick={() => {
                          if (buy(i.id, i.cost, i.kind)) toast({ kind: 'info', emoji: i.emoji, title: `Куплено: ${i.name}` })
                        }}
                        className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-amber-400 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:bg-zinc-800 disabled:text-zinc-500"
                      >
                        {credits < i.cost && <Lock size={12} />} {i.cost} 🪙
                      </button>
                    )}
                  </div>
                )
              })}
          </div>
        </section>
      ))}
    </div>
  )
}
