import clsx from 'clsx'
import { useState } from 'react'
import { Link } from 'react-router'
import { Markdown } from '../components/Markdown'
import type { Duel } from '../duels/types'
import { useProgress } from '../store'
import { shuffled } from '../wiki/Quiz'

/** Trade-off duel: pick the winner for the stated constraints, then see the price and when it flips. */
export function DuelItem({ duel: raw, onDone }: { duel: Duel; onDone: (ok: boolean) => void }) {
  const order = shuffled(raw.id, raw.options.length)
  const duel = { ...raw, options: order.map((k) => raw.options[k]), correct: order.indexOf(raw.correct) }
  const [picked, setPicked] = useState<number | null>(null)
  const [cut, setCut] = useState<number | null>(null)
  const cuts = useProgress((s) => s.inventory['perk-5050'] ?? 0)
  const useItem = useProgress((s) => s.useItem)
  const ok = picked === duel.correct
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-amber-200">⚔️ Дуэль</span>
        <span className="text-zinc-500">{duel.track === 'frontend' ? 'фронтенд-архитектура' : 'бэкенд'}</span>
      </div>
      <Markdown>{duel.situation}</Markdown>
      {picked === null && cut === null && cuts > 0 && duel.options.length === 3 && (
        <button
          onClick={() => {
            if (!useItem('perk-5050')) return
            const wrong = duel.options.map((_, k) => k).filter((k) => k !== duel.correct)
            setCut(wrong[Math.floor(Math.random() * wrong.length)])
          }}
          className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          ✂️ Убрать лишнее ({cuts})
        </button>
      )}
      <div className={clsx('grid gap-3', duel.options.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        {duel.options.map((o, k) => (
          <button
            key={k}
            onClick={() => picked === null && k !== cut && setPicked(k)}
            className={clsx(
              'flex flex-col items-center gap-2 rounded-2xl border-2 p-5 text-center transition',
              k === cut && 'pointer-events-none line-through opacity-30',
              picked === null && 'border-zinc-800 hover:-translate-y-0.5 hover:border-amber-300/60 hover:bg-amber-300/5',
              picked !== null && k === duel.correct && 'border-emerald-400 bg-emerald-400/10',
              picked === k && k !== duel.correct && 'border-rose-500 bg-rose-500/10',
              picked !== null && k !== duel.correct && picked !== k && 'border-zinc-800 opacity-40',
            )}
          >
            <span className="text-4xl">{o.emoji}</span>
            <span className="font-semibold text-zinc-100">{o.name}</span>
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="space-y-3">
          <div className={clsx('rounded-xl p-4 text-sm', ok ? 'bg-emerald-500/10 text-emerald-50' : 'bg-rose-500/10 text-rose-50')}>
            <div className="mb-1 font-semibold">{ok ? '🏆 Победа' : `❌ Здесь выигрывает ${duel.options[duel.correct].name}`}</div>
            {duel.why}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-400/20 p-3 text-sm">
              <div className="mb-1 text-xs text-amber-300">💰 Чем платишь</div>
              <div className="text-zinc-300">{duel.price}</div>
            </div>
            <div className="rounded-xl border border-sky-400/20 p-3 text-sm">
              <div className="mb-1 text-xs text-sky-300">🔄 Когда победил бы другой</div>
              <div className="text-zinc-300">{duel.flip}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => onDone(ok)} className="rounded-lg bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
              Дальше
            </button>
            {duel.options
              .filter((o) => o.cardId)
              .map((o) => (
                <Link key={o.cardId} to={`/wiki/${o.cardId}`} target="_blank" className="text-xs text-zinc-500 hover:text-zinc-300">
                  {o.emoji} карточка {o.name}
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
