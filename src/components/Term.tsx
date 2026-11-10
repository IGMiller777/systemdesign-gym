import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GLOSSARY } from './glossary'

const W = 288

/** Abbreviation with a dotted underline: hover (mouse) or tap shows the expansion and a one-line definition. */
export function Term({ term }: { term: string }) {
  const t = GLOSSARY[term]
  const ref = useRef<HTMLButtonElement>(null)
  const pointer = useRef('')
  const [pos, setPos] = useState<React.CSSProperties | null>(null)

  const open = () => {
    const r = ref.current!.getBoundingClientRect()
    const width = Math.min(W, innerWidth - 32)
    const left = Math.max(16, Math.min(r.left, innerWidth - 16 - width))
    setPos(r.bottom + 140 > innerHeight ? { left, width, bottom: innerHeight - r.top + 6 } : { left, width, top: r.bottom + 6 })
  }

  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    const outside = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close()
    addEventListener('scroll', close, { capture: true, once: true })
    document.addEventListener('pointerdown', outside)
    return () => {
      removeEventListener('scroll', close, { capture: true })
      document.removeEventListener('pointerdown', outside)
    }
  }, [pos])

  if (!t) return <>{term}</>
  return (
    <button
      ref={ref}
      type="button"
      className="cursor-help underline decoration-zinc-500 decoration-dotted underline-offset-[3px] hover:decoration-sky-300"
      onPointerDown={(e) => (pointer.current = e.pointerType)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && open()}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setPos(null)}
      onClick={() => pointer.current !== 'mouse' && (pos ? setPos(null) : open())}
    >
      {term}
      {pos &&
        createPortal(
          <span role="tooltip" style={pos} className="fixed z-50 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-[13px] leading-snug text-zinc-300 shadow-xl">
            <span className="font-semibold text-zinc-100">{term}</span>
            {t.full && <span className="text-zinc-400"> · {t.full}</span>}
            <span className="mt-1 block">{t.def}</span>
          </span>,
          document.body,
        )}
    </button>
  )
}
