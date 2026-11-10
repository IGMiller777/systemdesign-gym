import clsx from 'clsx'
import { Play } from 'lucide-react'
import { useState } from 'react'
import { InlineMarkdown } from './Markdown'
import { parseSeq, type SeqRow } from './seq'

const center = (i: number, n: number) => ((i + 0.5) / n) * 100

function Message({ row, count }: { row: Extract<SeqRow, { kind: 'msg' }>; count: number }) {
  const left = center(Math.min(row.from, row.to), count)
  const right = center(Math.max(row.from, row.to), count)
  const toRight = row.to > row.from
  const color = row.style === 'secure' ? 'text-emerald-400' : row.style === 'dashed' ? 'text-zinc-500' : 'text-zinc-300'
  return (
    <div className="relative py-1.5">
      <div className="relative" style={{ marginLeft: `${left}%`, width: `${right - left}%` }}>
        <div className="px-2 pb-1 text-center [overflow-wrap:anywhere] text-[12px] leading-snug text-zinc-200 sm:text-[13px]">
          <span className={clsx('mr-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 align-[1px] text-[10px] font-semibold text-zinc-950', row.style === 'secure' ? 'bg-emerald-400' : 'bg-zinc-300')}>
            {row.n}
          </span>
          {row.style === 'secure' && '🔒 '}
          <InlineMarkdown>{row.text}</InlineMarkdown>
        </div>
        <div className={clsx('relative h-2.5', color)}>
          <div className={clsx('absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-current', row.style === 'dashed' && 'border-dashed')} />
          <span
            className={clsx(
              'absolute top-1/2 h-0 w-0 -translate-y-1/2 border-y-[5px] border-y-transparent',
              toRight ? '-right-0.5 border-l-[9px] border-l-current' : '-left-0.5 border-r-[9px] border-r-current',
            )}
          />
        </div>
      </div>
    </div>
  )
}

const noteBox = 'relative z-10 min-w-0 [overflow-wrap:anywhere] rounded-md border border-amber-400/30 bg-zinc-900 px-2 py-1 text-center text-[12px] leading-snug text-amber-100'

function Note({ text, count }: { text: string; count: number }) {
  return (
    <div className="relative py-1.5">
      <div className={noteBox} style={{ marginLeft: `${center(0, count) - 4}%`, width: `${center(count - 1, count) - center(0, count) + 8}%` }}>
        <InlineMarkdown>{text}</InlineMarkdown>
      </div>
    </div>
  )
}

function Notes({ items, count }: { items: { at: number; text: string }[]; count: number }) {
  return (
    <div className="relative grid gap-2 py-1.5" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {items.map((x) => (
        <div key={x.at} className={clsx(noteBox, 'row-start-1')} style={{ gridColumn: x.at + 1 }}>
          <InlineMarkdown>{x.text}</InlineMarkdown>
        </div>
      ))}
    </div>
  )
}

/** Seconds between rows when ▶ replays the diagram step by step. */
const STEP_S = 0.7

export function SequenceDiagram({ source }: { source: string }) {
  const [run, setRun] = useState(0)
  let parsed: ReturnType<typeof parseSeq>
  try {
    parsed = parseSeq(source)
  } catch (e) {
    return <pre className="not-prose my-3 rounded-lg border border-rose-500/40 p-3 text-xs text-rose-300">Ошибка схемы: {(e as Error).message}</pre>
  }
  const { actors, rows } = parsed
  const count = actors.length
  return (
    <figure className="not-prose relative my-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:p-4">
      <button
        type="button"
        title="Показать по шагам"
        onClick={() => setRun((r) => r + 1)}
        className="absolute -top-3 right-3 z-20 inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-zinc-500"
      >
        <Play size={11} /> по шагам
      </button>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {actors.map((a) => (
          <div key={a} className="mx-auto max-w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-center text-xs font-medium text-zinc-100">
            {a}
          </div>
        ))}
      </div>
      <div key={run} className="relative mt-1 pb-2">
        {actors.map((a, i) => (
          <div key={a} className="absolute inset-y-0 border-l border-dashed border-zinc-700" style={{ left: `${center(i, count)}%` }} />
        ))}
        {rows.map((row, i) => (
          <div key={i} className={clsx('relative', run > 0 && 'seq-step')} style={run > 0 ? { animationDelay: `${i * STEP_S}s` } : undefined}>
          {row.kind === 'msg' ? (
            <Message row={row} count={count} />
          ) : row.kind === 'note' ? (
            <Note text={row.text} count={count} />
          ) : row.kind === 'notes' ? (
            <Notes items={row.items} count={count} />
          ) : (
            <div className="relative z-10 my-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-amber-300/80">
              <div className="h-px flex-1 bg-amber-300/25" />
              <span className="bg-zinc-950 px-1">{row.text}</span>
              <div className="h-px flex-1 bg-amber-300/25" />
            </div>
          )}
          </div>
        ))}
      </div>
    </figure>
  )
}
