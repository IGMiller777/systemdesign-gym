import { describe, expect, it } from 'vitest'
import type { BlockType } from '../tasks/types'
import { blockSpecs, createState, onGraphChange, sizeMult, staticAnalysis, step } from './engine'
import type { Load, Scenario, ScenarioEvent, SimGraph, SimNodeConfig, SimState, TickResult } from './types'

const node = (id: string, type: BlockType, extra: Partial<SimNodeConfig> = {}): SimNodeConfig => ({
  id, type, label: id, instances: 1, size: 'S', ...extra,
})
const graph = (nodes: SimNodeConfig[], edges: [string, string][]): SimGraph => ({
  nodes, edges: edges.map(([source, target]) => ({ source, target })),
})
const L = (read = 0, write = 0, stat = 0): Load => ({ read, write, static: stat })

/** Прогоняет N тиков в песочнице, возвращает последний результат. */
function run(g: SimGraph, load: Load, ticks = 1, state: SimState = createState(g)) {
  let st = state
  let result!: TickResult
  for (let i = 0; i < ticks; i++) ({ result, state: st } = step(g, st, { manualLoad: load }))
  return { result, state: st }
}

const scenario = (g: SimGraph, baseLoad: Load, events: ScenarioEvent[] = []): Scenario => ({
  id: 't', title: 't', level: 1, briefing: '', durationMin: 30, baseLoad, events,
  slo: { p99Ms: 500, errorRate: 0.01 }, errorBudgetMin: 10, budgetPerMonth: 10000, startGraph: g, debrief: '',
})

describe('sizes and specs', () => {
  it('vertical scaling has diminishing returns', () => {
    expect(sizeMult.XL.cost / sizeMult.XL.capacity).toBeGreaterThan(sizeMult.S.cost / sizeMult.S.capacity)
    expect(blockSpecs.service.capacity).toBe(400)
  })
})

describe('cache', () => {
  const base = graph(
    [node('c', 'client'), node('svc', 'service', { instances: 10 }), node('pg', 'postgres')],
    [['c', 'svc'], ['svc', 'pg']],
  )
  const cached = graph(
    [...base.nodes, node('r', 'redis', { hitRatio: 0.8 })],
    [...base.edges.map((e) => [e.source, e.target] as [string, string]), ['svc', 'r']],
  )
  it('redis reduces postgres load and p99', () => {
    const a = run(base, L(2400, 100)).result
    const b = run(cached, L(2400, 100)).result
    expect(a.nodes.pg.rps).toBeCloseTo(2500)
    expect(b.nodes.pg.rps).toBeCloseTo(0.2 * 2400 + 100)
    expect(b.nodes.pg.rps).toBeLessThan(a.nodes.pg.rps / 3)
    expect(b.p99Ms).toBeLessThan(a.p99Ms)
    expect(b.costPerMonth).toBeGreaterThan(a.costPerMonth)
  })

  it('cacheFlush spikes the DB and then recovers', () => {
    const sc = scenario(cached, L(2800, 100), [{ at: 2, kind: 'cacheFlush', target: 'redis', duration: 5, message: 'flush' }])
    let st = createState(cached)
    const pgRps: number[] = []
    for (let i = 0; i < 9; i++) {
      const r = step(cached, st, { scenario: sc })
      pgRps.push(r.result.nodes.pg.rps)
      st = r.state
    }
    expect(pgRps[2]).toBeGreaterThan(pgRps[1] * 4) // hit ratio = 0 -> всё в БД
    expect(pgRps[3]).toBeLessThan(pgRps[2]) // линейное восстановление
    expect(pgRps[8]).toBeCloseTo(pgRps[1])
  })
})

describe('read replica', () => {
  const single = graph(
    [node('c', 'client'), node('svc', 'service', { instances: 10 }), node('pg', 'postgres')],
    [['c', 'svc'], ['svc', 'pg']],
  )
  const withReplica = graph(
    [...single.nodes, node('rep', 'replica')],
    [['c', 'svc'], ['svc', 'pg'], ['svc', 'rep']],
  )
  it('splits reads between primary and replica', () => {
    const a = run(single, L(3500, 100)).result
    const b = run(withReplica, L(3500, 100)).result
    expect(a.nodes.pg.status).toBe('overloaded')
    expect(b.nodes.pg.rps).toBeCloseTo(1750 + 100)
    expect(b.nodes.rep.rps).toBeCloseTo(1750)
    expect(b.nodes.pg.errorRate).toBe(0)
    expect(b.errorRate).toBeLessThan(a.errorRate)
  })
  it('replication lag grows only when the replica is overloaded', () => {
    const g = graph(
      [node('c', 'client'), node('svc', 'service', { instances: 50 }), node('pg', 'postgres', { size: 'XL' }), node('rep', 'replica')],
      [['c', 'svc'], ['svc', 'pg'], ['svc', 'rep']],
    )
    const calm = run(g, L(1000, 10), 3).result
    expect(calm.nodes.rep.lagSec).toBe(0)
    const hot = run(g, L(12000, 10), 3).result
    expect(hot.nodes.rep.lagSec).toBeGreaterThan(0)
  })
})

describe('queue', () => {
  const g = graph(
    [node('c', 'client'), node('svc', 'service', { instances: 10 }), node('q', 'queue'), node('w', 'worker', { instances: 5 }), node('pg', 'postgres')],
    [['c', 'svc'], ['svc', 'q'], ['q', 'w'], ['w', 'pg']],
  )
  const direct = graph(
    [node('c', 'client'), node('svc', 'service', { instances: 10 }), node('pg', 'postgres')],
    [['c', 'svc'], ['svc', 'pg']],
  )
  it('absorbs a write spike, builds backlog, then drains', () => {
    // Всплеск 3000 write/s при ёмкости воркеров 1000 msg/s.
    const spike = run(g, L(0, 3000), 8)
    expect(spike.result.errorRate).toBe(0)
    expect(spike.result.nodes.pg.rps).toBeLessThanOrEqual(1000.001)
    expect(spike.result.nodes.q.backlog).toBeGreaterThan(0)
    expect(spike.result.nodes.q.status).toBe('hot')
    // Без очереди та же запись валит Postgres.
    expect(run(direct, L(0, 3500)).result.nodes.pg.status).toBe('overloaded')
    // Нагрузка спала — очередь разбирается.
    const calm = run(g, L(0, 100), 20, spike.state)
    expect(calm.result.nodes.q.backlog).toBe(0)
    expect(calm.result.nodes.q.lagSec).toBe(0)
  })
})

describe('overload and rate limit', () => {
  it('overloaded service produces errors', () => {
    const g = graph([node('c', 'client'), node('svc', 'service')], [['c', 'svc']])
    const r = run(g, L(800)).result
    expect(r.nodes.svc.status).toBe('overloaded')
    expect(r.nodes.svc.errorRate).toBeCloseTo(0.5)
    expect(r.errorRate).toBeCloseTo(0.5)
    expect(r.p99Ms).toBeGreaterThan(1000)
  })
  it('gateway rate limit rejects excess and protects downstream', () => {
    const g = graph(
      [node('c', 'client'), node('gw', 'gateway', { rateLimit: 1000 }), node('svc', 'service', { instances: 5 })],
      [['c', 'gw'], ['gw', 'svc']],
    )
    const r = run(g, L(2000)).result
    expect(r.nodes.gw.errorRate).toBeCloseTo(0.5)
    expect(r.nodes.svc.rps).toBeCloseTo(1000)
    expect(r.nodes.svc.status).not.toBe('overloaded')
    expect(r.errorRate).toBeCloseTo(0.5)
  })
})

describe('failures', () => {
  const two = graph([node('c', 'client'), node('svc', 'service', { instances: 2 })], [['c', 'svc']])
  const one = graph([node('c', 'client'), node('svc', 'service')], [['c', 'svc']])
  const drive = (g: SimGraph, ev: ScenarioEvent, load: Load) => {
    const sc = scenario(g, load, [ev])
    let st = createState(g)
    const out: TickResult[] = []
    for (let i = 0; i < 4; i++) {
      const r = step(g, st, { scenario: sc })
      out.push(r.result)
      st = r.state
    }
    return out
  }
  it('killOne with 2 instances degrades but survives', () => {
    const [, before, after] = drive(two, { at: 2, kind: 'killOne', target: 'service', message: 'x' }, L(300))
    expect(after.nodes.svc.capacity).toBe(before.nodes.svc.capacity / 2)
    expect(after.errorRate).toBe(0)
    expect(after.p99Ms).toBeGreaterThan(before.p99Ms)
  })
  it('kill / killOne with a single instance means errors', () => {
    const [, before, afterKill] = drive(one, { at: 2, kind: 'kill', target: 'svc', message: 'x' }, L(100))
    expect(before.errorRate).toBe(0)
    expect(afterKill.errorRate).toBe(1)
    expect(afterKill.nodes.svc.status).toBe('down')
    const [, , afterOne] = drive(one, { at: 2, kind: 'killOne', target: 'service', message: 'x' }, L(100))
    expect(afterOne.errorRate).toBe(1)
  })
  it('tracks health from violated minutes (sandbox always 100)', () => {
    const sc = scenario(one, L(800))
    const { result, state } = step(one, createState(one), { scenario: sc })
    expect(result.sloViolated).toBe(true)
    expect(result.health).toBeCloseTo(90)
    expect(state.violatedMinutes).toBe(1)
    const sb = run(one, L(800)).result
    expect(sb.sloViolated).toBe(false)
    expect(sb.health).toBe(100)
  })
})

describe('warmup and determinism', () => {
  it('new instances do not add capacity until warmup passes', () => {
    const g1 = graph([node('c', 'client'), node('svc', 'service')], [['c', 'svc']])
    const g2 = graph([node('c', 'client'), node('svc', 'service', { instances: 3 })], [['c', 'svc']])
    let st = onGraphChange(g1, g2, createState(g1))
    const caps: number[] = []
    for (let i = 0; i < 4; i++) {
      const r = step(g2, st, { manualLoad: L(100) })
      caps.push(r.result.nodes.svc.capacity)
      st = r.state
    }
    expect(caps).toEqual([400, 400, 1200, 1200]) // warmupTicks = 2
  })
  it('is deterministic', () => {
    const g = graph([node('c', 'client'), node('svc', 'service')], [['c', 'svc']])
    expect(run(g, L(300, 20), 5).result).toEqual(run(g, L(300, 20), 5).result)
  })
  it('survives cycles', () => {
    const g = graph([node('c', 'client'), node('a', 'service'), node('b', 'service')], [['c', 'a'], ['a', 'b'], ['b', 'a']])
    expect(() => run(g, L(100))).not.toThrow()
  })
})

describe('staticAnalysis', () => {
  it('finds SPOFs and cost', () => {
    const g = graph(
      [node('c', 'client'), node('svc', 'service'), node('pg', 'postgres', { size: 'M' })],
      [['c', 'svc'], ['svc', 'pg']],
    )
    const a = staticAnalysis(g)
    expect(a.costPerMonth).toBeCloseTo(60 + 200 * 2.2)
    expect(a.spofs.sort()).toEqual(['pg', 'svc'])
    expect(a.warnings).toContain('Сервис «svc» ходит в Postgres без кэша')
  })
  it('redundancy removes SPOFs; warns about missing LB and workers', () => {
    const redundant = graph(
      [node('c', 'client'), node('lb', 'lb', { instances: 2 }), node('svc', 'service', { instances: 3 }), node('pg', 'postgres'), node('rep', 'replica')],
      [['c', 'lb'], ['lb', 'svc'], ['svc', 'pg'], ['svc', 'rep']],
    )
    expect(staticAnalysis(redundant).spofs).toEqual([])
    const bad = graph(
      [node('c', 'client'), node('svc', 'service', { instances: 3 }), node('k', 'kafka')],
      [['c', 'svc'], ['svc', 'k']],
    )
    const w = staticAnalysis(bad).warnings
    expect(w.some((x) => x.startsWith('Нет балансировщика перед 3 инстансами'))).toBe(true)
    expect(w).toContain('Kafka без воркеров — сообщения копятся')
  })
})

describe('failover', () => {
  const g = graph(
    [node('c', 'client'), node('svc', 'service', { instances: 5 }), node('pg', 'postgres'), node('rep', 'replica')],
    [['c', 'svc'], ['svc', 'pg'], ['pg', 'rep']],
  )
  it('replica is promoted one tick after primary dies', () => {
    const sc = scenario(g, L(800, 100), [{ at: 1, kind: 'kill', target: 'pg', duration: 10, message: 'kill' }])
    const errs: number[] = []
    let st = createState(g)
    for (let i = 0; i < 4; i++) {
      const r = step(g, st, { scenario: sc })
      errs.push(r.result.errorRate)
      st = r.state
    }
    expect(errs[1]).toBeGreaterThan(0.5) // primary down, failover in progress
    expect(errs[3]).toBeLessThan(0.01) // replica promoted
  })
  it('without replica the outage lasts', () => {
    const solo = graph([node('c', 'client'), node('svc', 'service', { instances: 5 }), node('pg', 'postgres')], [['c', 'svc'], ['svc', 'pg']])
    const sc = scenario(solo, L(800, 100), [{ at: 1, kind: 'kill', target: 'pg', duration: 10, message: 'kill' }])
    let st = createState(solo)
    let r!: TickResult
    for (let i = 0; i < 4; i++) ({ result: r, state: st } = step(solo, st, { scenario: sc }))
    expect(r.errorRate).toBeGreaterThan(0.9)
  })
})

describe('ddos', () => {
  it('rate limit drops bots first, real users stay mostly fine', () => {
    const g = graph(
      [node('c', 'client'), node('gw', 'gateway', { rateLimit: 2000, instances: 2 }), node('svc', 'service', { instances: 6 }), node('pg', 'postgres')],
      [['c', 'gw'], ['gw', 'svc'], ['svc', 'pg']],
    )
    const sc = scenario(g, L(1000, 100), [{ at: 0, kind: 'ddos', value: 20000, duration: 5, message: 'ddos' }])
    const r = step(g, createState(g), { scenario: sc }).result
    expect(r.nodes.gw.errorRate).toBeGreaterThan(0.9) // drops most of the flood
    expect(r.errorRate).toBeLessThan(0.01) // users don't feel it
    expect(r.nodes.svc.rps).toBeLessThanOrEqual(2000.01)
  })
})

describe('knobs', () => {
  const fx = (target: string, value: number): ScenarioEvent => ({ at: 0, kind: 'slow', target, value, message: 'slow' })

  it('retry storm: retries multiply downstream load and its errors under saturation', () => {
    const mk = (retries: number) =>
      graph(
        [node('c', 'client'), node('svc', 'service', { instances: 10, knobs: { retries, threads: 2000, timeoutMs: 10000 } }), node('ext', 'external')],
        [['c', 'svc'], ['svc', 'ext']],
      )
    const a = run(mk(0), L(0, 1300), 8).result
    const b = run(mk(3), L(0, 1300), 8).result
    expect(a.nodes.ext.utilization).toBeGreaterThan(1) // внешний API уже насыщен
    expect(b.nodes.ext.rps).toBeGreaterThan(a.nodes.ext.rps * 1.5)
    expect(b.nodes.ext.errorRate).toBeGreaterThan(a.nodes.ext.errorRate)
  })

  it('slow external + long timeout collapses the service; short timeout keeps it alive', () => {
    const mk = (timeoutMs: number) => {
      const g = graph(
        [node('c', 'client'), node('svc', 'service', { instances: 2, knobs: { timeoutMs } }), node('ext', 'external'), node('pg', 'postgres')],
        [['c', 'svc'], ['svc', 'ext'], ['svc', 'pg']],
      )
      return { g, sc: scenario(g, L(100, 300), [fx('ext', 100)]) }
    }
    const go = (timeoutMs: number) => {
      const { g, sc } = mk(timeoutMs)
      let st = createState(g)
      let r!: TickResult
      for (let i = 0; i < 6; i++) ({ result: r, state: st } = step(g, st, { scenario: sc }))
      return r
    }
    const long = go(30000)
    const short = go(1000)
    expect(long.nodes.svc.utilization).toBeGreaterThan(1)
    expect(long.nodes.svc.capacity).toBeLessThan(short.nodes.svc.capacity)
    expect(short.nodes.svc.utilization).toBeLessThan(1)
    expect(short.nodes.svc.errorRate).toBeGreaterThan(0) // ошибки только на пути во внешний API
    expect(short.nodes.pg.errorRate).toBe(0)
    expect(long.errorRate).toBeGreaterThan(short.errorRate)
  })

  it('missing index overloads postgres', () => {
    const mk = (indexed: boolean) =>
      graph([node('c', 'client'), node('svc', 'service', { instances: 10 }), node('pg', 'postgres', { knobs: { indexed } })], [['c', 'svc'], ['svc', 'pg']])
    const ok = run(mk(true), L(1000, 0)).result
    const bad = run(mk(false), L(1000, 0)).result
    expect(ok.nodes.pg.status).not.toBe('overloaded')
    expect(bad.nodes.pg.status).toBe('overloaded')
    expect(bad.nodes.pg.errorRate).toBeGreaterThan(0.5)
  })

  it('pool sum above max_connections causes errors; smaller dbPool fixes it', () => {
    const mk = (dbPool: number) =>
      graph([node('c', 'client'), node('svc', 'service', { instances: 10, knobs: { dbPool } }), node('pg', 'postgres', { knobs: { maxConnections: 100 } })], [['c', 'svc'], ['svc', 'pg']])
    const bad = run(mk(20), L(500, 50), 3).result // 200 соединений > 100
    const fixed = run(mk(8), L(500, 50), 3).result // 80 соединений
    expect(bad.nodes.pg.errorRate).toBeCloseTo(0.5)
    expect(bad.errorRate).toBeGreaterThan(0.4)
    expect(fixed.nodes.pg.errorRate).toBe(0)
    expect(fixed.errorRate).toBe(0)
  })

  it('kafka partitions cap consumers: 3 partitions with 6 workers drain at half rate', () => {
    const mk = (partitions: number) =>
      graph([node('c', 'client'), node('svc', 'service', { instances: 5 }), node('k', 'kafka', { knobs: { partitions } }), node('w', 'worker', { instances: 6 })], [['c', 'svc'], ['svc', 'k'], ['k', 'w']])
    const full = run(mk(12), L(0, 1000), 1).result
    const half = run(mk(3), L(0, 1000), 1).result
    expect(full.nodes.w.rps).toBeCloseTo(1000) // 6×200 = 1200 ≥ 1000
    expect(half.nodes.w.rps).toBeCloseTo(600) // 3 консьюмера × 200
    expect(half.nodes.k.backlog).toBeGreaterThan(full.nodes.k.backlog ?? 0)
  })

  it('ttl 0 on redis sends all reads to the DB; lower ttl lowers hit ratio', () => {
    const mk = (ttlSec?: number) =>
      graph(
        [node('c', 'client'), node('svc', 'service', { instances: 10 }), node('r', 'redis', { hitRatio: 0.8, knobs: { ttlSec } }), node('pg', 'postgres')],
        [['c', 'svc'], ['svc', 'r'], ['svc', 'pg']],
      )
    // svc → redis и svc → pg: промахи redis без своих детей-БД идут в pg
    const def = run(mk(), L(1000, 0)).result
    const off = run(mk(0), L(1000, 0)).result
    const short = run(mk(10), L(1000, 0)).result
    expect(def.nodes.pg.rps).toBeCloseTo(0.2 * 1000 / 1)
    expect(off.nodes.pg.rps).toBeCloseTo(1000)
    expect(short.nodes.pg.rps).toBeGreaterThan(def.nodes.pg.rps)
    expect(short.nodes.pg.rps).toBeLessThan(off.nodes.pg.rps)
  })

  it('noeviction halves the hit ratio; lb proxy cache absorbs static', () => {
    const g = (policy: 'noeviction' | 'allkeys-lru') =>
      graph([node('c', 'client'), node('svc', 'service', { instances: 10 }), node('r', 'redis', { hitRatio: 0.8, knobs: { evictionPolicy: policy } }), node('pg', 'postgres')], [['c', 'svc'], ['svc', 'r'], ['svc', 'pg']])
    expect(run(g('noeviction'), L(1000, 0)).result.nodes.pg.rps).toBeCloseTo(600)
    const lb = (ttlSec?: number) => graph([node('c', 'client'), node('lb', 'lb', { knobs: { ttlSec } }), node('svc', 'service', { instances: 10 })], [['c', 'lb'], ['lb', 'svc']])
    const off = run(lb(), L(0, 0, 1000)).result
    const on = run(lb(300), L(0, 0, 1000)).result
    expect(off.nodes.svc.rps).toBeCloseTo(1000)
    expect(on.nodes.svc.rps).toBeLessThan(200)
  })
})

/** Прогон сценария N тиков, возвращает все результаты. */
function runScenario(g: SimGraph, sc: Scenario, ticks: number): TickResult[] {
  let st = createState(g)
  const out: TickResult[] = []
  for (let i = 0; i < ticks; i++) {
    const r = step(g, st, { scenario: sc })
    out.push(r.result)
    st = r.state
  }
  return out
}

describe('autoscaler, rebalance, stall, zones', () => {
  const consumers = (wk: Partial<SimNodeConfig> = {}, kk: SimNodeConfig['knobs'] = undefined) =>
    graph(
      [node('c', 'client'), node('k', 'kafka', { knobs: kk }), node('w', 'worker', { instances: 2, ...wk }), node('ext', 'external')],
      [['c', 'k'], ['k', 'w'], ['w', 'ext']],
    )

  it('CPU autoscale under-reacts for I/O-bound consumers, queue autoscale keeps lag low', () => {
    const sc = (g: SimGraph) => scenario(g, L(0, 800, 0))
    const cpu = consumers({ knobs: { autoscale: 'cpu', autoscaleMax: 10 } })
    const queue = consumers({ knobs: { autoscale: 'queue', autoscaleMax: 10 } })
    const a = runScenario(cpu, sc(cpu), 30)
    const b = runScenario(queue, sc(queue), 30)
    expect(a[29].nodes.w.instances).toBe(2)
    expect(b[29].nodes.w.instances).toBeGreaterThan(4)
    expect(a[29].nodes.k.lagSec ?? 0).toBeGreaterThan(300)
    expect(b[29].nodes.k.lagSec ?? 0).toBeLessThan(30)
    expect(b[29].costPerMonth).toBeGreaterThan(a[29].costPerMonth)
  })

  it('absent autoscale knob leaves instances unreported and cost unchanged', () => {
    const r = run(consumers(), L(0, 100, 0)).result
    expect(r.nodes.w.instances).toBeUndefined()
    expect(r.nodes.w.costPerMonth).toBe(2 * blockSpecs.worker.cost)
  })

  it('eager rebalance with restartLoop and 100 consumers drains far less than cooperative', () => {
    const mk = (rebalance: 'eager' | 'cooperative') =>
      graph(
        [
          node('c', 'client'), node('k', 'kafka', { knobs: { partitions: 100 } }),
          node('w1', 'worker', { instances: 50, knobs: { rebalance } }), node('w2', 'worker', { instances: 50, knobs: { rebalance } }),
        ],
        [['c', 'k'], ['k', 'w1'], ['k', 'w2']],
      )
    const ev: ScenarioEvent[] = [{ at: 3, kind: 'restartLoop', target: 'w1', value: 2, duration: 40, message: 'leak' }]
    const drain = (rs: TickResult[]) => rs.reduce((a, r) => a + r.nodes.w1.rps + r.nodes.w2.rps, 0)
    const eg = mk('eager'), co = mk('cooperative')
    const e = runScenario(eg, scenario(eg, L(0, 10000, 0), ev), 30)
    const c = runScenario(co, scenario(co, L(0, 10000, 0), ev), 30)
    expect(e[10].nodes.w1.paused).toBe(true)
    expect(c[10].nodes.w1.paused).toBeUndefined()
    expect(drain(e)).toBeLessThan(drain(c) * 0.5)
    expect(e[29].nodes.k.lagSec ?? 0).toBeGreaterThan(c[29].nodes.k.lagSec ?? 0)
  })

  it('stall keeps status ok but lag grows', () => {
    const g = consumers({ instances: 3 })
    const sc = scenario(g, L(0, 200, 0), [{ at: 3, kind: 'stall', target: 'w', duration: 10, message: 'stall' }])
    const rs = runScenario(g, sc, 12)
    expect(rs[2].nodes.k.lagSec ?? 0).toBe(0)
    expect(rs[8].nodes.w.status).toBe('ok')
    expect(rs[8].nodes.w.paused).toBeUndefined()
    expect(rs[8].nodes.w.rps).toBe(0)
    expect(rs[8].nodes.k.backlog ?? 0).toBeGreaterThan(rs[5].nodes.k.backlog ?? 0)
    expect(rs[8].nodes.k.lagSec ?? 0).toBeGreaterThan(60)
  })

  it('offsetReset latest loses messages after a long stall, earliest loses none', () => {
    const ev: ScenarioEvent[] = [{ at: 2, kind: 'stall', target: 'w', duration: 40, message: 'stall' }]
    const total = (g: SimGraph) => {
      const sc = { ...scenario(g, L(0, 100, 0), ev), slo: { p99Ms: 5000, errorRate: 1, maxLost: 1000 } }
      const rs = runScenario(g, sc, 60)
      return { lost: rs.reduce((a, r) => a + (r.lost ?? 0), 0), viol: rs[59].sloViolated }
    }
    const latest = total(consumers({}, { offsetReset: 'latest' }))
    const earliest = total(consumers({}, { offsetReset: 'earliest' }))
    expect(latest.lost).toBeGreaterThan(100000)
    expect(latest.viol).toBe(true)
    expect(earliest.lost).toBe(0)
    expect(earliest.viol).toBe(false)
  })

  it('zoneDown kills same-zone replica; failover works only cross-zone', () => {
    const mk = (repZone: string) =>
      graph(
        [node('c', 'client'), node('pg', 'postgres'), node('rep', 'replica', { zone: repZone })],
        [['c', 'pg'], ['pg', 'rep']],
      )
    const ev: ScenarioEvent[] = [{ at: 2, kind: 'zoneDown', target: 'a', duration: 10, message: 'zone a down' }]
    const same = mk('a'), other = mk('b')
    const a = runScenario(same, scenario(same, L(0, 100, 0), ev), 8)
    const b = runScenario(other, scenario(other, L(0, 100, 0), ev), 8)
    expect(a[2].nodes.rep.status).toBe('down')
    expect(a[6].nodes.pg.status).toBe('down')
    expect(a[6].errorRate).toBeGreaterThan(0.9)
    expect(b[2].nodes.rep.status).not.toBe('down')
    expect(b[6].errorRate).toBe(0)
  })

  it('lb skips down children (zone failover through a second service)', () => {
    const g = graph(
      [node('c', 'client'), node('lb', 'lb', { zone: 'edge' }), node('s1', 'service', { zone: 'a' }), node('s2', 'service', { zone: 'b' })],
      [['c', 'lb'], ['lb', 's1'], ['lb', 's2']],
    )
    const sc = scenario(g, L(200, 0, 0), [{ at: 2, kind: 'zoneDown', target: 'a', duration: 5, message: 'zone a' }])
    const rs = runScenario(g, sc, 5)
    expect(rs[1].nodes.s1.rps).toBeCloseTo(100)
    expect(rs[3].nodes.s1.status).toBe('down')
    expect(rs[3].nodes.s1.rps).toBe(0)
    expect(rs[3].nodes.s2.rps).toBeCloseTo(200)
    expect(rs[3].errorRate).toBe(0)
  })
})
