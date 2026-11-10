import { LoaderCircle, Sparkles, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { streamApi } from '../lib/api'
import { Markdown } from './Markdown'

/** Free-form question to the AI tutor, keeps a short dialog history. */
export function AskBox({ topic, context, suggestions = [] }: { topic: string; context?: string; suggestions?: string[] }) {
  const [q, setQ] = useState('')
  const [history, setHistory] = useState<{ q: string; a: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState('')
  const [partial, setPartial] = useState('')
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])

  const ask = async (question: string) => {
    if (!question.trim() || loading) return
    setLoading(true)
    setError(null)
    setPending(question)
    setPartial('')
    setQ('')
    const ctrl = (abort.current = new AbortController())
    let text = ''
    try {
      await streamApi('/api/ask/stream', { topic, context, question, history: history.slice(-3) }, (t) => setPartial((text = t)), ctrl.signal)
    } catch (e) {
      if (!ctrl.signal.aborted) setError((e as Error).message)
    } finally {
      // Keep whatever arrived (also after Stop); with nothing, give the question back to edit.
      if (text) setHistory((h) => [...h, { q: question, a: text }])
      else setQ(question)
      setPartial('')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-violet-400/20 bg-violet-400/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-violet-200">
        <Sparkles size={16} /> Спросить ИИ-наставника
      </div>
      {history.map((h, i) => (
        <div key={i} className="space-y-2">
          <Question text={h.q} />
          <Answer text={h.a} />
        </div>
      ))}
      {loading && pending && (
        <div className="space-y-2">
          <Question text={pending} />
          <Answer text={partial} />
        </div>
      )}
      {history.length === 0 && !loading && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-violet-400/30 px-3 py-1 text-xs text-violet-200 hover:bg-violet-400/10"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <textarea
          value={q}
          rows={3}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              ask(q)
            }
          }}
          placeholder="Например: чем это отличается от Postgres на практике?"
          className="block max-h-80 min-h-20 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm leading-relaxed outline-none focus:border-violet-400"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500">Enter: отправить, Shift+Enter: новая строка</span>
          {loading ? (
            <button
              onClick={() => abort.current?.abort()}
              className="flex items-center gap-1.5 rounded-lg border border-violet-400/40 px-3 py-2 text-sm font-medium text-violet-200 hover:bg-violet-400/10"
            >
              <Square size={12} className="fill-current" /> Стоп
            </button>
          ) : (
            <button
              onClick={() => ask(q)}
              disabled={!q.trim()}
              className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-40"
            >
              Спросить
            </button>
          )}
        </div>
      </div>
      {error && <div className="text-sm text-rose-300">{error}</div>}
    </div>
  )
}

function Question({ text }: { text: string }) {
  return (
    <div className="ml-auto w-fit max-w-[85%] rounded-lg bg-violet-500/20 px-3 py-2 text-sm whitespace-pre-wrap text-zinc-100">
      <div className="mb-0.5 text-xs font-medium tracking-wide text-violet-300 uppercase">Вы</div>
      {text}
    </div>
  )
}

function Answer({ text }: { text: string }) {
  return (
    <div className="rounded-lg border-l-2 border-violet-400 bg-zinc-900 p-3">
      <div className="mb-1 text-xs font-medium tracking-wide text-violet-300 uppercase">Наставник</div>
      {text ? (
        <Markdown>{text}</Markdown>
      ) : (
        <LoaderCircle size={16} className="animate-spin text-violet-300" aria-label="Наставник думает" />
      )}
    </div>
  )
}
