import clsx from 'clsx'
import { RotateCcw, Trophy } from 'lucide-react'
import { useState } from 'react'
import { useProgress } from '../store'
import { CARD_XP, cardKey } from './cards'
import type { WikiCard } from './types'

/** Deterministic shuffle so the right answer isn't always in the same slot. */
export function shuffled(seed: string, n: number): number[] {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const order = [...Array(n).keys()]
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    const j = (h >>> 0) % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/** 3-question check; 2/3+ masters the card and grants XP. */
export function Quiz({ id, quiz, recordKey = cardKey(id), xp = CARD_XP, doneLabel = 'карточка освоена!' }: { id: string; quiz: WikiCard['quiz']; recordKey?: string; xp?: number; doneLabel?: string }) {
  const record = useProgress((s) => s.record)
  const best = useProgress((s) => s.results[recordKey]?.best ?? 0)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  /** After a wrong pick the answer stays hidden while a second chance is possible. */
  const [revealed, setRevealed] = useState(false)
  const [burned, setBurned] = useState<number[]>([])
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const retries = useProgress((s) => s.inventory['perk-retry'] ?? 0)
  const cuts = useProgress((s) => s.inventory['perk-5050'] ?? 0)
  const useItem = useProgress((s) => s.useItem)

  const raw = quiz[i]
  const order = shuffled(`${id}:${i}`, raw.options.length)
  const q = { ...raw, options: order.map((k) => raw.options[k]), correct: order.indexOf(raw.correct) }
  const answer = (k: number) => {
    if (picked !== null || burned.includes(k)) return
    setPicked(k)
    if (k === q.correct) {
      setScore((s) => s + 1) // the perk's whole point: a second-chance hit counts
      setRevealed(true)
    } else if (retries <= 0) setRevealed(true)
  }
  const next = () => {
    if (i + 1 < quiz.length) {
      setI(i + 1)
      setPicked(null)
      setRevealed(false)
      setBurned([])
      return
    }
    const pct = Math.round((score / quiz.length) * 100)
    record(recordKey, pct >= 66 ? pct : 0)
    setDone(true)
  }
  const restart = () => {
    setI(0)
    setPicked(null)
    setRevealed(false)
    setBurned([])
    setScore(0)
    setDone(false)
  }

  if (done) {
    const passed = score / quiz.length >= 0.66
    return (
      <div className={clsx('space-y-3 rounded-xl border p-5 text-center', passed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5')}>
        <div className="text-4xl">{passed ? '🏆' : '📚'}</div>
        <div className="text-lg font-semibold">
          {score} из {quiz.length} — {passed ? doneLabel : 'почти, попробуй ещё'}
        </div>
        {passed && (
          <div className="flex items-center justify-center gap-1 text-sm text-amber-300">
            <Trophy size={14} /> +{xp} XP
          </div>
        )}
        <button onClick={restart} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700">
          <RotateCcw size={14} /> Пройти заново
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-200">🎯 Проверь себя</span>
        <span className="flex items-center gap-2 text-xs text-zinc-500">
          {best >= 66 && <span className="text-emerald-400">освоена ✓</span>}
          {quiz.map((_, k) => (
            <span key={k} className={clsx('h-1.5 w-6 rounded-full', k < i ? 'bg-sky-400' : k === i ? 'bg-zinc-300' : 'bg-zinc-700')} />
          ))}
        </span>
      </div>
      <div className="text-base font-medium text-zinc-100">{q.q}</div>
      {picked === null && burned.length === 0 && cuts > 0 && q.options.length > 2 && (
        <button
          onClick={() => {
            if (!useItem('perk-5050')) return
            const wrong = q.options.map((_, k) => k).filter((k) => k !== q.correct)
            setBurned(wrong.sort(() => Math.random() - 0.5).slice(0, q.options.length - 2))
          }}
          className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          ✂️ Убрать лишнее ({cuts})
        </button>
      )}
      <div className="grid gap-2">
        {q.options.map((o, k) => (
          <button
            key={k}
            onClick={() => answer(k)}
            className={clsx(
              'rounded-xl border p-3 text-left text-sm transition',
              picked === null && !burned.includes(k) && 'border-zinc-800 hover:border-sky-400/60 hover:bg-sky-400/5',
              burned.includes(k) && 'border-zinc-800 line-through opacity-40',
              revealed && k === q.correct && 'border-emerald-500/60 bg-emerald-500/10',
              picked === k && k !== q.correct && 'border-rose-500/60 bg-rose-500/10',
              revealed && k !== q.correct && picked !== k && !burned.includes(k) && 'border-zinc-800 opacity-50',
            )}
          >
            {o}
          </button>
        ))}
      </div>
      {picked !== null && !revealed && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-100">
          <span className="flex-1">Мимо.</span>
          <button
            onClick={() => {
              if (!useItem('perk-retry')) return
              setBurned([...burned, picked])
              setPicked(null)
            }}
            className="rounded-lg bg-amber-400 px-3 py-1.5 font-medium text-zinc-950 hover:bg-amber-300"
          >
            🔁 Второй шанс ({retries})
          </button>
          <button onClick={() => setRevealed(true)} className="rounded-lg bg-zinc-800 px-3 py-1.5 hover:bg-zinc-700">
            Показать ответ
          </button>
        </div>
      )}
      {picked !== null && revealed && (
        <div className="space-y-3">
          <div className={clsx('rounded-lg p-3 text-sm', picked === q.correct ? 'bg-emerald-500/10 text-emerald-100' : 'bg-rose-500/10 text-rose-100')}>
            {picked === q.correct ? '✅ ' : '❌ '}
            {q.why}
          </div>
          <button onClick={next} className="rounded-lg bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
            {i + 1 < quiz.length ? 'Дальше' : 'Итог'}
          </button>
        </div>
      )}
    </div>
  )
}
