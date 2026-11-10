import clsx from 'clsx'
import { InlineMarkdown } from './Markdown'
import { parsePerks, TIERS, type Tier } from './perks-parse'

const frame: Record<Tier, string> = {
  upgrade: 'border-emerald-400/40 bg-emerald-400/[0.05]',
  tradeoff: 'border-amber-400/40 bg-amber-400/[0.05]',
  trap: 'border-rose-400/40 bg-rose-400/[0.05]',
}
const badge: Record<Tier, string> = {
  upgrade: 'bg-emerald-400/15 text-emerald-300',
  tradeoff: 'bg-amber-400/15 text-amber-300',
  trap: 'bg-rose-400/15 text-rose-300',
}
const sign = {
  '+': { mark: '+', cls: 'text-emerald-400' },
  '-': { mark: '−', cls: 'text-rose-400' },
  '!': { mark: '›', cls: 'text-zinc-500' },
}

/** Upgrade cards: like game items, each says what it gives (+) and what it takes (−). */
export function Perks({ source }: { source: string }) {
  let items: ReturnType<typeof parsePerks>
  try {
    items = parsePerks(source)
  } catch (e) {
    return <pre className="not-prose my-3 rounded-lg border border-rose-500/40 p-3 text-xs text-rose-300">Ошибка карточек: {(e as Error).message}</pre>
  }
  return (
    <div className="not-prose my-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((p) => (
          <div key={p.name} className={clsx('rounded-xl border p-3.5', frame[p.tier])}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-zinc-100"><InlineMarkdown>{p.name}</InlineMarkdown></div>
              <span title={TIERS[p.tier].hint} className={clsx('rounded-full px-2 py-0.5 text-[11px] font-medium', badge[p.tier])}>{TIERS[p.tier].label}</span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {p.lines.map((l, i) => (
                <li key={i} className={clsx('flex gap-2 text-[15px] leading-snug', l.sign === '!' ? 'text-zinc-400' : 'text-zinc-200')}>
                  <span className={clsx('w-3 shrink-0 text-center font-bold', sign[l.sign].cls)}>{sign[l.sign].mark}</span>
                  <span><InlineMarkdown>{l.text}</InlineMarkdown></span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
