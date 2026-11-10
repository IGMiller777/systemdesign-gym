import clsx from 'clsx'
import { useState } from 'react'
import { parseNumber } from '../components/InstantViews'
import { Markdown } from '../components/Markdown'
import type { EstimateTask } from '../tasks/types'
import { getCard } from '../wiki/cards'
import { shuffled } from '../wiki/Quiz'
import type { WikiEntry } from '../wiki/types'

function Next({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
      Дальше
    </button>
  )
}

/** One quiz question from a card. */
export function QuizItem({ entry, qi, onDone }: { entry: WikiEntry; qi: number; onDone: (ok: boolean) => void }) {
  const card = getCard(entry.id)!
  const raw = card.quiz[qi]
  const order = shuffled(`${entry.id}:${qi}`, raw.options.length)
  const options = order.map((k) => raw.options[k])
  const correct = order.indexOf(raw.correct)
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <div className="space-y-3">
      <div className="text-xs">
        <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-sky-200">
          🎯 Карточка · {card.emoji} {entry.title}
        </span>
      </div>
      <div className="text-base font-medium text-zinc-100">{raw.q}</div>
      <div className="grid gap-2">
        {options.map((o, k) => (
          <button
            key={k}
            onClick={() => picked === null && setPicked(k)}
            className={clsx(
              'rounded-xl border p-3 text-left text-sm transition',
              picked === null && 'border-zinc-800 hover:border-sky-400/60',
              picked !== null && k === correct && 'border-emerald-500/60 bg-emerald-500/10',
              picked === k && k !== correct && 'border-rose-500/60 bg-rose-500/10',
              picked !== null && k !== correct && picked !== k && 'border-zinc-800 opacity-50',
            )}
          >
            {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <>
          <div className={clsx('rounded-lg p-3 text-sm', picked === correct ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>{raw.why}</div>
          <Next onClick={() => onDone(picked === correct)} />
        </>
      )}
    </div>
  )
}

/** Back-of-envelope estimate, one shot. */
export function EstimateItem({ task, onDone }: { task: EstimateTask; onDone: (ok: boolean) => void }) {
  const [value, setValue] = useState('')
  const [res, setRes] = useState<null | { ok: boolean }>(null)
  const check = () => {
    const v = parseNumber(value)
    if (v === null) return
    setRes({ ok: v >= task.answer / task.factor && v <= task.answer * task.factor })
  }
  return (
    <div className="space-y-3">
      <div className="text-xs">
        <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-emerald-200">🧮 Оценка · {task.title}</span>
      </div>
      <Markdown>{task.prompt}</Markdown>
      <div className="flex items-center gap-2">
        <input
          value={value}
          disabled={!!res}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          placeholder="12k, 3.5M…"
          className="w-48 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono outline-none focus:border-sky-400"
        />
        <span className="text-zinc-400">{task.unit}</span>
        {!res && (
          <button onClick={check} className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-zinc-950 hover:bg-sky-400">
            Проверить
          </button>
        )}
      </div>
      {res && (
        <>
          <div className={clsx('rounded-lg p-3 text-sm', res.ok ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>
            {res.ok ? '✅ В пределах' : '❌ Мимо'} — эталон <span className="font-mono">{task.answer.toLocaleString('ru-RU')}</span> {task.unit}
            <details className="mt-2">
              <summary className="cursor-pointer text-zinc-400">Расчёт</summary>
              <Markdown>{task.explanation}</Markdown>
            </details>
          </div>
          <Next onClick={() => onDone(res.ok)} />
        </>
      )}
    </div>
  )
}
