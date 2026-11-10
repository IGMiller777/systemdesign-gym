import clsx from 'clsx'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { curriculum, type Module, type Step } from '../learn/curriculum'
import { bossStep, kindMeta, stepInfo } from '../learn/progress'

interface Place {
  module: Module
  /** Steps of the module in order, boss last. */
  steps: Step[]
  index: number
}

/** Where a step lives in the learning path (first module that contains it, or that has it as boss). */
function placeOf(kind: Step['kind'], id: string): Place | null {
  for (const module of curriculum) {
    const steps = [...module.steps, bossStep(module)]
    const index = steps.findIndex((s) => s.kind === kind && s.id === id)
    if (index >= 0) return { module, steps, index }
  }
  return null
}

/** True if the step is part of some module of the learning path. */
export const inPath = (kind: Step['kind'], id: string) => placeOf(kind, id) !== null

function StepLink({ step, dir, label }: { step: Step; dir: 'prev' | 'next'; label: string }) {
  const info = stepInfo(step)
  return (
    <Link
      to={info.href}
      className={clsx(
        'flex min-w-0 flex-1 items-center gap-3 rounded-xl border p-4 transition-colors',
        dir === 'next' ? 'justify-end border-sky-400/40 bg-sky-400/[0.06] text-right hover:border-sky-400/70' : 'border-zinc-800 hover:border-zinc-600',
      )}
    >
      {dir === 'prev' && <ArrowLeft size={18} className="shrink-0 text-zinc-500" />}
      <div className="min-w-0">
        <div className="text-xs text-zinc-500">{label}</div>
        <div className={clsx('truncate font-medium', dir === 'next' ? 'text-sky-100' : 'text-zinc-300')}>
          {info.emoji} {info.title}
        </div>
      </div>
      {dir === 'next' && <ArrowRight size={18} className="shrink-0 text-sky-300" />}
    </Link>
  )
}

/**
 * Previous / next step of the learning path, shown at the end of a lesson, card, task or scenario.
 * After the boss it leads to the first step of the next module. Renders nothing for content outside the path.
 */
export function ModuleNav({ kind, id, className }: { kind: Step['kind']; id: string; className?: string }) {
  const place = placeOf(kind, id)
  if (!place) return null
  const { module, steps, index } = place
  const prev = index > 0 ? steps[index - 1] : null
  const isBoss = index === steps.length - 1
  const nextModule = isBoss ? curriculum[curriculum.indexOf(module) + 1] : undefined
  const next = !isBoss ? steps[index + 1] : nextModule ? nextModule.steps[0] ?? bossStep(nextModule) : null
  const nextLabel = isBoss
    ? nextModule
      ? `Следующий модуль: ${nextModule.emoji} ${nextModule.title}`
      : ''
    : index + 1 === steps.length - 1
      ? 'Дальше: босс модуля'
      : `Дальше: ${kindMeta[steps[index + 1].kind].label.toLowerCase()}`

  return (
    <nav className={clsx('space-y-2', className)} aria-label="Навигация по модулю">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <Link to={`/path/${module.id}`} className="hover:text-zinc-300">
          {module.emoji} {module.title}
        </Link>
        <span>
          шаг {index + 1} из {steps.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {prev && <StepLink step={prev} dir="prev" label="Назад" />}
        {next ? (
          <StepLink step={next} dir="next" label={nextLabel} />
        ) : (
          <Link to="/path" className="flex flex-1 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-400/[0.06] p-4 text-emerald-200">
            Путь пройден до конца 🎉
          </Link>
        )}
      </div>
    </nav>
  )
}
