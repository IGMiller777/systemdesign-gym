import clsx from 'clsx'
import { ArrowLeft, Lightbulb, Trophy } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { levels, topics } from '../lib/blocks'
import { useProgress } from '../store'
import type { Task } from '../tasks/types'
import { Markdown } from './Markdown'

export function TaskHeader({ task }: { task: Task }) {
  const best = useProgress((s) => s.results[task.id]?.best)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link to="/" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
        <ArrowLeft size={18} />
      </Link>
      <span className={clsx('rounded-md px-2 py-0.5 text-xs font-medium', levels[task.level].color)}>
        L{task.level} · {levels[task.level].name}
      </span>
      <span className="text-xs text-zinc-500">{topics[task.topic]}</span>
      <h1 className="text-lg font-semibold">{task.title}</h1>
      <span className="ml-auto flex items-center gap-1 text-sm text-amber-300">
        <Trophy size={14} /> {task.xp} XP
        {best !== undefined && <span className="text-zinc-500">· лучший {best}%</span>}
      </span>
    </div>
  )
}

export function Hints({ hints }: { hints?: string[] }) {
  const [shown, setShown] = useState(0)
  if (!hints?.length) return null
  return (
    <div className="space-y-2">
      {hints.slice(0, shown).map((h, i) => (
        <div key={i} className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-sm text-amber-100">
          <Markdown>{h}</Markdown>
        </div>
      ))}
      {shown < hints.length && (
        <button
          onClick={() => setShown(shown + 1)}
          className="flex items-center gap-1.5 text-sm text-amber-300 hover:text-amber-200"
        >
          <Lightbulb size={14} /> Подсказка {shown + 1}/{hints.length}
        </button>
      )}
    </div>
  )
}

export function Verdict({ ok, score, children }: { ok: boolean; score: number; children: ReactNode }) {
  return (
    <div
      className={clsx(
        'space-y-3 rounded-xl border p-4',
        ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5',
      )}
    >
      <div className={clsx('text-base font-semibold', ok ? 'text-emerald-300' : 'text-rose-300')}>
        {ok ? `Верно! +${score}%` : 'Мимо'}
      </div>
      {children}
    </div>
  )
}

/** Instant-check tasks: 100% on the first try, minus 25% per wrong attempt. */
export const scoreForAttempt = (wrongTries: number) => Math.max(25, 100 - wrongTries * 25)
