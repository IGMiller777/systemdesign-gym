import clsx from 'clsx'
import { ArrowRight, Check, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { useProgress } from '../store'
import { allTasks } from '../tasks'
import type { ChoiceTask, EstimateTask, Task } from '../tasks/types'
import { Markdown } from './Markdown'
import { Hints, scoreForAttempt, TaskHeader, Verdict } from './TaskShell'
import { inPath, ModuleNav } from './ModuleNav'

export function NextLink({ task }: { task: Task }) {
  // Задача из пути обучения ведёт к следующему шагу модуля, остальные — к следующей задаче каталога.
  if (inPath('task', task.id)) return <ModuleNav kind="task" id={task.id} className="w-full" />
  const i = allTasks.findIndex((t) => t.id === task.id)
  const next = allTasks[i + 1]
  if (!next) return null
  return (
    <Link
      to={`/task/${next.id}`}
      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
    >
      Следующая: {next.title} <ArrowRight size={14} />
    </Link>
  )
}

export function InstantLayout({ task, children }: { task: Task; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <TaskHeader task={task} />
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <Markdown>{task.prompt}</Markdown>
      </div>
      {children}
    </div>
  )
}

const suffixes: Record<string, number> = { k: 1e3, к: 1e3, m: 1e6, м: 1e6, g: 1e9, b: 1e9, г: 1e9, млрд: 1e9, t: 1e12, т: 1e12 }

export function parseNumber(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s|_/g, '').replace(',', '.')
  const m = s.match(/^([\d.]+(?:e[+-]?\d+)?)([a-zа-я]*)$/)
  if (!m) return null
  const mult = m[2] ? suffixes[m[2]] : 1
  const n = Number(m[1])
  return mult && Number.isFinite(n) ? n * mult : null
}

const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })

export function EstimateView({ task }: { task: EstimateTask }) {
  const record = useProgress((s) => s.record)
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState<{ value: number; dir: 'high' | 'low' }[]>([])
  const [done, setDone] = useState<null | { ok: boolean; score: number }>(null)

  const check = () => {
    const v = parseNumber(value)
    if (v === null || done) return
    if (v >= task.answer / task.factor && v <= task.answer * task.factor) {
      const score = scoreForAttempt(wrong.length)
      record(task.id, score)
      setDone({ ok: true, score })
    } else {
      setWrong([...wrong, { value: v, dir: v > task.answer ? 'high' : 'low' }])
    }
  }

  const giveUp = () => {
    record(task.id, 0)
    setDone({ ok: false, score: 0 })
  }

  return (
    <InstantLayout task={task}>
      <Hints hints={task.hints} />
      <div className="flex flex-wrap items-center gap-3">
        <input
          autoFocus
          value={value}
          disabled={!!done}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          placeholder="например 12k, 3.5M, 2e9"
          className="w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono outline-none focus:border-sky-400"
        />
        <span className="text-zinc-400">{task.unit}</span>
        <button
          onClick={check}
          disabled={!!done}
          className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-zinc-950 hover:bg-sky-400 disabled:opacity-40"
        >
          Проверить
        </button>
        {!done && wrong.length > 0 && (
          <button onClick={giveUp} className="text-sm text-zinc-500 hover:text-zinc-300">
            Сдаться
          </button>
        )}
      </div>
      <div className="text-xs text-zinc-500">Засчитывается, если ответ в пределах ×{task.factor} от эталона.</div>
      {wrong.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {wrong.map((w, i) => (
            <span key={i} className="rounded-md bg-rose-500/10 px-2 py-1 font-mono text-xs text-rose-300">
              {fmt(w.value)} → {w.dir === 'high' ? 'слишком много ↓' : 'слишком мало ↑'}
            </span>
          ))}
        </div>
      )}
      {done && (
        <Verdict ok={done.ok} score={done.score}>
          <div className="text-sm text-zinc-300">
            Эталон: <span className="font-mono text-zinc-100">{fmt(task.answer)}</span> {task.unit}
          </div>
          <Markdown>{task.explanation}</Markdown>
          <NextLink task={task} />
        </Verdict>
      )}
    </InstantLayout>
  )
}

export function ChoiceView({ task }: { task: ChoiceTask }) {
  const record = useProgress((s) => s.record)
  const [picked, setPicked] = useState<string[]>([])
  const [done, setDone] = useState<null | { ok: boolean; score: number }>(null)

  const toggle = (id: string) => {
    if (done) return
    if (!task.multiple) return setPicked([id])
    setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id])
  }

  const check = () => {
    const ok = picked.length === task.correct.length && picked.every((p) => task.correct.includes(p))
    const score = ok ? 100 : 0
    record(task.id, score)
    setDone({ ok, score })
  }

  return (
    <InstantLayout task={task}>
      <Hints hints={task.hints} />
      {task.multiple && <div className="text-xs text-zinc-500">Несколько правильных ответов.</div>}
      <div className="space-y-2">
        {task.options.map((o) => {
          const isPicked = picked.includes(o.id)
          const isCorrect = task.correct.includes(o.id)
          return (
            <button
              key={o.id}
              onClick={() => toggle(o.id)}
              className={clsx(
                'block w-full rounded-xl border p-3 text-left transition',
                !done && (isPicked ? 'border-sky-400 bg-sky-400/10' : 'border-zinc-800 hover:border-zinc-600'),
                done && isCorrect && 'border-emerald-500/50 bg-emerald-500/5',
                done && !isCorrect && isPicked && 'border-rose-500/50 bg-rose-500/5',
                done && !isCorrect && !isPicked && 'border-zinc-800 opacity-60',
              )}
            >
              <div className="flex items-start gap-2">
                {done && (isCorrect ? <Check size={16} className="mt-0.5 text-emerald-400" /> : isPicked ? <X size={16} className="mt-0.5 text-rose-400" /> : null)}
                <div className="flex-1">
                  <Markdown>{o.label}</Markdown>
                  {done && (
                    <div className="mt-1 text-sm text-zinc-400">
                      <Markdown>{o.why}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
      {!done ? (
        <button
          onClick={check}
          disabled={!picked.length}
          className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-zinc-950 hover:bg-sky-400 disabled:opacity-40"
        >
          Проверить
        </button>
      ) : (
        <Verdict ok={done.ok} score={done.score}>
          <Markdown>{task.explanation}</Markdown>
          <NextLink task={task} />
        </Verdict>
      )}
    </InstantLayout>
  )
}
