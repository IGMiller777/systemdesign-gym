import clsx from 'clsx'
import { LoaderCircle, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Markdown } from '../components/Markdown'
import { postApi } from '../lib/api'
import { useProgress } from '../store'
import { getCard } from '../wiki/cards'
import type { WikiEntry } from '../wiki/types'
import { type Aspect, aspectMeta, explainQuestion, explainReference } from './aspects'

interface Grade {
  score: number
  verdict: string
  correct: string[]
  missing: string[]
  wrong: string[]
  model: string
}

/** Active recall: the player explains an aspect in their own words, AI checks it against the encyclopedia. */
export function ExplainItem({ entry, aspect, onDone }: { entry: WikiEntry; aspect: Aspect; onDone?: (ok: boolean) => void }) {
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)
  const record = useProgress((s) => s.record)
  const question = explainQuestion(entry, aspect)
  const meta = aspectMeta[aspect]

  const submit = async () => {
    setLoading(true)
    setError(null)
    try {
      const g = await postApi<Grade>('/api/explain', {
        topic: entry.title,
        question,
        answer,
        reference: explainReference(entry, aspect),
      })
      setGrade(g)
      record(`explain:${entry.id}:${aspect}`, g.score >= 60 ? g.score : 0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-violet-200">
          🗣️ Объясни сам · {meta.emoji} {meta.label}
        </span>
        <span className="text-zinc-500">
          {getCard(entry.id)?.emoji} {entry.title}
        </span>
      </div>
      <div className="text-base font-medium text-zinc-100">{question}</div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={!!grade}
        rows={4}
        placeholder="Своими словами, тезисно. Не подглядывай 🙂"
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm outline-none focus:border-violet-400 disabled:opacity-60"
      />
      {!grade && (
        <button
          onClick={submit}
          disabled={loading || answer.trim().length < 15}
          className="flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-40"
        >
          {loading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Наставник читает…' : 'Проверить'}
        </button>
      )}
      {error && <div className="text-sm text-rose-300">{error}</div>}
      {grade && (
        <div className="space-y-3 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center gap-3">
            <div className={clsx('text-3xl font-bold tabular-nums', grade.score >= 70 ? 'text-emerald-300' : grade.score >= 40 ? 'text-amber-300' : 'text-rose-300')}>
              {grade.score}
            </div>
            <div className="text-sm text-zinc-300">{grade.verdict}</div>
          </div>
          {grade.correct.length > 0 && <List title="✅ Верно" items={grade.correct} tone="text-emerald-200" />}
          {grade.missing.length > 0 && <List title="🕳️ Упущено" items={grade.missing} tone="text-amber-200" />}
          {grade.wrong.length > 0 && <List title="❌ Ошибки" items={grade.wrong} tone="text-rose-200" />}
          <div className="rounded-lg bg-zinc-900 p-3">
            <div className="mb-1 text-xs text-zinc-500">Как сказал бы сеньор</div>
            <Markdown>{grade.model}</Markdown>
          </div>
          {onDone && (
            <button onClick={() => onDone(grade.score >= 60)} className="rounded-lg bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
              Дальше
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{title}</div>
      <ul className={clsx('list-disc space-y-0.5 pl-5 text-sm', tone)}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  )
}
