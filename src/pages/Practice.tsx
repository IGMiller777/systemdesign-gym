import clsx from 'clsx'
import { CalendarCheck, Flame, Swords, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { allDuels as duels } from '../duels'
import { type Aspect, aspects } from '../practice/aspects'
import { DuelItem } from '../practice/DuelItem'
import { ExplainItem } from '../practice/ExplainItem'
import { EstimateItem, QuizItem } from '../practice/SmallItems'
import { DAILY_XP, dayKey, SRS_DAYS, streak, useProgress } from '../store'
import { allTasks } from '../tasks'
import type { EstimateTask } from '../tasks/types'
import { getEntry, wikiEntries } from '../wiki'
import { cardKey, getCard } from '../wiki/cards'
import { shuffled } from '../wiki/Quiz'

const estimates = allTasks.filter((t): t is EstimateTask => t.kind === 'estimate')

/** Item ids: quiz:<card>:<q> · est:<task> · duel:<duel> · explain:<card>:<aspect> */
function ItemView({ id, onDone }: { id: string; onDone: (ok: boolean) => void }) {
  const [kind, a, b] = id.split(':')
  if (kind === 'quiz') return <QuizItem entry={getEntry(a)!} qi={Number(b)} onDone={onDone} />
  if (kind === 'est') return <EstimateItem task={estimates.find((t) => t.id === a)!} onDone={onDone} />
  if (kind === 'duel') return <DuelItem duel={duels.find((d) => d.id === a)!} onDone={onDone} />
  return <ExplainItem entry={getEntry(a)!} aspect={b as Aspect} onDone={onDone} />
}

const valid = (id: string) => {
  const [kind, a, b] = id.split(':')
  if (kind === 'quiz') return !!getCard(a)?.quiz[Number(b)]
  if (kind === 'est') return estimates.some((t) => t.id === a)
  if (kind === 'duel') return duels.some((d) => d.id === a)
  if (kind === 'explain') return !!getEntry(a) && aspects.includes(b as Aspect)
  return false
}

const pick = <T,>(seed: string, xs: T[], n: number) => shuffled(seed, xs.length).slice(0, n).map((i) => xs[i])

/** Due reviews first, then a fresh mix: 2 quiz, 2 estimates, 2 duels, 1 explain. */
function buildSession(srs: Record<string, { due: string }>, results: Record<string, { best: number }>): string[] {
  const today = dayKey(new Date())
  const due = Object.entries(srs)
    .filter(([id, r]) => r.due <= today && valid(id))
    .sort((x, y) => x[1].due.localeCompare(y[1].due))
    .map(([id]) => id)
    .slice(0, 7)
  const known = new Set(Object.keys(srs))
  const fresh = (ids: string[], n: number) => pick(today + ids.length, ids.filter((i) => !known.has(i)), n)
  const cardsWithQuiz = wikiEntries.filter((e) => getCard(e.id))
  const quiz = fresh(
    cardsWithQuiz.filter((e) => (results[cardKey(e.id)]?.best ?? 0) < 66).flatMap((e) => getCard(e.id)!.quiz.map((_, i) => `quiz:${e.id}:${i}`)),
    2,
  )
  const est = fresh(estimates.map((t) => `est:${t.id}`), 2)
  const duel = fresh(duels.map((d) => `duel:${d.id}`), 2)
  const explain = fresh(cardsWithQuiz.flatMap((e) => aspects.map((a) => `explain:${e.id}:${a}`)), 1)
  return [...due, ...quiz, ...est, ...duel, ...explain].slice(0, 10)
}

export function Daily() {
  const srs = useProgress((s) => s.srs)
  const results = useProgress((s) => s.results)
  const days = useProgress((s) => s.days)
  const review = useProgress((s) => s.review)
  const record = useProgress((s) => s.record)
  const [session] = useState(() => buildSession(srs, results))
  const [i, setI] = useState(0)
  const [score, setScore] = useState<boolean[]>([])
  const today = dayKey(new Date())
  const doneToday = !!results[`daily:${today}`]
  const dueCount = Object.values(srs).filter((r) => r.due <= today).length

  const onDone = (ok: boolean) => {
    review(session[i], ok)
    setScore((s) => [...s, ok])
    if (i + 1 >= session.length) record(`daily:${today}`, 100)
    setI(i + 1)
  }

  const finished = i >= session.length
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarCheck className="text-emerald-300" /> Тренировка дня
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            ~10 минут: повторение того, что пора повторить (через {SRS_DAYS.join('/')} дн.), плюс свежий микс. +{DAILY_XP} XP за день.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-orange-300">
            <Flame size={14} /> {streak(days)} дн.
          </span>
          <span className="text-zinc-500">к повторению: {dueCount}</span>
        </div>
      </div>

      {!finished && (
        <div className="flex gap-1">
          {session.map((id, k) => (
            <div
              key={id}
              className={clsx(
                'h-1.5 flex-1 rounded-full',
                k < score.length ? (score[k] ? 'bg-emerald-400' : 'bg-rose-500') : k === i ? 'bg-zinc-300' : 'bg-zinc-800',
              )}
            />
          ))}
        </div>
      )}

      {!finished ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
          <ItemView key={session[i]} id={session[i]} onDone={onDone} />
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
          <div className="text-5xl">{doneToday ? '🔥' : '✅'}</div>
          <div className="text-xl font-semibold">
            {score.filter(Boolean).length} из {score.length} — тренировка засчитана
          </div>
          <div className="flex items-center justify-center gap-1 text-sm text-amber-300">
            <Trophy size={14} /> +{DAILY_XP} XP · серия {streak(days)} дн.
          </div>
          <div className="text-sm text-zinc-400">Ошибки вернутся завтра, верные ответы — через несколько дней.</div>
          <div className="flex justify-center gap-2">
            <Link to="/duels" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700">
              ⚔️ Ещё дуэлей
            </Link>
            <Link to="/oncall" className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white">
              На дежурство
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export function Duels() {
  const review = useProgress((s) => s.review)
  const record = useProgress((s) => s.record)
  const best = useProgress((s) => s.results['duels:streak']?.best ?? 0)
  const [track, setTrack] = useState<'all' | 'backend' | 'frontend'>('all')
  const [seed] = useState(() => String(Date.now()))
  const [params] = useSearchParams()
  const first = params.get('d')
  const list = duels.filter((d) => track === 'all' || d.track === track)
  const shuffledList = shuffled(seed + track, list.length).map((k) => list[k])
  // ?d=<id> (from the learning path) puts that duel first
  const order = first ? [...shuffledList.filter((d) => d.id === first), ...shuffledList.filter((d) => d.id !== first)] : shuffledList
  const [i, setI] = useState(0)
  const [run, setRun] = useState(0)
  const duel = order[i % order.length]

  const onDone = (ok: boolean) => {
    review(`duel:${duel.id}`, ok)
    const next = ok ? run + 1 : 0
    if (next > best) record('duels:streak', next)
    setRun(next)
    setI(i + 1)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Swords className="text-amber-300" /> Арена дуэлей
          </h1>
          <p className="mt-1 text-sm text-zinc-400">Ситуация → выбери победителя → узнай цену выбора и когда победил бы другой.</p>
        </div>
        <div className="text-right text-sm">
          <div className="text-amber-300">🔥 серия {run}</div>
          <div className="text-xs text-zinc-500">рекорд {best}</div>
        </div>
      </div>
      <div className="flex gap-1.5">
        {(['all', 'backend', 'frontend'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTrack(t)
              setI(0)
            }}
            className={clsx('rounded-full px-3 py-1 text-xs', track === t ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200')}
          >
            {t === 'all' ? 'Все' : t === 'backend' ? 'Бэкенд' : 'Фронтенд'}
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-500">
          {(i % order.length) + 1} / {order.length}
        </span>
      </div>
      {duel && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
          <DuelItem key={`${duel.id}-${i}`} duel={duel} onDone={onDone} />
        </div>
      )}
    </div>
  )
}
