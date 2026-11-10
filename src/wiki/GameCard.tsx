import clsx from 'clsx'
import { Check } from 'lucide-react'
import { blocks } from '../lib/blocks'
import { rarityMeta, statMeta } from './cards'
import type { WikiCard, WikiEntry } from './types'

/** Trading-card view of a component. */
export function GameCard({
  entry,
  card,
  mastered,
  large,
}: {
  entry: WikiEntry
  card: WikiCard
  mastered?: boolean
  large?: boolean
}) {
  const r = rarityMeta[card.rarity]
  const color = entry.block ? blocks[entry.block].color : '#a1a1aa'
  return (
    <div
      className={clsx(
        'group relative rounded-2xl bg-gradient-to-br p-[2px] shadow-xl transition duration-300',
        r.ring,
        r.glow,
        !large && 'hover:-translate-y-1 hover:rotate-[0.6deg] hover:shadow-2xl',
        card.rarity === 'legendary' && 'animate-[pulse_4s_ease-in-out_infinite]',
      )}
    >
      <div className={clsx('flex h-full flex-col rounded-[14px] bg-zinc-950', large ? 'p-5' : 'p-3.5')}>
        <div className="flex items-start justify-between">
          <span className={clsx('text-[10px] font-semibold', r.text)}>{r.label}</span>
          {mastered && (
            <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
              <Check size={10} /> освоена
            </span>
          )}
        </div>
        <div
          className={clsx('mx-auto my-2 flex items-center justify-center rounded-full', large ? 'h-24 w-24 text-5xl' : 'h-16 w-16 text-4xl')}
          style={{ background: `radial-gradient(circle, ${color}33 0%, transparent 70%)` }}
        >
          <span className="transition duration-300 group-hover:scale-110">{card.emoji}</span>
        </div>
        <div className={clsx('text-center font-bold tracking-tight text-zinc-50', large ? 'text-2xl' : 'text-base')}>{entry.title}</div>
        <div className={clsx('mt-1 text-center text-zinc-400', large ? 'text-sm' : 'line-clamp-2 text-[11px]')}>{entry.tagline}</div>
        <div className={clsx('mt-3 space-y-1', large ? 'text-sm' : 'text-[11px]')}>
          <div className="rounded-lg bg-emerald-500/10 px-2 py-1 text-emerald-200">💪 {card.superpower}</div>
          <div className="rounded-lg bg-rose-500/10 px-2 py-1 text-rose-200">🩸 {card.weakness}</div>
        </div>
        <div className={clsx('mt-3 space-y-1', large ? 'text-xs' : 'text-[10px]')}>
          {statMeta.map((s) => {
            const v = card.stats[s.key]
            return (
              <div key={s.key} className="flex items-center gap-1.5">
                <span className="w-4 text-center">{s.icon}</span>
                <span className="w-16 text-zinc-500">{s.label}</span>
                <div className="flex flex-1 gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={clsx('h-1.5 flex-1 rounded-full', i <= v ? '' : 'bg-zinc-800')}
                      style={i <= v ? { background: color } : undefined}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
