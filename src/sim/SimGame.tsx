import { type Connection, ReactFlowProvider } from '@xyflow/react'
import clsx from 'clsx'
import {
  ArrowLeft,
  ChevronDown,
  CircleDollarSign,
  HeartPulse,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  StepForward,
  Lock,
  Timer,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Markdown } from '../components/Markdown'
import { postApi } from '../lib/api'
import { blocks } from '../lib/blocks'
import { simKey, useProgress } from '../store'
import type { BlockType } from '../tasks/types'
import { Dashboard } from './Dashboard'
import { staticAnalysis } from './engine'
import { Inspector } from './Inspector'
import { SimCanvas } from './SimCanvas'
import { fmtNum } from './SimNode'
import type { Load, Scenario, SimGraph, SimNodeConfig } from './types'
import { speeds, useSimulation } from './useSimulation'
import { ModuleNav } from '../components/ModuleNav'

const noop = () => {}

const palette: BlockType[] = [
  'cdn', 'lb', 'gateway', 'service', 'worker', 'postgres', 'replica', 'redis',
  'queue', 'kafka', 's3', 'search', 'clickhouse', 'external',
  'ssr', 'bff', 'edge', 'realtime', 'llm', 'llmgw', 'semcache', 'vectordb',
]

function describeGraph(g: SimGraph) {
  const nodes = g.nodes.map((n) => `${n.id} (${n.type}, ${n.instances}×${n.size}${n.hitRatio !== undefined ? `, hit ${n.hitRatio}` : ''}${n.rateLimit ? `, limit ${n.rateLimit}` : ''})`)
  return `Узлы: ${nodes.join('; ')}\nСвязи: ${g.edges.map((e) => `${e.source}→${e.target}`).join(', ')}`
}

function Game({ scenario, initialGraph }: { scenario: Scenario | null; initialGraph: SimGraph }) {
  const sim = useSimulation(scenario, initialGraph)
  const record = useProgress((s) => s.record)
  const [canvasKey, setCanvasKey] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showDash, setShowDash] = useState(true)
  const [recorded, setRecorded] = useState(false)

  const { graph, last, status } = sim
  const analysis = useMemo(() => staticAnalysis(graph), [graph])
  // Живая стоимость: железо + оплата LLM за запросы по текущему трафику.
  const cost = sim.history.at(-1)?.costPerMonth ?? analysis.costPerMonth
  const health = last?.health ?? 100

  if ((status === 'won' || status === 'lost') && scenario && !recorded) {
    setRecorded(true)
    record(simKey(scenario.id), status === 'won' ? Math.max(1, Math.round(health)) : 0)
    if (status === 'won') {
      if (health >= 100) record('feat:flawless', 100)
      if (cost <= scenario.budgetPerMonth * 0.7) record('feat:penny', 100)
      if (!sim.usedPerk) record('feat:no-perks', 100)
    }
  }

  const inventory = useProgress((s) => s.inventory)
  const useItem = useProgress((s) => s.useItem)
  const [buddy, setBuddy] = useState<{ loading: boolean; text?: string } | null>(null)
  const callBuddy = async () => {
    if (!useItem('perk-buddy')) return
    sim.markPerkUsed()
    setBuddy({ loading: true })
    const hot = last
      ? Object.values(last.nodes)
          .map((m) => `${graph.nodes.find((n) => n.id === m.id)?.label}: ${Math.round(m.rps)} rps, загрузка ${Math.round(m.utilization * 100)}%, ${Math.round(m.latencyMs)}ms, ошибки ${(m.errorRate * 100).toFixed(1)}%${m.backlog ? `, очередь ${Math.round(m.backlog)}` : ''}`)
          .join('\n')
      : 'метрик пока нет'
    try {
      const { text } = await postApi<{ text: string }>('/api/ask', {
        topic: `дежурство: ${scenario?.title ?? 'песочница'}`,
        context: `${scenario?.briefing ?? ''}\n\nАрхитектура:\n${describeGraph(graph)}\n\nМетрики сейчас (минута ${sim.t}):\n${hot}\n\nSLO: ${scenario ? `p99 ≤ ${scenario.slo.p99Ms}ms, ошибки ≤ ${scenario.slo.errorRate * 100}%` : '—'}`,
        question: 'Ты опытный напарник на дежурстве. Где сейчас главное узкое место и какое ОДНО действие сделать прямо сейчас? Потом что проверить через 2–3 минуты. Максимум 4 коротких пункта, без воды, не раскрывай всё решение сценария.',
      })
      setBuddy({ loading: false, text })
    } catch (e) {
      setBuddy({ loading: false, text: (e as Error).message })
    }
  }
  const perk = (id: string, fn: () => void) => {
    if (useItem(id)) fn()
  }
  // Рентген: 3 минуты подсвечиваем узел, который сильнее всего мешает (лежит под трафиком или перегружен больше всех).
  const [xrayUntil, setXrayUntil] = useState(-1)
  const xray = (() => {
    if (sim.t >= xrayUntil || !last) return undefined
    const cand = Object.values(last.nodes).filter((m) => graph.nodes.find((n) => n.id === m.id)?.type !== 'client')
    const down = cand.find((m) => m.status === 'down' && m.rps > 0)
    if (down) return down.id
    return cand.reduce<(typeof cand)[number] | undefined>((a, b) => (!a || b.utilization > a.utilization ? b : a), undefined)?.id
  })()
  const xrayPerk = () => {
    if (!useItem('perk-xray')) return
    sim.markPerkUsed()
    setXrayUntil(sim.t + 3)
  }
  const undoPerk = () => {
    if (!sim.canUndo() || !useItem('perk-undo')) return
    sim.undo()
  }

  const graphRef = useRef(graph)
  graphRef.current = graph
  const changeGraph = sim.changeGraph
  const apply = useCallback(
    (next: SimGraph, text: string) => {
      const err = changeGraph(next, text)
      if (err) {
        setToast(err)
        setTimeout(() => setToast(null), 2500)
      }
      return !err
    },
    [changeGraph],
  )

  const updateNode = (cfg: SimNodeConfig, text: string) =>
    apply({ ...graph, nodes: graph.nodes.map((n) => (n.id === cfg.id ? cfg : n)) }, text)

  const deleteNode = useCallback(
    (id: string) => {
      const g = graphRef.current
      const n = g.nodes.find((x) => x.id === id)
      if (!n || n.type === 'client') return
      apply(
        { nodes: g.nodes.filter((x) => x.id !== id), edges: g.edges.filter((e) => e.source !== id && e.target !== id) },
        `удалён ${n.label}`,
      )
      setSelected(null)
    },
    [apply],
  )

  const deleteEdge = useCallback(
    (source: string, target: string) => {
      const g = graphRef.current
      apply({ ...g, edges: g.edges.filter((e) => !(e.source === source && e.target === target)) }, `удалена связь ${source} → ${target}`)
    },
    [apply],
  )

  const banned = new Map((scenario?.bannedBlocks ?? []).map((b) => [b.type, b.reason]))

  const addNode = (type: BlockType) => {
    if (banned.has(type)) {
      setToast(`🚫 ${blocks[type].label}: ${banned.get(type)}`)
      setTimeout(() => setToast(null), 3000)
      return
    }
    const id = `${type}-${crypto.randomUUID().slice(0, 4)}`
    const cfg: SimNodeConfig = {
      id,
      type,
      label: blocks[type].label,
      instances: 1,
      size: 'S',
      ...(type === 'redis' ? { hitRatio: 0.8 } : type === 'cdn' || type === 'edge' ? { hitRatio: 0.9 } : type === 'semcache' ? { hitRatio: 0.3 } : {}),
    }
    if (apply({ ...graph, nodes: [...graph.nodes, cfg] }, `добавлен ${cfg.label}`)) setSelected(id)
  }

  const onConnect = useCallback(
    (c: Connection) => {
      const g = graphRef.current
      if (!c.source || !c.target || c.source === c.target) return
      if (g.edges.some((e) => e.source === c.source && e.target === c.target)) return
      const a = g.nodes.find((n) => n.id === c.source)!
      const b = g.nodes.find((n) => n.id === c.target)!
      apply({ ...g, edges: [...g.edges, { source: c.source, target: c.target }] }, `связь ${a.label} → ${b.label}`)
    },
    [apply],
  )

  const selCfg = graph.nodes.find((n) => n.id === selected)

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-4 border-b border-zinc-800 px-4 py-2">
        <Link to="/oncall" className="text-zinc-400 hover:text-zinc-100">
          <ArrowLeft size={18} />
        </Link>
        <div className="font-semibold">{scenario ? scenario.title : 'Песочница'}</div>
        <div className="flex items-center gap-1.5 font-mono text-sm text-zinc-300">
          <Timer size={14} /> {sim.t}
          {scenario && ` / ${scenario.durationMin}`} мин
        </div>
        {scenario && (
          <div className="flex items-center gap-2">
            <HeartPulse size={14} className={health < 30 ? 'text-rose-400' : 'text-emerald-400'} />
            <div className="h-2 w-32 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={clsx('h-full transition-all', health < 30 ? 'bg-rose-500' : health < 60 ? 'bg-amber-400' : 'bg-emerald-400')}
                style={{ width: `${health}%` }}
              />
            </div>
            <span className="font-mono text-xs text-zinc-400">{Math.round(health)}%</span>
          </div>
        )}
        <div className={clsx('flex items-center gap-1.5 font-mono text-sm', scenario && cost > scenario.budgetPerMonth * 0.9 ? 'text-amber-300' : 'text-zinc-300')}>
          <CircleDollarSign size={14} /> ${fmtNum(cost)}
          {scenario && ` / $${fmtNum(scenario.budgetPerMonth)}`}
        </div>
        {last && (
          <div className="font-mono text-xs text-zinc-400">
            p99 <span className={clsx(scenario && last.p99Ms > scenario.slo.p99Ms && 'text-rose-300')}>{fmtNum(last.p99Ms)}ms</span> · err{' '}
            <span className={clsx(scenario && last.errorRate > scenario.slo.errorRate && 'text-rose-300')}>
              {(last.errorRate * 100).toFixed(1)}%
            </span>
          </div>
        )}
        {scenario && (
          <div className="flex items-center gap-1">
            {[
              { id: 'perk-buddy', emoji: '🤖', title: 'ИИ-напарник: подсказка по текущим метрикам', fn: callBuddy },
              { id: 'perk-coffee', emoji: '☕', title: 'Кофе-брейк: 3 минуты бюджет ошибок не горит', fn: () => perk('perk-coffee', sim.coffee) },
              { id: 'perk-deploy', emoji: '⚡', title: 'Быстрый деплой: следующее изменение без прогрева', fn: () => perk('perk-deploy', sim.armFastDeploy) },
              { id: 'perk-xray', emoji: '🧭', title: 'Рентген: 3 минуты подсвечено главное узкое место', fn: xrayPerk },
              { id: 'perk-undo', emoji: '⏪', title: 'Откат: отменить последнее изменение схемы без прогрева', fn: undoPerk },
            ].map((p) => {
              const n = inventory[p.id] ?? 0
              return (
                <button
                  key={p.id}
                  onClick={p.fn}
                  disabled={n <= 0 || status === 'won' || status === 'lost'}
                  title={n > 0 ? p.title : `${p.title}. Купить в магазине`}
                  className="relative rounded-lg bg-zinc-800 px-2 py-1.5 text-base hover:bg-zinc-700 disabled:opacity-30"
                >
                  {p.emoji}
                  <span className="absolute -top-1 -right-1 rounded-full bg-amber-400 px-1 text-[9px] font-bold text-zinc-950">{n}</span>
                </button>
              )
            })}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          {status === 'running' ? (
            <button onClick={() => sim.setStatus('paused')} className="rounded-lg bg-zinc-800 p-2 hover:bg-zinc-700" title="Пауза">
              <Pause size={16} />
            </button>
          ) : (
            <button
              disabled={status === 'won' || status === 'lost'}
              onClick={() => sim.setStatus('running')}
              className="rounded-lg bg-emerald-500 p-2 text-zinc-950 hover:bg-emerald-400 disabled:opacity-30"
              title="Старт"
            >
              <Play size={16} />
            </button>
          )}
          <button
            disabled={status === 'running' || status === 'won' || status === 'lost'}
            onClick={sim.tick}
            className="rounded-lg bg-zinc-800 p-2 hover:bg-zinc-700 disabled:opacity-30"
            title="Шаг на 1 минуту"
          >
            <StepForward size={16} />
          </button>
          {speeds.map((s, i) => (
            <button
              key={s.label}
              onClick={() => sim.setSpeed(i)}
              className={clsx('rounded-lg px-2 py-1.5 text-xs', i === sim.speed ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 hover:bg-zinc-700')}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => {
              sim.restart()
              setCanvasKey((k) => k + 1)
              setRecorded(false)
              setSelected(null)
            }}
            className="rounded-lg bg-zinc-800 p-2 hover:bg-zinc-700"
            title="Заново"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <div className="relative min-w-0 flex-1">
          {scenario?.configOnly ? (
            <div className="absolute top-2 left-2 z-10 rounded-xl border border-amber-400/30 bg-zinc-900/90 px-3 py-1.5 text-xs text-amber-200 backdrop-blur">
              🏚️ Наследство: топология и железо заморожены. Кликай блоки и чини конфиги.
            </div>
          ) : (
          <div className="absolute top-2 left-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 backdrop-blur">
            {palette.map((t) => {
              const Icon = banned.has(t) ? Lock : blocks[t].icon
              return (
                <button
                  key={t}
                  onClick={() => addNode(t)}
                  title={banned.get(t) ?? `Добавить: ${blocks[t].label}`}
                  className={clsx(
                    'flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] hover:bg-zinc-800',
                    banned.has(t) ? 'text-zinc-600 line-through' : 'text-zinc-300',
                  )}
                >
                  <Icon size={13} style={{ color: banned.has(t) ? '#52525b' : blocks[t].color }} />
                  {blocks[t].label}
                </button>
              )
            })}
          </div>
          )}
          {toast && (
            <div className="absolute top-14 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white shadow-lg">
              {toast}
            </div>
          )}
          <SimCanvas
            key={canvasKey}
            graph={graph}
            metrics={last?.nodes}
            running={status === 'running'}
            onSelect={setSelected}
            onConnect={scenario?.configOnly ? noop : onConnect}
            onDeleteNode={scenario?.configOnly ? noop : deleteNode}
            onDeleteEdge={scenario?.configOnly ? noop : deleteEdge}
            xray={xray}
          />
        </div>

        {/* Sidebar */}
        <div className="w-80 shrink-0 overflow-y-auto border-l border-zinc-800">
          {selCfg ? (
            <Inspector
              cfg={selCfg}
              m={last?.nodes[selCfg.id]}
              onChange={updateNode}
              onDelete={() => deleteNode(selCfg.id)}
              configOnly={scenario?.configOnly}
            />
          ) : (
            <div className="p-4 text-xs text-zinc-500">Кликни блок, чтобы масштабировать или настроить. Связь — потяни от точки на краю блока.</div>
          )}
          {buddy && (
            <div className="border-b border-zinc-800 p-4 text-sm">
              <div className="mb-1 flex items-center justify-between font-medium text-violet-200">
                🤖 Напарник
                <button onClick={() => setBuddy(null)} className="text-zinc-500 hover:text-zinc-200" aria-label="Закрыть">
                  ×
                </button>
              </div>
              {buddy.loading ? <div className="text-zinc-500">смотрит на графики…</div> : <Markdown>{buddy.text ?? ''}</Markdown>}
            </div>
          )}
          {!scenario && <SandboxControls sim={sim} selected={selCfg} />}
          {(analysis.spofs.length > 0 || analysis.warnings.length > 0) && (
            <div className="space-y-1 border-t border-zinc-800 p-4 text-xs">
              <div className="font-medium text-amber-300">Архитектурный ревью</div>
              {analysis.spofs.map((s) => (
                <div key={s} className="text-amber-200/80">
                  SPOF: {graph.nodes.find((n) => n.id === s)?.label ?? s}
                </div>
              ))}
              {analysis.warnings.map((w) => (
                <div key={w} className="text-zinc-400">• {w}</div>
              ))}
            </div>
          )}
          <div className="space-y-1 border-t border-zinc-800 p-4">
            <div className="text-xs font-medium text-zinc-400">Лента событий</div>
            {[...sim.alerts, ...sim.actions]
              .sort((a, b) => b.t - a.t)
              .slice(0, 40)
              .map((l, i) => (
                <div
                  key={i}
                  className={clsx(
                    'rounded-md px-2 py-1 text-xs',
                    l.tone === 'alert' && 'bg-rose-500/10 text-rose-200',
                    l.tone === 'ok' && 'bg-emerald-500/10 text-emerald-200',
                    l.tone === 'action' && 'text-zinc-400',
                  )}
                >
                  <span className="mr-1 font-mono text-zinc-500">{l.t}м</span>
                  {l.tone === 'alert' && <TriangleAlert size={11} className="mr-1 inline" />}
                  {l.text}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <div className="border-t border-zinc-800 bg-zinc-950">
        <button
          onClick={() => setShowDash(!showDash)}
          className="flex w-full items-center gap-1 px-4 py-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          <ChevronDown size={14} className={clsx('transition', !showDash && '-rotate-90')} /> Дашборд
        </button>
        {showDash && (
          <div className="max-h-[300px] overflow-y-auto px-3 pb-3">
            <Dashboard history={sim.history} graph={graph} slo={scenario?.slo} budget={scenario?.budgetPerMonth} />
          </div>
        )}
      </div>

      {scenario && status === 'briefing' && (
        <Modal>
          <h2 className="text-xl font-bold">{scenario.title}</h2>
          <Markdown>{scenario.briefing}</Markdown>
          {!!scenario.bannedBlocks?.length && (
            <div className="space-y-1 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
              <div className="font-medium text-rose-300">🚫 Ограничения</div>
              {scenario.bannedBlocks.map((b) => (
                <div key={b.type} className="text-zinc-300">
                  <span className="font-medium text-zinc-100">{blocks[b.type].label}</span> — {b.reason}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-sm text-zinc-300">
            <span>SLO: p99 ≤ {scenario.slo.p99Ms}ms, ошибки ≤ {(scenario.slo.errorRate * 100).toFixed(1)}%</span>
            <span>Бюджет ошибок: {scenario.errorBudgetMin} мин</span>
            <span>Бюджет: ${scenario.budgetPerMonth}/мес</span>
            <span>Длительность: {scenario.durationMin} мин</span>
          </div>
          <div className="text-xs text-zinc-500">1 минута симуляции = 1 секунда (×1). Новые инстансы прогреваются — действуй заранее. Пауза разрешена.</div>
          <button onClick={() => sim.setStatus('paused')} className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-zinc-950 hover:bg-emerald-400">
            Принять дежурство
          </button>
        </Modal>
      )}

      {scenario && (status === 'won' || status === 'lost') && <EndModal scenario={scenario} sim={sim} health={health} />}
    </div>
  )
}

function SandboxControls({ sim, selected }: { sim: ReturnType<typeof useSimulation>; selected?: SimNodeConfig }) {
  const keys: { k: keyof Load; label: string }[] = [
    { k: 'read', label: 'Чтение' },
    { k: 'write', label: 'Запись' },
    { k: 'static', label: 'Статика' },
  ]
  return (
    <div className="space-y-3 border-t border-zinc-800 p-4 text-xs">
      <div className="font-medium text-zinc-300">Нагрузка, rps</div>
      {keys.map(({ k, label }) => (
        <div key={k} className="space-y-1">
          <div className="flex justify-between text-zinc-500">
            <span>{label}</span>
            <span className="font-mono text-zinc-300">{fmtNum(sim.manualLoad[k])}</span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            step={0.01}
            value={Math.log10(1 + sim.manualLoad[k])}
            onChange={(e) => sim.setManualLoad({ ...sim.manualLoad, [k]: Math.round(10 ** Number(e.target.value) - 1) })}
            className="w-full accent-sky-400"
          />
        </div>
      ))}
      <div className="font-medium text-zinc-300">Инциденты</div>
      <div className="flex flex-wrap gap-1">
        <IncidentBtn disabled={!selected} onClick={() => sim.inject({ kind: 'kill', target: selected!.id, duration: 10, message: `💥 ${selected!.label} упал на 10 мин` })}>
          Уронить выбранный
        </IncidentBtn>
        <IncidentBtn disabled={!selected} onClick={() => sim.inject({ kind: 'killOne', target: selected!.id, message: `💥 Умер один инстанс ${selected!.label}` })}>
          Убить инстанс
        </IncidentBtn>
        <IncidentBtn disabled={!selected} onClick={() => sim.inject({ kind: 'slow', target: selected!.id, value: 10, duration: 10, message: `🐢 ${selected!.label} замедлился ×10` })}>
          Замедлить ×10
        </IncidentBtn>
        <IncidentBtn disabled={selected?.type !== 'redis' && selected?.type !== 'cdn'} onClick={() => sim.inject({ kind: 'cacheFlush', target: selected!.id, duration: 8, message: `🧊 Кэш ${selected!.label} сброшен` })}>
          Сбросить кэш
        </IncidentBtn>
        <IncidentBtn onClick={() => sim.inject({ kind: 'ddos', value: 20000, duration: 8, message: '🤖 DDoS: +20k rps мусорных запросов' })}>
          DDoS
        </IncidentBtn>
        <IncidentBtn onClick={() => sim.inject({ kind: 'zoneDown', target: 'a', duration: 10, message: '🌩 Зона A недоступна 10 минут' })}>
          Уронить зону A
        </IncidentBtn>
        <IncidentBtn disabled={selected?.type !== 'worker'} onClick={() => sim.inject({ kind: 'stall', target: selected!.id, duration: 15, message: `🧟 ${selected!.label} жив, но не читает` })}>
          Живой мертвец
        </IncidentBtn>
      </div>
    </div>
  )
}

function IncidentBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p} className="rounded-lg border border-rose-500/30 px-2 py-1 text-rose-200 hover:bg-rose-500/10 disabled:opacity-30">
      {children}
    </button>
  )
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6">{children}</div>
    </div>
  )
}

function EndModal({ scenario, sim, health }: { scenario: Scenario; sim: ReturnType<typeof useSimulation>; health: number }) {
  const [pm, setPm] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closed, setClosed] = useState(false)
  const won = sim.status === 'won'
  if (closed) return null

  const postmortem = async () => {
    setLoading(true)
    setError(null)
    try {
      const every = Math.max(1, Math.floor(sim.history.length / 30))
      const { text } = await postApi<{ text: string }>('/api/postmortem', {
        scenario: { title: scenario.title, briefing: scenario.briefing, slo: scenario.slo, budgetPerMonth: scenario.budgetPerMonth },
        outcome: won ? 'survived' : 'failed',
        timeline: sim.history
          .filter((_, i) => i % every === 0)
          .map((h) => ({
            t: h.t,
            rps: h.load.read + h.load.write + h.load.static,
            p99Ms: h.p99Ms,
            errorRate: h.errorRate,
            costPerMonth: h.costPerMonth,
            health: h.health,
            hot: Object.values(h.nodes).filter((n) => n.utilization >= 0.9 || n.status === 'down').map((n) => n.id),
          })),
        actions: sim.actions,
        alerts: sim.alerts,
        finalGraph: describeGraph(sim.graph),
      })
      setPm(text)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal>
      <h2 className={clsx('text-2xl font-bold', won ? 'text-emerald-300' : 'text-rose-300')}>
        {won ? `Дежурство пережито! Здоровье ${Math.round(health)}%` : 'Сервис упал — бюджет ошибок исчерпан'}
      </h2>
      <div className="text-sm text-zinc-400">
        Действий: {sim.actions.length} · Алертов: {sim.alerts.length} · Минут: {sim.t}
      </div>
      <details open className="rounded-lg bg-zinc-900 p-3">
        <summary className="cursor-pointer text-sm font-medium text-zinc-300">Разбор сценария</summary>
        <div className="mt-2">
          <Markdown>{scenario.debrief}</Markdown>
        </div>
      </details>
      {pm ? (
        <div className="rounded-lg border border-violet-400/30 bg-violet-400/5 p-4">
          <Markdown>{pm}</Markdown>
        </div>
      ) : (
        <button
          onClick={postmortem}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-50"
        >
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? 'SRE-лид пишет постмортем…' : 'ИИ-постмортем моих действий'}
        </button>
      )}
      {error && <div className="text-sm text-rose-300">{error}</div>}
      <ModuleNav kind="scenario" id={scenario.id} />
      <div className="flex gap-2">
        <button
          onClick={() => setClosed(true)}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
        >
          Посмотреть графики
        </button>
        <Link to="/oncall" className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white">
          К сценариям
        </Link>
      </div>
    </Modal>
  )
}

export function SimGame({ scenario, initialGraph }: { scenario: Scenario | null; initialGraph: SimGraph }) {
  return (
    <ReactFlowProvider>
      <Game scenario={scenario} initialGraph={initialGraph} />
    </ReactFlowProvider>
  )
}
