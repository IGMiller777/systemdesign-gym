import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { compareData } from './compare-data'
import { implData } from './impl-data'
import { implInfra } from './impl-infra'
import { vectorCompare, vectorImpl } from './extra-vector'
import { frontendCompare, frontendImpl } from './frontend-wiki'
import { llmCompare, llmImpl } from './llm-wiki'
import type { CompareTable, Implementation } from './types'

const all: Record<string, Implementation[]> = { ...implInfra, ...implData, 'vector-db': vectorImpl, ...frontendImpl, ...llmImpl }
const tables: Record<string, CompareTable> = { ...compareData, 'vector-db': vectorCompare, ...frontendCompare, ...llmCompare }

const verdictCls = {
  good: 'bg-emerald-400/[0.12] text-emerald-100',
  ok: 'bg-zinc-800/60 text-zinc-300',
  bad: 'bg-rose-500/[0.12] text-rose-100',
}

/** Side-by-side matrix of conceptually different approaches; the row of this component is highlighted. */
function Matrix({ table, selfTitle }: { table: CompareTable; selfTitle: string }) {
  const [hoverCol, setHoverCol] = useState<number | null>(null)
  const self = table.rows.findIndex((r) => selfTitle.toLowerCase().includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(selfTitle.toLowerCase().split(' ')[0]))
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-zinc-900 p-3 text-left font-medium text-zinc-400" />
            {table.criteria.map((c, j) => (
              <th
                key={c}
                onMouseEnter={() => setHoverCol(j)}
                onMouseLeave={() => setHoverCol(null)}
                className={clsx('min-w-28 bg-zinc-900 p-3 text-left text-xs font-medium text-zinc-400', hoverCol === j && 'text-zinc-100')}
              >
                {c}
              </th>
            ))}
            <th className="min-w-56 bg-zinc-900 p-3 text-left text-xs font-medium text-zinc-400">Брать, когда</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={r.name} className={clsx(i === self && 'outline outline-1 -outline-offset-1 outline-sky-400/50')}>
              <th className="sticky left-0 z-10 border-t border-zinc-800 bg-zinc-950 p-3 text-left font-semibold whitespace-nowrap text-zinc-100">
                <span className="mr-1.5">{r.emoji}</span>
                {r.name}
              </th>
              {r.cells.map((cell, j) => (
                <td key={j} className={clsx('border-t border-l border-zinc-900 p-2.5 align-top text-xs leading-snug', verdictCls[cell.verdict], hoverCol === j && 'brightness-125')}>
                  {cell.text}
                </td>
              ))}
              <td className="border-t border-l border-zinc-900 p-2.5 align-top text-xs leading-snug text-zinc-300">{r.pickWhen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const tiers: Record<Implementation['tier'], string> = {
  mainstream: 'стандарт',
  niche: 'нишевая',
  ru: 'российская',
  managed: 'облако',
}

/** Concrete products: one compact list instead of expandable cards. */
function Products({ list }: { list: Implementation[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-zinc-800">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-sm text-zinc-300 hover:text-zinc-100">
        <span>
          Конкретные продукты <span className="text-zinc-500">({list.length})</span>
        </span>
        <ChevronDown size={16} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="divide-y divide-zinc-800/80 border-t border-zinc-800">
              {list.map((x) => (
                <div key={x.name} className="grid gap-x-4 gap-y-1 px-4 py-3 text-sm md:grid-cols-[200px_1fr_1fr]">
                  <div>
                    <div className="font-medium text-zinc-100">
                      {x.emoji} {x.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {tiers[x.tier]}
                      {x.tags.length > 0 && `, ${x.tags.join(', ')}`}
                    </div>
                  </div>
                  <div className="text-zinc-300">
                    <span className="text-emerald-300">Выигрывает: </span>
                    {x.winsWhen}
                  </div>
                  <div className="text-zinc-400">
                    <span className="text-amber-300">Цена: </span>
                    {x.tradeoff}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Implementations({ id, title }: { id: string; title: string }) {
  const table = tables[id]
  const list = all[id] ?? []
  if (!table && !list.length) return null
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Альтернативы</h2>
        {table && <p className="text-sm text-zinc-400">{table.question}</p>}
      </div>
      {table && <Matrix table={table} selfTitle={title} />}
      {table && (
        <div className="flex gap-4 text-xs text-zinc-500">
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400/40 align-middle" />
            сильная сторона
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-rose-500/40 align-middle" />
            слабая сторона
          </span>
        </div>
      )}
      {list.length > 0 && <Products list={list} />}
    </section>
  )
}
