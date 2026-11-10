import confetti from 'canvas-confetti'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { type Toast, useProgress } from '../store'

const style: Record<Toast['kind'], string> = {
  achievement: 'border-amber-300/60 bg-amber-500/[0.12]',
  rank: 'border-sky-300/60 bg-sky-500/[0.12]',
  credits: 'border-zinc-700 bg-zinc-900',
  quest: 'border-emerald-300/50 bg-emerald-500/[0.12]',
  info: 'border-zinc-700 bg-zinc-900',
}

function ToastView({ t }: { t: Toast }) {
  const dismiss = useProgress((s) => s.dismiss)
  useEffect(() => {
    if (t.kind === 'achievement' || t.kind === 'rank' || t.kind === 'quest') {
      confetti({ particleCount: t.kind === 'rank' ? 180 : 90, spread: 75, origin: { x: 0.85, y: 0.9 }, disableForReducedMotion: true })
    }
    const id = setTimeout(() => dismiss(t.id), t.kind === 'credits' ? 2200 : 5000)
    return () => clearTimeout(id)
  }, [t, dismiss])
  return (
    <motion.div
      layout
      initial={{ x: 80, opacity: 0, scale: 0.96 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      onClick={() => dismiss(t.id)}
      className={clsx(
        'pointer-events-auto flex w-80 cursor-pointer items-center gap-3 rounded-xl border p-3 shadow-2xl backdrop-blur',
        style[t.kind],
        t.kind === 'credits' && 'w-auto py-2',
      )}
    >
      <span className={t.kind === 'credits' ? 'text-lg' : 'text-3xl'}>{t.emoji}</span>
      <div className="min-w-0">
        <div className={clsx('font-semibold', t.kind === 'credits' ? 'text-sm text-amber-200' : 'text-zinc-50')}>{t.title}</div>
        {t.text && t.kind !== 'credits' && <div className="text-xs text-zinc-300">{t.text}</div>}
      </div>
    </motion.div>
  )
}

/** Stack of game notifications, bottom-right. Collapses credit toasts to the latest one. */
export function Toaster() {
  const toasts = useProgress((s) => s.toasts)
  const lastCredits = toasts.filter((t) => t.kind === 'credits').at(-1)
  const shown = toasts.filter((t) => t.kind !== 'credits' || t === lastCredits).slice(-4)
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[2000] flex flex-col items-end gap-2">
      <AnimatePresence initial={false}>
        {shown.map((t) => (
          <ToastView key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  )
}
