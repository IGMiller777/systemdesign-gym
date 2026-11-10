import clsx from 'clsx'
import { useState } from 'react'
import { configSnippet } from './config'
import { baseOf } from './engine'
import { knobDefaults, knobMeta } from './knobs'
import type { Knobs, SimNodeConfig } from './types'

type KnobKey = keyof Knobs

/** Realistic config excerpt with knob lines highlighted, plus controls to change them. */
export function KnobsPanel({ cfg, onChange }: { cfg: SimNodeConfig; onChange: (next: SimNodeConfig, text: string) => void }) {
  const defaults = knobDefaults(cfg.type) as Knobs
  const keys = (Object.keys(knobMeta) as KnobKey[]).filter(
    (k) => knobMeta[k].appliesTo.includes(baseOf(cfg.type)) && (!knobMeta[k].onlyIfSet || cfg.knobs?.[k] !== undefined),
  )
  const [focus, setFocus] = useState<KnobKey | null>(null)
  if (!keys.length) return null
  const snippet = configSnippet(cfg)
  const value = (k: KnobKey) => cfg.knobs?.[k] ?? defaults[k]

  const set = (k: KnobKey, v: Knobs[KnobKey]) => {
    const old = value(k)
    if (old === v) return
    onChange({ ...cfg, knobs: { ...cfg.knobs, [k]: v } }, `${cfg.label}: ${knobMeta[k].label} ${String(old)} → ${String(v)}`)
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-[#0d0d10]">
        <div className="border-b border-zinc-800 px-2 py-1 font-mono text-[10px] text-zinc-500">{snippet.file}</div>
        <pre className="overflow-x-auto py-1 font-mono text-[11px] leading-5">
          {snippet.lines.map((l, i) => (
            <div
              key={i}
              onMouseEnter={() => l.knob && setFocus(l.knob)}
              className={clsx(
                'px-2',
                l.knob ? 'border-l-2 border-amber-400 bg-amber-400/5 text-amber-100' : 'border-l-2 border-transparent text-zinc-500',
                l.knob && focus === l.knob && 'bg-amber-400/15',
              )}
            >
              {l.text || ' '}
            </div>
          ))}
        </pre>
      </div>

      {keys.map((k) => {
        const m = knobMeta[k]
        const v = value(k)
        const changed = cfg.knobs?.[k] !== undefined && cfg.knobs[k] !== defaults[k]
        return (
          <div
            key={k}
            onMouseEnter={() => setFocus(k)}
            className={clsx('space-y-1 rounded-lg p-2', focus === k ? 'bg-zinc-900' : '')}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300">
                {m.label}
                {changed && <span className="ml-1 text-amber-400">●</span>}
              </span>
              {m.kind === 'number' && m.unit && <span className="text-[10px] text-zinc-500">{m.unit}</span>}
            </div>
            {m.kind === 'number' && (
              <RangeKnob key={String(v)} value={Number(v)} min={m.min} max={m.max} step={m.step} onCommit={(x) => set(k, x as never)} />
            )}
            {m.kind === 'bool' && (
              <div className="flex gap-1">
                {[true, false].map((b) => (
                  <button
                    key={String(b)}
                    onClick={() => set(k, b as never)}
                    className={clsx('flex-1 rounded-md border px-2 py-1 text-xs', v === b ? 'border-amber-400 bg-amber-400/10 text-amber-100' : 'border-zinc-700 text-zinc-400')}
                  >
                    {b ? 'да' : 'нет'}
                  </button>
                ))}
              </div>
            )}
            {m.kind === 'select' && (
              <div className="flex gap-1">
                {m.options!.map((o) => (
                  <button
                    key={o}
                    onClick={() => set(k, o as never)}
                    className={clsx('flex-1 rounded-md border px-2 py-1 font-mono text-[11px]', v === o ? 'border-amber-400 bg-amber-400/10 text-amber-100' : 'border-zinc-700 text-zinc-400')}
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}
            {focus === k && <div className="text-[11px] leading-snug text-zinc-500">{m.hint}</div>}
          </div>
        )
      })}
    </div>
  )
}

/** Slider that applies the value on release, so one drag = one change in the event log. */
function RangeKnob({ value, min, max, step, onCommit }: { value: number; min?: number; max?: number; step?: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(value)
  const commit = () => v !== value && onCommit(v)
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        className="w-full accent-amber-400"
      />
      <span className="w-14 text-right font-mono text-xs text-zinc-100">{v}</span>
    </div>
  )
}
