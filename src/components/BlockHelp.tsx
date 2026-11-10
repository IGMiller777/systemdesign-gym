import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { BlockType } from '../tasks/types'
import { entryByBlock } from '../wiki'
import { getCard } from '../wiki/cards'

/**
 * Small "?" badge for diagram nodes: hover shows a short card summary,
 * click opens the wiki card in a new tab (so game state is kept).
 */
export function BlockHelp({ block }: { block: BlockType }) {
  const entry = entryByBlock(block)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  if (!entry) return null
  const card = getCard(entry.id)

  return (
    <>
      <button
        type="button"
        aria-label={`Что такое ${entry.title}`}
        className="nodrag nopan flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-600 text-[10px] leading-none text-zinc-400 hover:border-sky-400 hover:text-sky-300"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setPos({ x: r.left + r.width / 2, y: r.top })
        }}
        onMouseLeave={() => setPos(null)}
        onClick={(e) => {
          e.stopPropagation()
          window.open(`/wiki/${entry.id}`, '_blank')
        }}
      >
        ?
      </button>
      {pos &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[1000] w-72 -translate-x-1/2 -translate-y-full rounded-xl border border-zinc-700 bg-zinc-900/95 p-3 text-left shadow-2xl backdrop-blur"
            style={{ left: pos.x, top: pos.y - 8 }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{card?.emoji}</span>
              <span className="font-semibold text-zinc-100">{entry.title}</span>
            </div>
            <div className="mt-1 text-xs text-zinc-300">{entry.tagline}</div>
            {card && (
              <div className="mt-2 space-y-1 text-[11px]">
                <div className="text-emerald-300">💪 {card.superpower}</div>
                <div className="text-rose-300">🩸 {card.weakness}</div>
                <div className="text-zinc-400">💡 {card.analogy}</div>
              </div>
            )}
            <div className="mt-2 text-[10px] text-zinc-500">Клик по «?» — открыть карточку</div>
          </div>,
          document.body,
        )}
    </>
  )
}
