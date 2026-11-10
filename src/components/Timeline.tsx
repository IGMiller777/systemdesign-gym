import clsx from 'clsx'
import { Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { InlineMarkdown } from './Markdown'
import { KINDS, parseTimeline, type Kind } from './timeline-parse'

const color: Record<Kind, string> = {
  data: 'bg-emerald-500/80 text-emerald-950',
  hs: 'bg-sky-500/70 text-sky-950',
  cpu: 'bg-violet-400/80 text-violet-950',
  wait: 'tl-wait text-rose-200',
  lost: 'bg-rose-500/90 text-rose-50',
}

/** Axis ticks at a round step (10, 20, 25, 50, 100…), 3–6 of them. */
function ticks(total: number) {
  const steps = [1, 2, 2.5, 5].flatMap((m) => [1, 10, 100, 1000, 10000].map((p) => m * p)).sort((a, b) => a - b)
  const step = steps.find((s) => total / s <= 5) ?? total
  const out: number[] = []
  for (let t = 0; t <= total + 1e-9; t += step) out.push(t)
  return out
}

/** Seconds the playhead takes to cross the whole scale. */
const PLAY_S = 4

/** Animated waterfall: bars grow in time order once the figure scrolls into view; ▶ replays. */
export function Timeline({ source }: { source: string }) {
  const ref = useRef<HTMLElement>(null)
  const [run, setRun] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setPlaying(true)
        io.disconnect()
      }
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  let parsed: ReturnType<typeof parseTimeline>
  try {
    parsed = parseTimeline(source)
  } catch (e) {
    return <pre className="not-prose my-3 rounded-lg border border-rose-500/40 p-3 text-xs text-rose-300">Ошибка шкалы: {(e as Error).message}</pre>
  }
  const { total, unit, rows, notes } = parsed
  const pct = (x: number) => (x / total) * 100
  const used = [...new Set(rows.flatMap((r) => (r.kind === 'lane' ? r.segments.map((s) => s.kind) : [])))]
  const anim = (start: number, end: number) => ({
    animationDelay: `${(start / total) * PLAY_S}s`,
    animationDuration: `${((end - start) / total) * PLAY_S}s`,
    animationPlayState: playing ? 'running' : 'paused',
  })

  return (
    <figure ref={ref} className="not-prose my-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:p-4">
      <div key={run} className="space-y-2.5">
        {rows.map((row, i) =>
          row.kind === 'divider' ? (
            <div key={i} className="flex items-center gap-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-amber-300/80">
              <span>{row.text}</span>
              <div className="h-px flex-1 bg-amber-300/25" />
            </div>
          ) : (
            <div key={i} className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-3">
              <div className="text-[13px] leading-tight text-zinc-300"><InlineMarkdown>{row.label}</InlineMarkdown></div>
              <div className="relative h-7 rounded bg-zinc-900">
                {row.segments.map((s, j) => (
                  <div
                    key={j}
                    title={`${s.name} ${s.start}–${s.end} ${unit}`}
                    className={clsx('tl-bar absolute inset-y-0.5 flex items-center justify-center overflow-hidden rounded-sm border-r border-zinc-950 px-1 text-[11px] font-medium leading-none whitespace-nowrap', color[s.kind])}
                    style={{ left: `${pct(s.start)}%`, width: `${pct(s.end - s.start)}%`, ...anim(s.start, s.end) }}
                  >
                    <span className="truncate">
                      {s.kind === 'lost' && '✕ '}
                      {s.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ),
        )}
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <div className="hidden sm:block" />
          <div className="relative h-4 text-[10px] text-zinc-500">
            {ticks(total).map((t, k, all) => (
              <span key={t} className={clsx('absolute', k === 0 ? 'left-0' : '-translate-x-1/2')} style={k > 0 ? { left: `${pct(t)}%` } : undefined}>
                {t}{k === all.length - 1 ? ` ${unit}` : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
        {used.map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={clsx('inline-block h-2.5 w-4 rounded-sm', color[k])} />
            {KINDS[k]}
          </span>
        ))}
        <button
          type="button"
          onClick={() => {
            setRun((r) => r + 1)
            setPlaying(true)
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:border-zinc-500"
        >
          <Play size={11} /> проиграть
        </button>
      </figcaption>
      {notes.map((n, i) => (
        <p key={i} className="mt-2 text-[13px] leading-snug text-zinc-400"><InlineMarkdown>{n}</InlineMarkdown></p>
      ))}
    </figure>
  )
}
