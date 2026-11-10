import { Background, Handle, MarkerType, type Node, type NodeProps, Position, ReactFlow } from '@xyflow/react'
import clsx from 'clsx'
import { ArrowLeft, ArrowRight, Check, Crown, Lock } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { curriculum, getModule, type Module, type Step } from '../learn/curriculum'
import { bossStep, isUnlocked, kindMeta, moduleProgress, nextStep, stepDone, stepInfo } from '../learn/progress'
import { autoLayout } from '../sim/layout'
import type { SimGraph } from '../sim/types'
import { useProgress } from '../store'

type ModuleNodeType = Node<{ m: Module; pct: number; done: string; unlocked: boolean; complete: boolean }, 'module'>

function Ring({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = size / 2 - 4
  const len = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#27272a" strokeWidth={4} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={pct >= 1 ? '#34d399' : '#38bdf8'}
        strokeWidth={4}
        fill="none"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - pct)}
        strokeLinecap="round"
      />
    </svg>
  )
}

function ModuleNode({ data }: NodeProps<ModuleNodeType>) {
  const { m, pct, done, unlocked, complete } = data
  return (
    <div
      className={clsx(
        'flex w-64 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-zinc-900 p-3 shadow-xl transition hover:-translate-y-0.5',
        complete ? 'border-emerald-400/70' : unlocked ? 'border-sky-400/50' : 'border-zinc-800 opacity-50',
      )}
    >
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
        <Ring pct={pct} />
        <span className="absolute text-xl">{unlocked ? m.emoji : '🔒'}</span>
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-zinc-100">{m.title}</div>
        <div className="text-xs text-zinc-500">{unlocked ? done : 'закрыт'}</div>
      </div>
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  )
}

const nodeTypes = { module: ModuleNode }

export function PathMap() {
  const results = useProgress((s) => s.results)
  const srs = useProgress((s) => s.srs)
  const navigate = useNavigate()
  const next = nextStep(results, srs)

  const { nodes, edges } = useMemo(() => {
    const g = { nodes: curriculum.map((m) => ({ id: m.id })), edges: curriculum.flatMap((m) => m.requires.map((r) => ({ source: r, target: m.id }))) }
    const pos = autoLayout(g as unknown as SimGraph)
    const nodes: ModuleNodeType[] = curriculum.map((m) => {
      const p = moduleProgress(m, results, srs)
      return {
        id: m.id,
        type: 'module',
        position: { x: pos[m.id].y * 2.2, y: pos[m.id].x * 0.55 },
        draggable: false,
        data: { m, pct: p.pct, done: `${p.done} / ${p.total}`, unlocked: isUnlocked(m, results, srs), complete: p.complete },
      }
    })
    const edges = g.edges.map((e) => ({
      id: `${e.source}-${e.target}`,
      ...e,
      animated: moduleProgress(getModule(e.source)!, results, srs).pct >= 0.7,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#52525b', strokeWidth: 2 },
    }))
    return { nodes, edges }
  }, [results, srs])

  const total = curriculum.reduce((a, m) => a + moduleProgress(m, results, srs).done, 0)
  const all = curriculum.reduce((a, m) => a + moduleProgress(m, results, srs).total, 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🧭 Путь обучения</h1>
          <p className="mt-1 text-sm text-zinc-400">
            От основ к сложному. В каждом модуле: пойми → познакомься с компонентами → потренируйся → сравни → объясни сам → босс. Модуль открывается, когда предыдущие пройдены на 70%.
          </p>
        </div>
        <div className="text-right text-sm text-zinc-400">
          Пройдено шагов <span className="font-mono text-zinc-100">{total} / {all}</span>
        </div>
      </div>

      {next && (
        <Link
          to={stepInfo(next.step).href}
          className="flex items-center gap-4 rounded-2xl border border-sky-400/40 bg-sky-400/[0.06] p-4 transition hover:border-sky-300"
        >
          <span className="text-3xl">{stepInfo(next.step).emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-sky-300">
              Следующий шаг · {next.module.emoji} {next.module.title} · {kindMeta[next.step.kind].label}
            </div>
            <div className="truncate text-lg font-semibold">{stepInfo(next.step).title}</div>
          </div>
          <ArrowRight className="text-sky-300" />
        </Link>
      )}

      <div className="h-[760px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.1, maxZoom: 1.1 }}
          nodesConnectable={false}
          onNodeClick={(_, n) => n.data.unlocked && navigate(`/path/${n.id}`)}
          colorMode="dark"
          zoomOnScroll={false}
        >
          <Background color="#1f1f23" gap={20} />
        </ReactFlow>
      </div>
    </div>
  )
}

const groups: { title: string; kinds: Step['kind'][] }[] = [
  { title: '1. Пойми основы', kinds: ['concept'] },
  { title: '2. Познакомься с компонентами', kinds: ['card'] },
  { title: '3. Потренируйся', kinds: ['task'] },
  { title: '4. Сравни', kinds: ['duel'] },
  { title: '5. Объясни сам', kinds: ['explain'] },
  { title: '6. Атакуй и защищай', kinds: ['ctf', 'defense'] },
  { title: 'Дополнительно', kinds: ['scenario'] },
]

function StepRow({ s, done }: { s: Step; done: boolean }) {
  const info = stepInfo(s)
  return (
    <Link
      to={info.href}
      className={clsx(
        'flex items-center gap-3 rounded-xl border px-3 py-2 transition hover:border-zinc-600',
        done ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/40',
      )}
    >
      <span className="text-lg">{info.emoji}</span>
      <span className={clsx('flex-1 text-sm', done ? 'text-zinc-400' : 'text-zinc-100')}>{info.title}</span>
      {done ? <Check size={16} className="text-emerald-400" /> : <ArrowRight size={14} className="text-zinc-600" />}
    </Link>
  )
}

export function ModulePage() {
  const { id } = useParams()
  const results = useProgress((s) => s.results)
  const srs = useProgress((s) => s.srs)
  const m = id ? getModule(id) : undefined
  if (!m)
    return (
      <div className="p-8">
        Модуль не найден. <Link to="/path" className="text-sky-400">К пути</Link>
      </div>
    )
  const p = moduleProgress(m, results, srs)
  const unlocked = isUnlocked(m, results, srs)
  const boss = bossStep(m)
  const bossInfo = stepInfo(boss)
  const firstOpen = m.steps.find((s) => !(s.kind === 'scenario' && s.optional) && !stepDone(s, results, srs))

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link to="/path" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200">
        <ArrowLeft size={14} /> Путь
      </Link>
      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <Ring pct={p.pct} size={64} />
          <span className="absolute text-3xl">{m.emoji}</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
          <div className="text-sm text-zinc-400">
            {p.done} / {p.total} шагов
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">🎯 После модуля: {m.goal}</div>
      {!unlocked && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-200">
          <Lock size={14} /> Модуль ещё закрыт: пройди предыдущие на 70%. Заглянуть можно.
        </div>
      )}
      {firstOpen && (
        <Link to={stepInfo(firstOpen).href} className="flex items-center justify-between rounded-xl bg-sky-500 px-4 py-3 font-medium text-zinc-950 hover:bg-sky-400">
          Продолжить: {stepInfo(firstOpen).title} <ArrowRight size={16} />
        </Link>
      )}

      {groups.map((g) => {
        const list = m.steps.filter((s) => g.kinds.includes(s.kind))
        if (!list.length) return null
        return (
          <section key={g.title} className="space-y-2">
            <h2 className="text-sm font-medium text-zinc-400">{g.title}</h2>
            <div className="space-y-1.5">
              {list.map((s, i) => (
                <StepRow key={i} s={s} done={stepDone(s, results, srs)} />
              ))}
            </div>
          </section>
        )
      })}

      <section className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-amber-300">
          <Crown size={14} /> Босс модуля
        </h2>
        <Link
          to={bossInfo.href}
          className={clsx(
            'flex items-center gap-3 rounded-2xl border-2 p-4 transition',
            p.bossDone ? 'border-emerald-400/50 bg-emerald-400/5' : 'border-amber-400/40 bg-amber-400/5 hover:border-amber-300',
          )}
        >
          <span className="text-3xl">{bossInfo.emoji}</span>
          <div className="flex-1">
            <div className="font-semibold">{bossInfo.title}</div>
            <div className="text-xs text-zinc-400">
              {boss.kind === 'scenario' ? 'Дежурство в реальном времени' : boss.kind === 'defense' ? 'Отбей все волны атак' : boss.kind === 'ctf' ? 'Вытащи секрет у агента' : 'Спроектируй систему, ИИ-интервьюер оценит'}
            </div>
          </div>
          {p.bossDone ? <Check className="text-emerald-400" /> : <ArrowRight className="text-amber-300" />}
        </Link>
      </section>
    </div>
  )
}
