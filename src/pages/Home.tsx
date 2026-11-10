import clsx from 'clsx'
import { Check, Flame, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { levels, rankOf, topics } from '../lib/blocks'
import { streak, totalXp, useProgress } from '../store'
import { allTasks } from '../tasks'
import type { Topic } from '../tasks/types'

export function Home() {
  const results = useProgress((s) => s.results)
  const days = useProgress((s) => s.days)
  const [topic, setTopic] = useState<Topic | 'all'>('all')
  const xp = totalXp(results)
  const { current, next } = rankOf(xp)
  const progress = next ? ((xp - current.xp) / (next.xp - current.xp)) * 100 : 100
  const solved = allTasks.filter((t) => (results[t.id]?.best ?? 0) > 0).length
  const usedTopics = [...new Set(allTasks.map((t) => t.topic))]
  const tasks = allTasks.filter((t) => topic === 'all' || t.topic === topic)
  const byLevel: Record<number, typeof tasks> = {}
  for (const t of tasks) (byLevel[t.level] ??= []).push(t)

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="space-y-5">
        <h1 className="text-2xl font-bold tracking-tight">Задачи</h1>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Trophy size={14} className="text-amber-300" /> Ранг
            </div>
            <div className="mt-1 text-xl font-semibold">{current.name}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {xp} XP{next && ` · до ${next.name} ${next.xp - xp}`}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Flame size={14} className="text-orange-400" /> Серия
            </div>
            <div className="mt-1 text-xl font-semibold">{streak(days)} дн.</div>
            <div className="mt-1 text-xs text-zinc-500">Реши хотя бы одну задачу сегодня</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Check size={14} className="text-emerald-400" /> Решено
            </div>
            <div className="mt-1 text-xl font-semibold">
              {solved} <span className="text-zinc-500">/ {allTasks.length}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['all', ...usedTopics] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs',
                topic === t ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200',
              )}
            >
              {t === 'all' ? 'Все' : topics[t]}
            </button>
          ))}
        </div>
      </header>

      {Object.entries(byLevel).map(([level, list]) => (
        <section key={level} className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-400">
            <span className={clsx('rounded-md px-2 py-0.5 text-xs', levels[Number(level)].color)}>L{level}</span>
            {levels[Number(level)].name}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {list.map((t) => {
              const best = results[t.id]?.best
              return (
                <Link
                  key={t.id}
                  to={`/task/${t.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 transition hover:border-zinc-600 hover:bg-zinc-900"
                >
                  <div
                    className={clsx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                      best === undefined && 'border border-zinc-700 text-zinc-600',
                      best !== undefined && best >= 70 && 'bg-emerald-500/20 text-emerald-300',
                      best !== undefined && best < 70 && 'bg-amber-500/20 text-amber-300',
                    )}
                  >
                    {best === undefined ? '' : best >= 100 ? <Check size={14} /> : best}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-200 group-hover:text-white">{t.title}</div>
                    <div className="text-xs text-zinc-500">{topics[t.topic]}</div>
                  </div>
                  <div className="text-xs text-amber-300/80">{t.xp} XP</div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
