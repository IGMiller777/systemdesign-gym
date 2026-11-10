import { useCallback, useEffect, useRef, useState } from 'react'
import { createState, onGraphChange, staticAnalysis, step } from './engine'
import type { Load, Scenario, SimGraph, SimState, TickResult } from './types'

export type GameStatus = 'briefing' | 'running' | 'paused' | 'won' | 'lost'

export interface LogEntry {
  t: number
  text: string
  tone?: 'alert' | 'ok' | 'action'
}

export const speeds = [
  { label: '×1', ms: 1000 },
  { label: '×2', ms: 500 },
  { label: '×4', ms: 250 },
]

/** Game loop: one tick = one sim minute; keeps graph, engine state, history and logs. */
export function useSimulation(scenario: Scenario | null, initialGraph: SimGraph) {
  const [graph, setGraph] = useState(initialGraph)
  const [history, setHistory] = useState<TickResult[]>([])
  const [status, setStatus] = useState<GameStatus>(scenario ? 'briefing' : 'running')
  const [speed, setSpeed] = useState(0)
  const [alerts, setAlerts] = useState<LogEntry[]>([])
  const [actions, setActions] = useState<LogEntry[]>([])
  const [manualLoad, setManualLoad] = useState<Load>({ read: 300, write: 60, static: 50 })

  const simState = useRef<SimState>(createState(initialGraph))
  const graphRef = useRef(graph)
  const loadRef = useRef(manualLoad)
  const wasViolating = useRef(false)
  // Perks: coffee freezes error-budget burn until this tick; fast deploy skips warmup of the next change.
  const coffeeUntil = useRef(-1)
  const fastDeploy = useRef(false)
  /** Graphs before each player change, for the undo perk. */
  const undoStack = useRef<SimGraph[]>([])
  const [usedPerk, setUsedPerk] = useState(false)
  graphRef.current = graph
  loadRef.current = manualLoad

  const t = simState.current.t

  const tick = useCallback(() => {
    const before = simState.current.t
    const { result, state } = step(graphRef.current, simState.current, {
      scenario: scenario ?? undefined,
      manualLoad: scenario ? undefined : loadRef.current,
    })
    if (scenario && result.sloViolated && before < coffeeUntil.current) {
      state.violatedMinutes = Math.max(0, state.violatedMinutes - 1)
      result.health = Math.max(0, Math.min(100, 100 * (1 - state.violatedMinutes / scenario.errorBudgetMin)))
    }
    simState.current = state
    setHistory((h) => [...h.slice(-239), result])

    if (scenario) {
      const fired = scenario.events.filter((e) => e.at === before)
      if (fired.length) setAlerts((a) => [...a, ...fired.map((e) => ({ t: before, text: e.message, tone: 'alert' as const }))])
      if (result.sloViolated && !wasViolating.current)
        setAlerts((a) => [
          ...a,
          {
            t: before,
            text: `SLO нарушен: p99 ${Math.round(result.p99Ms)}ms, ошибки ${(result.errorRate * 100).toFixed(1)}% — горит бюджет ошибок`,
            tone: 'alert',
          },
        ])
      if (!result.sloViolated && wasViolating.current)
        setAlerts((a) => [...a, { t: before, text: 'Метрики вернулись в норму', tone: 'ok' }])
      wasViolating.current = result.sloViolated
      if (result.health <= 0) setStatus('lost')
      else if (state.t >= scenario.durationMin) setStatus('won')
    }
  }, [scenario])

  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(tick, speeds[speed].ms)
    return () => clearInterval(id)
  }, [status, speed, tick])

  /** Apply an architecture change made by the player. Returns an error text if over budget. */
  const changeGraph = useCallback(
    (next: SimGraph, text: string): string | null => {
      if (scenario) {
        const cost = staticAnalysis(next).costPerMonth
        const prevCost = staticAnalysis(graphRef.current).costPerMonth
        if (cost > scenario.budgetPerMonth && cost > prevCost)
          return `Не хватает бюджета: $${Math.round(cost)} > $${scenario.budgetPerMonth}/мес`
      }
      undoStack.current = [...undoStack.current.slice(-19), graphRef.current]
      simState.current = onGraphChange(graphRef.current, next, simState.current)
      if (fastDeploy.current) {
        fastDeploy.current = false
        for (const n of next.nodes) {
          const ns = simState.current.nodes[n.id]
          if (ns?.warmingInstances) {
            delete ns.warmingInstances
            delete ns.warmingFrom
          }
        }
      }
      setGraph(next)
      setActions((a) => [...a, { t: simState.current.t, text, tone: 'action' }])
      return null
    },
    [scenario],
  )

  /** Sandbox-only: inject an incident by hand via a one-off scenario event. */
  const inject = useCallback(
    (event: Omit<import('./types').ScenarioEvent, 'at'>) => {
      const now = simState.current.t
      const oneOff: Scenario = {
        id: 'sandbox',
        title: '',
        level: 0,
        briefing: '',
        durationMin: 1e9,
        baseLoad: loadRef.current,
        events: [{ ...event, at: now }],
        slo: { p99Ms: 1e9, errorRate: 1 },
        errorBudgetMin: 1e9,
        budgetPerMonth: 1e9,
        startGraph: graphRef.current,
      } as Scenario
      const { result, state } = step(graphRef.current, simState.current, { scenario: oneOff })
      simState.current = state
      setHistory((h) => [...h.slice(-239), result])
      setAlerts((a) => [...a, { t: now, text: event.message, tone: 'alert' }])
    },
    [],
  )

  const restart = useCallback(() => {
    simState.current = createState(initialGraph)
    wasViolating.current = false
    undoStack.current = []
    setGraph(initialGraph)
    setHistory([])
    setAlerts([])
    setActions([])
    setStatus(scenario ? 'briefing' : 'running')
  }, [initialGraph, scenario])

  const coffee = useCallback(() => {
    coffeeUntil.current = simState.current.t + 3
    setUsedPerk(true)
    setAlerts((a) => [...a, { t: simState.current.t, text: '☕ Кофе-брейк: 3 минуты бюджет ошибок не горит', tone: 'ok' }])
  }, [])
  const armFastDeploy = useCallback(() => {
    fastDeploy.current = true
    setUsedPerk(true)
    setAlerts((a) => [...a, { t: simState.current.t, text: '⚡ Быстрый деплой: следующее изменение без прогрева', tone: 'ok' }])
  }, [])
  const markPerkUsed = useCallback(() => setUsedPerk(true), [])
  const canUndo = () => undoStack.current.length > 0
  /** Undo perk: back to the graph before the last change, with no warmup. */
  const undo = useCallback(() => {
    const prev = undoStack.current.at(-1)
    if (!prev) return false
    fastDeploy.current = true
    const err = changeGraph(prev, '⏪ откат последнего изменения')
    if (err) return false
    // changeGraph pushed the graph we just left; drop it together with the one we restored
    undoStack.current = undoStack.current.slice(0, -2)
    setUsedPerk(true)
    return true
  }, [changeGraph])

  return {
    coffee,
    armFastDeploy,
    markPerkUsed,
    usedPerk,
    undo,
    canUndo,
    graph,
    history,
    last: history.at(-1),
    status,
    setStatus,
    speed,
    setSpeed,
    alerts,
    actions,
    t,
    tick,
    changeGraph,
    inject,
    restart,
    manualLoad,
    setManualLoad,
  }
}
