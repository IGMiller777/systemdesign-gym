/**
 * Детерминированная математическая модель системы (без случайности).
 *
 * Идея модели:
 *  - Нагрузка делится на три класса: read, write, static (rps).
 *  - Граф обходится в топологическом порядке от client-узлов. Каждый узел получает
 *    нагрузку от родителей, считает свою загрузку ρ = нагрузка / ёмкость,
 *    латентность и долю ошибок, и раздаёт нагрузку детям.
 *  - Латентность узла растёт как 1/(1-ρ) (очередь M/M/1), при ρ ≥ 1 запросы
 *    упираются в таймаут, а доля ошибок = 1 - 1/ρ (лишнее отбрасывается).
 *  - Сквозной p99 считается по синхронным путям: сумма латентностей по дереву
 *    вызовов с учётом долей трафика (cache hit => ниже по цепочке доходит меньше).
 *  - Добавление блока что-то улучшает (латентность, ёмкость, отказоустойчивость),
 *    но всегда добавляет стоимость и сложность.
 */
import type { BlockType } from '../tasks/types'
import type {
  BlockSpec,
  Load,
  NodeMetrics,
  NodeSize,
  NodeStatus,
  Scenario,
  SimGraph,
  SimNodeConfig,
  SimState,
  TickResult,
} from './types'
import { baseOf, baseType } from './flavors'
import { knobDefaults, knobsOf } from './knobs'

// ───────────────────────── Справочники ─────────────────────────

/** Эффект вертикального масштабирования: ёмкость растёт медленнее, чем цена вперёд (убывающая отдача). */
export const sizeMult: Record<NodeSize, { capacity: number; cost: number }> = {
  S: { capacity: 1, cost: 1 },
  M: { capacity: 2, cost: 2.2 },
  L: { capacity: 4, cost: 5 },
  XL: { capacity: 8, cost: 11 },
}

/** Порядки величин для одного S-инстанса. */
export const blockSpecs: Record<BlockType, BlockSpec> = {
  client: {
    capacity: 1e9, baseLatencyMs: 0, cost: 0, scaling: 'none', maxInstances: 1, warmupTicks: 0,
    modelNote: 'Источник трафика: пользователи и их приложения, ничего не стоит.',
  },
  cdn: {
    capacity: 1e7, baseLatencyMs: 15, cost: 100, scaling: 'none', maxInstances: 1, warmupTicks: 0,
    modelNote: 'Огромная ёмкость; отдаёт статику с hit ratio ~90% и лишь ~30% от него для кэшируемых GET.',
  },
  lb: {
    capacity: 50000, baseLatencyMs: 1, cost: 40, scaling: 'horizontal', maxInstances: 4, warmupTicks: 1,
    modelNote: 'Разносит трафик поровну по детям; один инстанс — единая точка отказа.',
  },
  gateway: {
    capacity: 20000, baseLatencyMs: 2, cost: 60, scaling: 'horizontal', maxInstances: 6, warmupTicks: 1,
    modelNote: 'Как балансировщик + rate limit: лишнее отбрасывается (429) и не доходит до backend.',
  },
  service: {
    capacity: 400, baseLatencyMs: 20, cost: 60, scaling: 'horizontal', maxInstances: 50, warmupTicks: 2,
    modelNote: 'Stateless-сервис ~400 rps на инстанс; статику отдаёт дорого (3× нагрузки), если нет S3.',
  },
  worker: {
    capacity: 200, baseLatencyMs: 25, cost: 50, scaling: 'horizontal', maxInstances: 50, warmupTicks: 2,
    modelNote: 'Читает сообщения из очереди (~200 msg/s на инстанс) и пишет в БД.',
  },
  postgres: {
    capacity: 3000, baseLatencyMs: 3, cost: 200, scaling: 'vertical', maxInstances: 1, warmupTicks: 5,
    modelNote: 'Один лидер на запись, растёт только вертикально; чтения можно разгрузить репликами и кэшем.',
  },
  replica: {
    capacity: 4000, baseLatencyMs: 3, cost: 200, scaling: 'horizontal', maxInstances: 5, warmupTicks: 6,
    modelNote: 'Read-реплика: берёт долю чтений, но тратит ~30% от записей на применение репликации.',
  },
  redis: {
    capacity: 80000, baseLatencyMs: 0.5, cost: 80, scaling: 'horizontal', maxInstances: 6, warmupTicks: 1,
    modelNote: 'Кэш в памяти: ~80k ops/s, hit ratio по умолчанию 80%, промахи идут в БД.',
  },
  queue: {
    capacity: 20000, baseLatencyMs: 2, cost: 100, scaling: 'horizontal', maxInstances: 5, warmupTicks: 2,
    modelNote: 'Брокер вроде RabbitMQ: быстро принимает записи и копит backlog, пока воркеры не разберут.',
  },
  kafka: {
    capacity: 200000, baseLatencyMs: 5, cost: 300, scaling: 'horizontal', maxInstances: 9, warmupTicks: 4,
    modelNote: 'Лог событий ~200k msg/s; для надёжности нужно минимум 3 брокера.',
  },
  s3: {
    capacity: 5000, baseLatencyMs: 30, cost: 50, scaling: 'horizontal', maxInstances: 20, warmupTicks: 1,
    modelNote: 'Объектное хранилище для статики: дёшево и масштабируется, но задержка ~30 мс.',
  },
  search: {
    capacity: 1500, baseLatencyMs: 20, cost: 250, scaling: 'horizontal', maxInstances: 10, warmupTicks: 6,
    modelNote: 'Поисковый кластер: ~1500 qps, получает ~30% чтений как поисковые запросы.',
  },
  clickhouse: {
    capacity: 50000, baseLatencyMs: 50, cost: 300, scaling: 'horizontal', maxInstances: 6, warmupTicks: 6,
    modelNote: 'Аналитика: ~50k строк/с на запись (и ~100 тяжёлых запросов/с); асинхронна для пользователя.',
  },
  external: {
    capacity: 1000, baseLatencyMs: 150, cost: 0, scaling: 'none', maxInstances: 1, warmupTicks: 0,
    modelNote: 'Внешний API (например, платежи): лимит 1000 rps, ~150 мс, мы им не управляем.',
  },
  ssr: {
    capacity: 80, baseLatencyMs: 60, cost: 80, scaling: 'horizontal', maxInstances: 40, warmupTicks: 2,
    modelNote: 'Node-сервер с SSR (Next.js/Nuxt): рендер страницы съедает CPU, ~80 страниц/с на инстанс, ~60 мс TTFB.',
  },
  bff: {
    capacity: 600, baseLatencyMs: 10, cost: 50, scaling: 'horizontal', maxInstances: 30, warmupTicks: 1,
    modelNote: 'Backend for Frontend: собирает ответ для экрана из нескольких API, ~600 rps на инстанс.',
  },
  edge: {
    capacity: 1e7, baseLatencyMs: 10, cost: 150, scaling: 'none', maxInstances: 1, warmupTicks: 0,
    modelNote: 'CDN с кэшем HTML (ISR / stale-while-revalidate): кэширует не только статику, но и ~90% страниц; доля попаданий зависит от TTL.',
  },
  realtime: {
    capacity: 10000, baseLatencyMs: 5, cost: 120, scaling: 'horizontal', maxInstances: 20, warmupTicks: 1,
    modelNote: 'WebSocket/SSE-шлюз: держит соединения (~50k на инстанс) и пропускает ~10k сообщений/с; лимит соединений задаётся rate limit.',
  },
  llm: {
    capacity: 30, baseLatencyMs: 1200, cost: 0, scaling: 'none', maxInstances: 1, warmupTicks: 0, usdPer1kReq: 0.5,
    modelNote: 'Внешний LLM API: лимит ~30 запросов/с (≈1800 RPM) на тир S, ответ ~1,2 с, оплата за запрос: $0,5 за 1000. Размер = тир лимитов.',
  },
  llmgw: {
    capacity: 5000, baseLatencyMs: 3, cost: 60, scaling: 'horizontal', maxInstances: 6, warmupTicks: 1,
    modelNote: 'LLM-шлюз (LiteLLM/Portkey): rate limit, fallback на живого провайдера, учёт токенов.',
  },
  semcache: {
    capacity: 20000, baseLatencyMs: 15, cost: 120, scaling: 'horizontal', maxInstances: 6, warmupTicks: 1,
    modelNote: 'Семантический кэш: эмбеддинг запроса + поиск похожего вопроса; попадание ~30% (по умолчанию) и ответ без вызова LLM.',
  },
  vectordb: {
    capacity: 800, baseLatencyMs: 15, cost: 250, scaling: 'horizontal', maxInstances: 10, warmupTicks: 6,
    modelNote: 'Векторная БД для RAG: ~800 поисков/с на инстанс, каждый вопрос к ассистенту — один поиск.',
  },
}

export { baseOf, baseType }

const normCache = new WeakMap<SimGraph, SimGraph>()
/** Граф, где у «вкусов» type = базовый, а исходный тип лежит во flavor. */
function norm(g: SimGraph): SimGraph {
  if (!g.nodes.some((n) => baseType[n.type])) return g
  let r = normCache.get(g)
  if (!r) {
    r = { ...g, nodes: g.nodes.map((n) => (baseType[n.type] ? { ...n, type: baseType[n.type]!, flavor: n.type } : n)) }
    normCache.set(g, r)
  }
  return r
}
const specOf = (n: SimNodeConfig): BlockSpec => blockSpecs[n.flavor ?? n.type]

// ───────────────────────── Константы модели ─────────────────────────

const TIMEOUT_MS = 5000
const FOREVER = Number.MAX_SAFE_INTEGER
const FAILOVER_TICKS = 1 // минута простоя записи, пока реплика промоутится в primary
const MAX_UTIL = 99 // чтобы метрики оставались конечными числами
const SEARCH_SHARE = 0.3 // доля чтений, которые на самом деле поисковые запросы
const CDN_READ_FACTOR = 0.3 // кэшируется только часть GET
const REPLICATION_COST = 0.3 // нагрузка применения записей на реплике
const SERVICE_STATIC_COST = 3 // статика через сервис дороже обычного запроса
const P99_FACTOR = 2.5
const DEFAULT_CACHE_HIT = 0.8
const DEFAULT_CDN_HIT = 0.9
const MAX_LAG_SEC = 86400
const LB_CACHE_STATIC = 0.9 // доля статики, которую lb-прокси-кэш (nginx proxy_cache) может поглотить
const LB_CACHE_READ = 0.2 // доля чтений, которую он поглощает
const EDGE_READ_FACTOR = 0.9 // edge/ISR кэширует HTML: все GET, кроме персональных
const DEFAULT_SEMCACHE_HIT = 0.3
const SECONDS_PER_MONTH = 2_592_000
const AGENT_NORMAL_STEPS = 3 // обычная задача агента — ~3 вызова LLM
const NOEVICTION_HIT = 0.5 // redis noeviction: память забита, новые ключи не сохраняются
const FULL_SCAN_COST = 8 // чтение без индекса стоит столько «единиц» ёмкости postgres
const PG_CONN_KNEE = 300 // после стольких соединений БД замедляется (context switching)
const MAX_HIT = 0.99
/** Затухание hit ratio от TTL: ttl/(ttl+30). */
const ttlFactor = (ttl: number) => Math.max(0, ttl) / (Math.max(0, ttl) + 30)

type Cls = keyof Load
const CLASSES: Cls[] = ['read', 'write', 'static']
type NodeState = SimState['nodes'][string]

const zero = (): Load => ({ read: 0, write: 0, static: 0 })
const total = (l: Load) => l.read + l.write + l.static
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

function freshNodeState(): NodeState {
  return { deadInstances: 0, slowMult: 1, backlog: 0 }
}

/** Сколько инстансов реально считается: вертикальные/нескейлящиеся блоки — всегда 1. */
function instCount(n: SimNodeConfig): number {
  const spec = specOf(n)
  if (spec.scaling !== 'horizontal') return 1
  return clamp(Math.round(n.instances), 1, spec.maxInstances)
}

/** Автоскейлер включён (service/worker с autoscale cpu|queue). */
function autoscaled(n: SimNodeConfig): boolean {
  if (n.type !== 'service' && n.type !== 'worker') return false
  const a = knobsOf(n).autoscale
  return a === 'cpu' || a === 'queue'
}

/** Эффективное число инстансов: если ими рулит автоскейлер — autoInstances, иначе из конфига. */
function instOf(n: SimNodeConfig, ns?: NodeState): number {
  if (autoscaled(n) && ns?.autoInstances !== undefined) {
    return clamp(Math.round(ns.autoInstances), 1, specOf(n).maxInstances)
  }
  return instCount(n)
}

function nodeCost(n: SimNodeConfig, ns?: NodeState): number {
  return specOf(n).cost * sizeMult[n.size].cost * instOf(n, ns)
}

// ───────────────────────── Состояние ─────────────────────────

export function createState(graph: SimGraph): SimState {
  graph = norm(graph)
  const nodes: SimState['nodes'] = {}
  for (const n of graph.nodes) nodes[n.id] = freshNodeState()
  return { t: 0, nodes, trafficMult: 1, violatedMinutes: 0 }
}

function cloneState(s: SimState): SimState {
  const nodes: SimState['nodes'] = {}
  for (const id of Object.keys(s.nodes)) nodes[id] = { ...s.nodes[id] }
  return { ...s, nodes, ddos: s.ddos ? { ...s.ddos } : undefined }
}

/**
 * Игрок поменял граф на лету: новые инстансы, новые узлы и смена размера
 * «прогреваются» warmupTicks минут и в это время ёмкости не добавляют
 * (смена размера = рестарт: все инстансы узла прогреваются заново).
 */
export function onGraphChange(prev: SimGraph, next: SimGraph, state: SimState): SimState {
  prev = norm(prev)
  next = norm(next)
  const s = cloneState(state)
  const prevById = new Map(prev.nodes.map((n) => [n.id, n]))
  const nodes: SimState['nodes'] = {}
  for (const n of next.nodes) {
    const old = prevById.get(n.id)
    const cur = s.nodes[n.id] ? { ...s.nodes[n.id] } : freshNodeState()
    const inst = instCount(n)
    const spec = specOf(n)
    const stillWarming =
      (cur.warmingInstances ?? 0) > 0 && s.t < (cur.warmingFrom ?? 0) + spec.warmupTicks
    const warmingNow = stillWarming ? (cur.warmingInstances ?? 0) : 0
    if (!old) {
      if (spec.warmupTicks > 0 && n.type !== 'client') {
        cur.warmingFrom = s.t
        cur.warmingInstances = inst
      }
    } else if (old.size !== n.size) {
      if (spec.warmupTicks > 0) {
        cur.warmingFrom = s.t
        cur.warmingInstances = inst
      }
    } else if (instCount(old) !== inst) {
      if (inst > instCount(old) && spec.warmupTicks > 0) {
        cur.warmingFrom = s.t
        cur.warmingInstances = Math.min(inst, warmingNow + (inst - instCount(old)))
      } else {
        cur.warmingInstances = Math.min(warmingNow, inst)
      }
    }
    cur.deadInstances = Math.min(cur.deadInstances, inst)
    nodes[n.id] = cur
  }
  return { ...s, nodes }
}

// ───────────────────────── Ёмкость узла ─────────────────────────

interface CapInfo {
  inst: number
  warming: number
  killed: boolean
  /** Работающие инстансы. */
  effective: number
  capacity: number
}

function capInfo(n: SimNodeConfig, ns: NodeState | undefined, t: number): CapInfo {
  const spec = specOf(n)
  const inst = instOf(n, ns)
  const dead = Math.min(inst, ns?.deadInstances ?? 0)
  const warmActive = (ns?.warmingInstances ?? 0) > 0 && t < (ns?.warmingFrom ?? 0) + spec.warmupTicks
  const warming = warmActive ? Math.min(ns?.warmingInstances ?? 0, inst - dead) : 0
  const killed = t < (ns?.downUntil ?? 0)
  const effective = killed ? 0 : inst - dead - warming
  const div = t < (ns?.capDivUntil ?? 0) ? (ns?.capDiv ?? 1) : 1
  return {
    inst,
    warming,
    killed,
    effective,
    capacity: (spec.capacity * sizeMult[n.size].capacity * effective) / div,
  }
}

/** Латентность и ошибки узла по загрузке ρ. */
function evaluateNode(used: number, info: CapInfo, baseMs: number, slow: number) {
  if (info.killed || info.capacity <= 0) {
    // Узел недоступен: трафик в него = ошибки (таймауты).
    return used > 0
      ? { util: MAX_UTIL, latencyMs: TIMEOUT_MS, errorRate: 1 }
      : { util: 0, latencyMs: baseMs * slow, errorRate: 0 }
  }
  const rho = used / info.capacity
  if (rho < 1) {
    // Очередь: чем ближе к 100%, тем длиннее хвост (ограничено 30× от базы).
    const factor = Math.min(30, 1 / Math.max(0.05, 1 - rho))
    return { util: rho, latencyMs: baseMs * slow * factor, errorRate: 0 }
  }
  // Перегруз: часть запросов отбрасывается, остальные ждут таймаута.
  return { util: Math.min(rho, MAX_UTIL), latencyMs: TIMEOUT_MS, errorRate: 1 - 1 / rho }
}

// ───────────────────────── События сценария ─────────────────────────

function resolveTarget(graph: SimGraph, target?: string): SimNodeConfig | undefined {
  if (!target) return undefined
  return graph.nodes.find((n) => n.id === target) ?? graph.nodes.find((n) => n.type === target)
}

function applyEvents(graph: SimGraph, s: SimState, scenario: Scenario | undefined, t: number) {
  if (!scenario) return
  for (const ev of scenario.events) {
    if (ev.kind === 'zoneDown') {
      // Отказ зоны: все узлы зоны (кроме клиентов и внешних API) падают как при kill.
      if (ev.at === t) {
        const zEnd = ev.duration !== undefined ? ev.at + ev.duration : FOREVER
        for (const zn of graph.nodes) {
          if (zn.type === 'client' || zn.type === 'external') continue
          if ((zn.zone ?? 'a') !== ev.target) continue
          const zs = (s.nodes[zn.id] ??= freshNodeState())
          zs.downUntil = zEnd
          if (zn.type === 'postgres') zs.failoverAt = t + FAILOVER_TICKS
        }
      }
      continue
    }
    const node = resolveTarget(graph, ev.target)
    const ns = node ? (s.nodes[node.id] ??= freshNodeState()) : undefined
    const end = ev.duration !== undefined ? ev.at + ev.duration : FOREVER
    if (ev.at === t) {
      switch (ev.kind) {
        case 'traffic': s.trafficMult = ev.value ?? 1; break
        case 'kill':
          if (ns) {
            ns.downUntil = end
            // Patroni-подобный failover: через FAILOVER_TICKS реплика становится primary.
            if (node?.type === 'postgres') ns.failoverAt = t + FAILOVER_TICKS
          }
          break
        case 'killOne': if (ns && node) ns.deadInstances = Math.min(instCount(node), ns.deadInstances + 1); break
        case 'slow': if (ns) { ns.slowMult = ev.value ?? 2; ns.slowUntil = end } break
        case 'cacheFlush': if (ns) { ns.flushStart = t; ns.flushDuration = ev.duration ?? 10 } break
        case 'stall': if (ns) { ns.stalledUntil = end; ns.stalledSince = t } break
        case 'ddos': s.ddos = { rps: ev.value ?? 0, until: end }; break
        case 'loop': if (ns) { ns.loopSteps = ev.value ?? AGENT_NORMAL_STEPS; ns.loopUntil = end } break
        case 'enqueue': if (ns) ns.backlog += ev.value ?? 0; break
        case 'degrade': if (ns) { ns.capDiv = Math.max(1, ev.value ?? 1); ns.capDivUntil = end } break
      }
    }
    // Эффекты с duration, у которых нет «таймера» в состоянии, откатываем по времени.
    if (ev.duration !== undefined && ev.at + ev.duration === t) {
      if (ev.kind === 'traffic') s.trafficMult = 1
      if (ev.kind === 'killOne' && ns) ns.deadInstances = Math.max(0, ns.deadInstances - 1)
    }
  }
}

const REBALANCE_BASE_TICKS = 1
const REBALANCE_PER_INSTANCES = 50 // каждые 50 консьюмеров добавляют тик паузы eager-ребаланса
const LONG_STALL_TICKS = 30
const AUTOSCALE_DOWN_COOLDOWN = 3
const IO_BOUND_CPU = 0.3 // CPU I/O-bound консьюмера ≈ 30% от его загрузки (ждёт сеть)
const RETENTION_SEC = 60 * 60 // retention kafka, выраженный в секундах входящего потока

/**
 * Подготовка тика: выход из stall, рестарты (restartLoop), автоскейлер и ребаланс консьюмер-групп.
 * Использует метрики прошлого тика (как реальные HPA/KEDA).
 */
function prepareTick(graph: SimGraph, s: SimState, scenario: Scenario | undefined, t: number) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const parentsOf = (id: string) =>
    graph.edges.filter((e) => e.target === id).map((e) => byId.get(e.source)).filter((x): x is SimNodeConfig => !!x)
  const kidsOf = (id: string) =>
    graph.edges.filter((e) => e.source === id).map((e) => byId.get(e.target)).filter((x): x is SimNodeConfig => !!x)
  const warmingNow = (n: SimNodeConfig, ns: NodeState) =>
    (ns.warmingInstances ?? 0) > 0 && t < (ns.warmingFrom ?? 0) + specOf(n).warmupTicks ? (ns.warmingInstances ?? 0) : 0

  // 1) Выход из stall: после долгого простоя группа возобновляет работу (для offsetReset=latest это потеря бэклога).
  for (const n of graph.nodes) {
    const ns = s.nodes[n.id]
    if (ns.stalledUntil !== undefined && ns.stalledUntil !== FOREVER && t >= ns.stalledUntil) {
      if (ns.stalledUntil - (ns.stalledSince ?? ns.stalledUntil) > LONG_STALL_TICKS) ns.resumedAt = t
      delete ns.stalledUntil
      delete ns.stalledSince
    }
  }

  // 2) restartLoop: раз в `value` тиков один инстанс воркера перезапускается (прогрев + смена состава группы).
  const flagged = new Set<string>()
  for (const ev of scenario?.events ?? []) {
    if (ev.kind !== 'restartLoop') continue
    const node = resolveTarget(graph, ev.target)
    if (!node) continue
    const end = ev.duration !== undefined ? ev.at + ev.duration : FOREVER
    const period = Math.max(1, Math.round(ev.value ?? 5))
    if (t < ev.at || t >= end || (t - ev.at) % period !== 0) continue
    const ns = s.nodes[node.id]
    const inst = instOf(node, ns)
    if (specOf(node).warmupTicks > 0) {
      ns.warmingFrom = t
      ns.warmingInstances = Math.min(inst, warmingNow(node, ns) + 1)
    }
    flagged.add(node.id)
  }

  // 3) Автоскейлер.
  for (const n of graph.nodes) {
    const ns = s.nodes[n.id]
    if (!autoscaled(n)) { delete ns.autoInstances; continue }
    const kn = knobsOf(n)
    const min = instCount(n)
    const max = clamp(Math.round(kn.autoscaleMax ?? 10), min, specOf(n).maxInstances)
    let cur = clamp(ns.autoInstances ?? min, min, max)
    if (ns.prevUtil !== undefined) {
      let up = false, down = false
      const queueParent = kn.autoscale === 'queue' ? parentsOf(n.id).find((p) => p.type === 'queue' || p.type === 'kafka') : undefined
      if (queueParent) {
        const lag = s.nodes[queueParent.id]?.prevLagSec ?? 0
        up = lag > 30
        down = lag < 5 && ns.prevUtil < 0.4
      } else {
        // I/O-bound (ждёт внешний API) почти не грузит CPU: CPU-метрика недооценивает реальную загрузку.
        const ioBound = kidsOf(n.id).some((k) => k.type === 'external')
        const cpu = ns.prevUtil * (ioBound ? IO_BOUND_CPU : 1)
        up = cpu > 0.7
        down = cpu < 0.25
      }
      if (up && cur < max) {
        cur += 1
        ns.warmingFrom = t
        ns.warmingInstances = Math.min(cur, warmingNow(n, ns) + 1)
        ns.lastScaleAt = t
      } else if (down && cur > min && t - (ns.lastScaleAt ?? -99) >= AUTOSCALE_DOWN_COOLDOWN) {
        cur -= 1
        ns.warmingInstances = Math.min(warmingNow(n, ns), cur)
        ns.lastScaleAt = t
      }
    }
    ns.autoInstances = cur
  }

  // 4) Смена состава консьюмер-группы kafka → ребаланс.
  const members = (n: SimNodeConfig) => n.type === 'worker' && parentsOf(n.id).some((p) => p.type === 'kafka')
  for (const n of graph.nodes) {
    if (!members(n)) continue
    const ns = s.nodes[n.id]
    const m = instOf(n, ns)
    if (ns.lastMembers === undefined ? t > 0 : ns.lastMembers !== m) flagged.add(n.id)
    ns.lastMembers = m
  }
  for (const k of graph.nodes) {
    if (k.type !== 'kafka') continue
    const group = kidsOf(k.id).filter((c) => c.type === 'worker')
    if (!group.some((c) => flagged.has(c.id))) continue
    // eager (stop-the-world): встаёт вся группа, чем она больше, тем дольше. cooperative: паузы нет.
    if (!group.some((c) => (knobsOf(c).rebalance ?? 'eager') === 'eager')) continue
    const total = group.reduce((a, c) => a + instOf(c, s.nodes[c.id]), 0)
    const pause = REBALANCE_BASE_TICKS + Math.floor(total / REBALANCE_PER_INSTANCES)
    for (const c of group) s.nodes[c.id].pausedUntil = Math.max(s.nodes[c.id].pausedUntil ?? 0, t + pause)
  }
}

function trafficCurve(scenario: Scenario, t: number): number {
  const pts = [...(scenario.trafficCurve ?? [])].sort((a, b) => a.at - b.at)
  if (pts.length === 0) return 1
  if (t <= pts[0].at) return pts[0].mult
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].at) {
      const a = pts[i - 1], b = pts[i]
      return a.mult + ((b.mult - a.mult) * (t - a.at)) / (b.at - a.at || 1)
    }
  }
  return pts[pts.length - 1].mult
}

/** Эффективный hit ratio кэша с учётом cacheFlush: с нуля линейно до настроенного. */
function effectiveHit(n: SimNodeConfig, ns: NodeState | undefined, t: number): number {
  let base = n.hitRatio ?? (n.type === 'cdn' ? DEFAULT_CDN_HIT : n.flavor === 'semcache' ? DEFAULT_SEMCACHE_HIT : DEFAULT_CACHE_HIT)
  if (n.type === 'redis' || n.type === 'cdn') {
    // Крутилки: TTL (нормирован так, что дефолтный TTL даёт настроенный hitRatio) и политика вытеснения.
    const kn = knobsOf(n)
    const defTtl = knobDefaults(n.type).ttlSec ?? 300
    const ttl = kn.ttlSec ?? defTtl
    let changed = false
    if (ttl !== defTtl) {
      base = (base * ttlFactor(ttl)) / ttlFactor(defTtl)
      changed = true
    }
    if (n.type === 'redis' && kn.evictionPolicy === 'noeviction') {
      base *= NOEVICTION_HIT
      changed = true
    }
    if (changed) base = clamp(base, 0, MAX_HIT)
  }
  if (ns?.flushStart !== undefined && ns.flushDuration !== undefined) {
    const k = (t - ns.flushStart) / Math.max(1, ns.flushDuration)
    if (k >= 0 && k < 1) return base * k
  }
  return base
}

// ───────────────────────── Топология ─────────────────────────

interface Route {
  to: string
  /** Доля входящего трафика каждого класса, идущая этому ребёнку. */
  f: Load
  /** Синхронный вызов (пользователь ждёт) или асинхронный. */
  sync: boolean
  /** Абсолютная нагрузка (очередь → воркеры). */
  abs?: Load
  /** Сложить все классы в write (события в аналитику). */
  toWrite?: boolean
  /** Вызов из service/worker: доля трафика узла, идущая этим путём. */
  w?: number
  /** Таймаут вызова, мс. */
  timeoutMs?: number
  /** Ретраи на этом пути. */
  retries?: number
  /** Доля вызовов, обрываемых по таймауту (латентность ребёнка > timeout). */
  tfail?: number
  /** Множитель нагрузки от ретраев: 1 + e + e² + … + e^retries. */
  mult?: number
  /** Доля вызовов, не получивших соединение из пула (pool exhaustion). */
  poolFail?: number
}

interface Topology {
  order: string[]
  kids: Map<string, SimNodeConfig[]>
  byId: Map<string, SimNodeConfig>
}

/** Реплика → её primary: родитель-postgres, иначе postgres-«сосед» по родителю, иначе первый. */
function primaryOf(graph: SimGraph, replica: SimNodeConfig, byId: Map<string, SimNodeConfig>) {
  const parents = graph.edges.filter((e) => e.target === replica.id).map((e) => e.source)
  const direct = parents.map((p) => byId.get(p)).find((p) => p?.type === 'postgres')
  if (direct) return direct
  for (const p of parents) {
    const sib = graph.edges.filter((e) => e.source === p).map((e) => byId.get(e.target))
    const pg = sib.find((x) => x?.type === 'postgres')
    if (pg) return pg
  }
  return graph.nodes.find((n) => n.type === 'postgres')
}

function buildTopology(graph: SimGraph): Topology {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const adj = new Map<string, { to: string; real: boolean }[]>()
  const push = (a: string, b: string, real: boolean) => {
    if (a === b || !byId.has(a) || !byId.has(b)) return
    const list = adj.get(a) ?? []
    if (!list.some((x) => x.to === b)) list.push({ to: b, real })
    adj.set(a, list)
  }
  for (const e of graph.edges) push(e.source, e.target, true)
  // Порядок-зависимость: primary обрабатывается раньше реплики (репликация идёт от него).
  for (const n of graph.nodes) {
    if (n.type !== 'replica') continue
    const pg = primaryOf(graph, n, byId)
    if (pg) push(pg.id, n.id, false)
  }

  // DFS от клиентов; рёбра назад (циклы) отбрасываем.
  const mark = new Map<string, 1 | 2>()
  const post: string[] = []
  const active = new Set<string>()
  const dfs = (u: string) => {
    mark.set(u, 1)
    for (const { to, real } of adj.get(u) ?? []) {
      if (mark.get(to) === 1) continue
      if (real) active.add(`${u}>${to}`)
      if (!mark.has(to)) dfs(to)
    }
    mark.set(u, 2)
    post.push(u)
  }
  for (const n of graph.nodes) if (n.type === 'client' && !mark.has(n.id)) dfs(n.id)

  const kids = new Map<string, SimNodeConfig[]>()
  for (const e of graph.edges) {
    if (!active.has(`${e.source}>${e.target}`)) continue
    const list = kids.get(e.source) ?? []
    const child = byId.get(e.target)!
    if (!list.includes(child)) list.push(child)
    kids.set(e.source, list)
  }
  return { order: post.reverse(), kids, byId }
}

// ───────────────────────── Шаг симуляции ─────────────────────────

export function step(
  graph: SimGraph,
  state: SimState,
  opts: { scenario?: Scenario; manualLoad?: Load },
): { result: TickResult; state: SimState } {
  graph = norm(graph)
  const { scenario } = opts
  const t = state.t
  const s = cloneState(state)
  for (const n of graph.nodes) s.nodes[n.id] ??= freshNodeState()
  applyEvents(graph, s, scenario, t)
  prepareTick(graph, s, scenario, t)

  // Входящая нагрузка пользователей.
  let load: Load
  if (scenario) {
    const m = trafficCurve(scenario, t) * s.trafficMult
    load = {
      read: scenario.baseLoad.read * m,
      write: scenario.baseLoad.write * m,
      static: scenario.baseLoad.static * m,
    }
  } else {
    load = { ...(opts.manualLoad ?? zero()) }
  }
  const junk = s.ddos && t < s.ddos.until ? s.ddos.rps : 0
  load.read += junk

  const flow = runFlow(graph, s, t, load, junk)

  // Железо + оплата за запросы (LLM API) по текущему rps, в пересчёте на месяц.
  const cost = graph.nodes.reduce(
    (sum, n) => sum + nodeCost(n, s.nodes[n.id]) + (flow.nodes[n.id]?.rps ?? 0) * SECONDS_PER_MONTH * (specOf(n).usdPer1kReq ?? 0) / 1000,
    0,
  )
  const lostTotal = graph.nodes.reduce((sum, n) => sum + (s.nodes[n.id].lostTotal ?? 0), 0)
  const sloViolated = scenario
    ? flow.p99Ms > scenario.slo.p99Ms ||
      flow.errorRate > scenario.slo.errorRate ||
      (scenario.slo.maxLost !== undefined && lostTotal > scenario.slo.maxLost) ||
      // Асинхронный SLO: «сообщение доставлено не позже чем через N секунд» — лаг очереди тоже нарушение
      (scenario.slo.maxLagSec !== undefined &&
        graph.nodes.some((n) => (n.type === 'queue' || n.type === 'kafka') && (flow.nodes[n.id]?.lagSec ?? 0) > scenario.slo.maxLagSec!)) ||
      (scenario.slo.maxCostPerMonth !== undefined && cost > scenario.slo.maxCostPerMonth)
    : false
  if (sloViolated) s.violatedMinutes += 1
  let health = 100
  if (scenario) {
    const budget = scenario.errorBudgetMin
    health = budget > 0 ? 100 * (1 - s.violatedMinutes / budget) : s.violatedMinutes > 0 ? 0 : 100
    health = clamp(health, 0, 100)
  }

  // Убираем истёкший прогрев и двигаем время.
  for (const n of graph.nodes) {
    const ns = s.nodes[n.id]
    if ((ns.warmingInstances ?? 0) > 0 && t + 1 >= (ns.warmingFrom ?? 0) + specOf(n).warmupTicks) {
      delete ns.warmingInstances
      delete ns.warmingFrom
    }
  }
  s.t = t + 1

  return {
    result: {
      t,
      load,
      p99Ms: flow.p99Ms,
      errorRate: flow.errorRate,
      lost: flow.lost,
      costPerMonth: cost,
      nodes: flow.nodes,
      sloViolated,
      health,
    },
    state: s,
  }
}

/** Один проход потока нагрузки по графу. Меняет backlog/lag в s. */
function runFlow(graph: SimGraph, s: SimState, t: number, load: Load, junkRps = 0) {
  const topo = buildTopology(graph)
  const { order, kids, byId } = topo
  const inbound = new Map<string, Load>()
  // DDoS-мусор едет внутри read-класса; храним, сколько его пришло в узел.
  const junkIn = new Map<string, number>()
  // Ошибки, которые видит живой пользователь (rate limit режет ботов первыми).
  const userErr = new Map<string, number>()
  // Собственная доля ошибок узла (без ошибок по путям: таймауты, пул, ретраи).
  const ownErr = new Map<string, number>()
  // Реплики, промоутнутые в primary на время failover.
  const promoted = new Set<string>()
  const routesOf = new Map<string, Route[]>()
  const metrics: Record<string, NodeMetrics> = {}
  const appliedWrites = new Map<string, number>() // записи, принятые primary (для репликации)
  let lostTick = 0 // сообщения, потерянные в этом тике (offset reset)
  const kidsOf = (id: string) => kids.get(id) ?? []
  // Сколько вызывающий ждёт ребёнка: латентность всего его синхронного пути (шлюз → LLM), а не только самого узла.
  const prevLat = (k: SimNodeConfig) => s.nodes[k.id]?.prevPathMs ?? s.nodes[k.id]?.prevLatencyMs ?? specOf(k).baseLatencyMs

  /** Сумма соединений с postgres от подключённых к нему service/worker: инстансы × dbPool. */
  const pgConnections = (pg: SimNodeConfig) => {
    const seen = new Set<string>()
    let sum = 0
    for (const e of graph.edges) {
      if (e.target !== pg.id || seen.has(e.source)) continue
      const c = byId.get(e.source)
      if (!c || (c.type !== 'service' && c.type !== 'worker')) continue
      seen.add(c.id)
      sum += instOf(c, s.nodes[c.id]) * (knobsOf(c).dbPool ?? 20)
    }
    return sum
  }

  const addLoad = (id: string, l: Load) => {
    const cur = inbound.get(id) ?? zero()
    inbound.set(id, { read: cur.read + l.read, write: cur.write + l.write, static: cur.static + l.static })
  }

  // Клиенты делят трафик поровну.
  const clients = graph.nodes.filter((n) => n.type === 'client')
  for (const c of clients) {
    addLoad(c.id, { read: load.read / clients.length, write: load.write / clients.length, static: load.static / clients.length })
    junkIn.set(c.id, junkRps / clients.length)
  }

  /** Цели чтений в БД: postgres и «свободные» реплики (реплики под postgres получают долю через него). */
  const dbReadTargets = (list: SimNodeConfig[]) => {
    const owned = new Set(
      list.filter((k) => k.type === 'postgres').flatMap((p) => kidsOf(p.id).filter((c) => c.type === 'replica').map((c) => c.id)),
    )
    return list.filter((k) => k.type === 'postgres' || (k.type === 'replica' && !owned.has(k.id)))
  }

  /** Healthcheck балансировщика: в ротации только живые дети (если живых нет — все, пусть падают). */
  const aliveKids = (list: SimNodeConfig[]) => {
    // Отдельно по группам: S3 (статика) и остальные. Если умерли все S3, статика не переезжает
    // на сервисы приложения (у них нет этих файлов), а падает в мёртвый S3.
    const pick = (group: SimNodeConfig[]) => {
      const alive = group.filter((k) => {
        const ci = capInfo(k, s.nodes[k.id], t)
        return !ci.killed && ci.effective > 0
      })
      return alive.length ? alive : group
    }
    return [...pick(list.filter((k) => k.type !== 's3')), ...pick(list.filter((k) => k.type === 's3'))]
  }

  /** Равномерный сплит: статика предпочитает S3, остальное — не-S3 детей. */
  const splitEven = (list: SimNodeConfig[], base: Load): Route[] => {
    const routes: Route[] = list.map((k) => ({ to: k.id, f: zero(), sync: true }))
    const s3 = list.filter((k) => k.type === 's3')
    const compute = list.filter((k) => k.type !== 's3')
    for (const c of CLASSES) {
      const targets = c === 'static' ? (s3.length ? s3 : compute) : compute.length ? compute : list
      for (const k of targets) routes.find((r) => r.to === k.id)!.f[c] += base[c] / targets.length
    }
    return routes
  }

  for (const id of order) {
    const n = byId.get(id)!
    const spec = specOf(n)
    const ns = s.nodes[id]
    let info = capInfo(n, ns, t)
    const inn = inbound.get(id) ?? zero()
    const slow = ns.slowUntil !== undefined && t < ns.slowUntil ? ns.slowMult : 1
    const myKids = kidsOf(id)
    const rps = total(inn)
    const junkHere = Math.min(inn.read, junkIn.get(id) ?? 0)

    // Failover: primary лежит дольше FAILOVER_TICKS → живая реплика становится primary.
    if (n.type === 'postgres' && info.killed && ns.failoverAt !== undefined && t >= ns.failoverAt) {
      const rep = myKids.find((k) => k.type === 'replica' && !capInfo(k, s.nodes[k.id], t).killed)
      if (rep) {
        promoted.add(rep.id)
        info = { ...info, killed: false, effective: 1, capacity: blockSpecs.replica.capacity * sizeMult[rep.size].capacity }
      }
    }

    const isCompute = n.type === 'service' || n.type === 'worker'
    const kn = knobsOf(n)
    // Для service/worker маршруты нужны заранее: латентность детей с прошлого тика задаёт hold-time потоков.
    let cRoutes: Route[] = []
    let holdMs = 0
    if (isCompute) {
      cRoutes = routeCompute(myKids)
      const T = kn.timeoutMs ?? 2000
      const R = Math.max(0, Math.floor(kn.retries ?? 0))
      // Агент: вызовов LLM на задачу = шаги (обычно 3, при зацикливании больше), не больше лимита maxSteps.
      const wanted = t < (ns.loopUntil ?? 0) ? (ns.loopSteps ?? AGENT_NORMAL_STEPS) : AGENT_NORMAL_STEPS
      const steps = (kn.maxSteps ?? 0) > 0 ? Math.min(wanted, kn.maxSteps!) : wanted
      let down = 0
      for (const r of cRoutes) {
        if (!r.sync) continue
        const kid = byId.get(r.to)!
        const stepMult = kid.flavor === 'llm' || kid.flavor === 'llmgw' ? steps / AGENT_NORMAL_STEPS : 1
        const w = rps > 0 ? (inn.read * r.f.read + inn.write * r.f.write + inn.static * r.f.static) / rps : 0
        const lat = prevLat(kid)
        const tfail = lat > T ? 1 - T / lat : 0
        // Ошибка вызова в прошлом тике (ошибки ребёнка + таймауты) определяет множитель ретраев.
        const e = 1 - (1 - (s.nodes[kid.id]?.prevErrRate ?? 0)) * (1 - tfail)
        let mult = 0
        for (let i = 0, p = 1; i <= R; i++, p *= e) mult += p
        mult *= stepMult
        r.w = w; r.timeoutMs = T; r.retries = R; r.tfail = tfail; r.mult = mult
        down += w * Math.min(lat, T) * stepMult
      }
      holdMs = spec.baseLatencyMs * slow + down
    }

    // 1) Сколько «единиц работы» узел выполняет.
    let used = rps
    const hasS3 = myKids.some((k) => k.type === 's3')
    const replicas = myKids.filter((k) => k.type === 'replica' && !promoted.has(k.id))
    if (n.type === 'client') used = 0
    else if (n.type === 'service' || n.type === 'worker') {
      used = inn.read + inn.write + inn.static * (hasS3 ? 1 : SERVICE_STATIC_COST)
    } else if (n.type === 'postgres') {
      const readCost = kn.indexed === false ? FULL_SCAN_COST : 1
      const readyReplicas = replicas.filter((r) => capInfo(r, s.nodes[r.id], t).capacity > 0).length
      used = (inn.read * readCost) / (1 + readyReplicas) + inn.write // записи только на primary
    } else if (n.type === 'replica') {
      const pg = primaryOf(graph, n, byId)
      used = promoted.has(id) ? 0 : inn.read + (pg ? (appliedWrites.get(pg.id) ?? 0) * REPLICATION_COST : 0)
    }

    // Крутилки ёмкости: пул потоков у service/worker, число соединений у postgres.
    let connErr = 0
    if (isCompute && info.capacity > 0 && rps > 0 && holdMs > 0) {
      const thrRps = (info.effective * (kn.threads ?? 200) * 1000) / holdMs
      info = { ...info, capacity: Math.min(info.capacity, (thrRps * used) / rps) }
    }
    if (n.type === 'postgres') {
      const conns = pgConnections(n)
      if (conns > PG_CONN_KNEE) info = { ...info, capacity: info.capacity * Math.sqrt(PG_CONN_KNEE / conns) }
      const maxC = kn.maxConnections ?? 500
      if (conns > maxC) connErr = 1 - maxC / conns
    }

    // 2) Метрики узла.
    const ev = n.type === 'client'
      ? { util: 0, latencyMs: 0, errorRate: 0 }
      : evaluateNode(used, info, spec.baseLatencyMs, slow)
    let errorRate = ev.errorRate
    if (n.type === 'gateway' && n.rateLimit && n.rateLimit > 0 && rps > n.rateLimit) {
      // Rate limit: лишнее отбрасываем (429), downstream защищён.
      // Лимит per-IP режет ботов первыми: живые пользователи страдают, только если их самих больше лимита.
      const dropped = rps - n.rateLimit
      const legit = rps - junkHere
      const legitDropped = Math.max(0, dropped - junkHere)
      const rejected = dropped / rps
      userErr.set(id, 1 - (1 - errorRate) * (1 - (legit > 0 ? legitDropped / legit : 0)))
      errorRate = 1 - (1 - errorRate) * (1 - rejected)
    }
    if (connErr > 0) errorRate = 1 - (1 - errorRate) * (1 - connErr) // «too many connections»
    ownErr.set(id, errorRate)
    if (n.type === 'postgres') appliedWrites.set(id, inn.write * (1 - errorRate))

    let status: NodeStatus
    if (info.killed) status = 'down'
    else if (info.capacity <= 0) status = info.warming > 0 ? 'warming' : 'down'
    else if (ev.util >= 1) status = 'overloaded'
    else if (info.warming > 0) status = 'warming'
    else if (ev.util >= 0.7) status = 'hot'
    else status = 'ok'

    // 3) Маршрутизация детям.
    let routes: Route[] = []
    let backlog: number | undefined
    let lagSec: number | undefined
    switch (n.type) {
      case 'client': {
        routes = splitEven(myKids, { read: 1, write: 1, static: 1 })
        break
      }
      case 'cdn': {
        const h = effectiveHit(n, ns, t)
        // static целиком кэшируется на h, read — только кэшируемые GET.
        const rf = n.flavor === 'edge' ? EDGE_READ_FACTOR : CDN_READ_FACTOR
        routes = splitEven(myKids, { read: 1 - h * rf, write: 1, static: 1 - h })
        break
      }
      case 'lb': {
        // nginx proxy_cache: при ttl>0 lb поглощает часть статики и чтений.
        const tf = (kn.ttlSec ?? 0) > 0 ? ttlFactor(kn.ttlSec ?? 0) : 0
        routes = splitEven(aliveKids(myKids), { read: 1 - LB_CACHE_READ * tf, write: 1, static: 1 - LB_CACHE_STATIC * tf })
        break
      }
      case 'gateway': {
        routes = splitEven(aliveKids(myKids), { read: 1, write: 1, static: 1 })
        break
      }
      case 'service':
      case 'worker': {
        routes = cRoutes
        break
      }
      case 'postgres': {
        // Чтения делятся поровну между primary и прогретыми живыми репликами (прогревающаяся реплика трафик не получает).
        const ready = replicas.filter((r) => capInfo(r, s.nodes[r.id], t).capacity > 0)
        routes = ready.map((r) => ({ to: r.id, f: { read: 1 / (1 + ready.length), write: 0, static: 0 }, sync: true }))
        break
      }
      case 'redis': {
        // Промахи кэша идут в БД-детей.
        const h = effectiveHit(n, ns, t)
        const targets = dbReadTargets(myKids)
        routes = targets.map((k) => ({ to: k.id, f: { read: (1 - h) / targets.length, write: 0, static: 0 }, sync: true }))
        break
      }
      case 'queue':
      case 'kafka': {
        // Принятые сообщения копятся; воркеры забирают не больше своей суммарной ёмкости.
        const accepted = rps * (1 - errorRate)
        // Застрявшие (stall) и стоящие на ребалансе консьюмеры ничего не разбирают.
        const idle = (k: SimNodeConfig) => t < (s.nodes[k.id]?.stalledUntil ?? 0) || t < (s.nodes[k.id]?.pausedUntil ?? 0)
        const caps = myKids.map((k) => (idle(k) ? 0 : capInfo(k, s.nodes[k.id], t).capacity))
        const capSum = caps.reduce((a, b) => a + b, 0)
        // Kafka: консьюмеров не больше, чем партиций; лишние воркеры простаивают.
        const kidInst = myKids.reduce((a, k) => a + capInfo(k, s.nodes[k.id], t).effective, 0)
        const consumeScale = n.type === 'kafka' && kidInst > 0 ? Math.min(kidInst, Math.max(1, kn.partitions ?? 12)) / kidInst : 1
        const drainRate = capSum * consumeScale
        let b0 = ns.backlog
        const latest = n.type === 'kafka' && kn.offsetReset === 'latest'
        // Группа вернулась после долгого простоя и прыгнула на latest: накопленный бэклог пропущен.
        if (latest && b0 > 0 && myKids.some((k) => s.nodes[k.id]?.resumedAt === t)) {
          lostTick += b0
          ns.lostTotal = (ns.lostTotal ?? 0) + b0
          b0 = 0
        }
        const drained = Math.min(b0 / 60 + accepted, drainRate)
        backlog = Math.max(0, b0 + (accepted - drained) * 60)
        // Бэклог старше retention (60 мин входящего потока) уже удалён брокером; с latest консьюмер теряет его.
        if (latest && accepted > 0 && backlog > RETENTION_SEC * accepted) {
          lostTick += backlog
          ns.lostTotal = (ns.lostTotal ?? 0) + backlog
          backlog = 0
        }
        lagSec = drainRate > 0 ? backlog / drainRate : backlog > 0 ? MAX_LAG_SEC : 0
        ns.backlog = backlog
        routes = myKids.map((k, i) => ({
          to: k.id,
          f: zero(),
          sync: false, // пользователь получил ack и дальше не ждёт
          abs: { read: 0, write: capSum > 0 ? (drained * caps[i]) / capSum : 0, static: 0 },
        }))
        if (status === 'ok' || status === 'hot') {
          if (backlog > 10 * 60 * drainRate) status = 'hot' // больше 10 минут разбора
        }
        break
      }
      default:
        break // листья: search, s3, clickhouse, external
    }

    if (n.type === 'replica') {
      // Лаг репликации копится, пока реплика перегружена, и медленно спадает.
      const lag = ns.backlog
      ns.backlog = ev.util > 1 || (ev.util >= 1 && rps > 0) ? lag + (ev.util - 1) * 60 : Math.max(0, lag - 20)
      lagSec = ns.backlog
    }

    // 4) Раздаём нагрузку детям (отброшенное на этом узле дальше не идёт).
    routesOf.set(id, routes)
    const pass = 1 - errorRate
    let shownErr = errorRate
    if (isCompute) {
      // Пул соединений: на инстанс не больше dbPool × 1000 / латентность БД запросов в секунду.
      const dbRoutes = routes.filter((r) => { const tp = byId.get(r.to)!.type; return tp === 'postgres' || tp === 'replica' })
      let rate = 0, latW = 0
      for (const r of dbRoutes) {
        const o = (inn.read * r.f.read + inn.write * r.f.write + inn.static * r.f.static) * pass * (r.mult ?? 1)
        rate += o
        latW += o * prevLat(byId.get(r.to)!)
      }
      if (rate > 0) {
        const cap = (info.effective * (kn.dbPool ?? 20) * 1000) / Math.max(1, latW / rate)
        if (rate > cap) for (const r of dbRoutes) r.poolFail = 1 - cap / rate
      }
      // На узле показываем ещё и ошибки по путям (таймауты, нехватка соединений).
      let failShare = 0
      for (const r of routes) {
        if (r.sync) failShare += (r.w ?? 0) * (1 - (1 - (r.tfail ?? 0)) * (1 - (r.poolFail ?? 0)))
      }
      shownErr = 1 - (1 - errorRate) * (1 - clamp(failShare, 0, 1))
    }
    const readOut = inn.read * pass
    const junkOut = n.type === 'gateway' ? Math.max(0, junkHere - (rps - readOut - inn.write * pass - inn.static * pass)) : junkHere * pass
    const junkFrac = readOut > 0 ? Math.min(1, junkOut / readOut) : 0
    for (const r of routes) {
      if (r.abs) { addLoad(r.to, r.abs); continue }
      const m = (r.mult ?? 1) * (1 - (r.poolFail ?? 0)) // ретраи множат нагрузку, пул отсекает часть
      const out: Load = {
        read: inn.read * r.f.read * pass * m,
        write: inn.write * r.f.write * pass * m,
        static: inn.static * r.f.static * pass * m,
      }
      if (!r.toWrite && out.read > 0) junkIn.set(r.to, (junkIn.get(r.to) ?? 0) + out.read * junkFrac)
      if (r.toWrite) addLoad(r.to, { read: 0, write: total(out), static: 0 })
      else addLoad(r.to, out)
    }

    metrics[id] = {
      id,
      rps,
      capacity: info.capacity,
      utilization: ev.util,
      latencyMs: ev.latencyMs,
      errorRate: shownErr,
      ...(n.type === 'queue' || n.type === 'kafka' ? { backlog } : {}),
      ...(lagSec !== undefined ? { lagSec } : {}),
      ...(autoscaled(n) ? { instances: info.inst } : {}),
      ...(t < (ns.pausedUntil ?? 0) ? { paused: true } : {}),
      costPerMonth: nodeCost(n, ns),
      status,
    }
  }

  // Запоминаем латентность/ошибки для следующего тика (hold-time потоков, ретраи, пул).
  for (const id of Object.keys(metrics)) {
    // Рост сглаживаем (скользящее окно), падение учитываем сразу: так петля обратной связи не звенит, а восстановление быстрое.
    const ps = s.nodes[id]
    const smooth = (old: number | undefined, cur: number) => (old === undefined || cur < old ? cur : (old + cur) / 2)
    ps.prevLatencyMs = smooth(ps.prevLatencyMs, metrics[id].latencyMs)
    ps.prevErrRate = smooth(ps.prevErrRate, metrics[id].errorRate)
    ps.prevUtil = metrics[id].utilization
    ps.prevLagSec = metrics[id].lagSec
  }

  /** Куда сервис/воркер отправляет каждый класс трафика. */
  function routeCompute(list: SimNodeConfig[]): Route[] {
    const map = new Map<string, Route>()
    const route = (k: SimNodeConfig, sync = true) => {
      let r = map.get(k.id)
      if (!r) map.set(k.id, (r = { to: k.id, f: zero(), sync }))
      return r
    }
    const search = list.filter((k) => k.type === 'search' && k.flavor !== 'vectordb')
    const redis = list.filter((k) => k.type === 'redis' && k.flavor !== 'semcache')
    // LLM-конвейер: семантический кэш → (промах) поиск в векторной БД + вызов модели.
    const sem = list.filter((k) => k.flavor === 'semcache')
    const llms = list.filter((k) => k.flavor === 'llm')
    const vdb = list.filter((k) => k.flavor === 'vectordb')
    const queues = list.filter((k) => k.type === 'queue' || k.type === 'kafka')
    const pgs = list.filter((k) => k.type === 'postgres')
    const ext = list.filter((k) => k.type === 'external' && k.flavor !== 'llm')
    const ch = list.filter((k) => k.type === 'clickhouse')
    const s3 = list.filter((k) => k.type === 's3')
    const chain = list.filter((k) => k.type === 'service' || k.type === 'worker' || k.type === 'lb' || k.type === 'gateway')

    // Чтения: 30% — поиск (если есть), остальное — через кэш, промахи — в БД.
    const searchShare = search.length ? SEARCH_SHARE : 0
    for (const k of search) route(k).f.read += searchShare / search.length
    let rest = 1 - searchShare
    const dbTargets = dbReadTargets(list)
    let toDb = rest
    if (redis.length) {
      toDb = 0
      for (const k of redis) {
        const share = rest / redis.length
        route(k).f.read += share
        // Если у кэша есть свои дети-БД, промахи обработает он сам.
        if (!kidsOf(k.id).some((c) => c.type === 'postgres' || c.type === 'replica')) {
          toDb += share * (1 - effectiveHit(k, s.nodes[k.id], t))
        }
      }
      rest = 0
    }
    for (const k of dbTargets) route(k).f.read += toDb / dbTargets.length

    // Записи: через очередь (асинхронно, быстрый ack), иначе напрямую в Postgres.
    if (queues.length) for (const k of queues) route(k).f.write += 1 / queues.length
    else for (const k of pgs) route(k).f.write += 1 / pgs.length
    for (const k of ext) route(k).f.write += 1 // синхронный внешний вызов (платёж)
    // К модели идёт каждый запрос (вопрос пользователя или задача воркера), кроме попаданий в семантический кэш.
    let miss = 1
    if (sem.length) {
      miss = 0
      for (const k of sem) {
        route(k).f.read += 1 / sem.length
        route(k).f.write += 1 / sem.length
        miss += (1 - effectiveHit(k, s.nodes[k.id], t)) / sem.length
      }
    }
    for (const k of vdb) route(k).f.read += miss / vdb.length
    for (const k of llms) {
      route(k).f.read += miss / llms.length
      route(k).f.write += miss / llms.length
    }

    // Аналитика: событие на каждый запрос, асинхронно.
    for (const k of ch) {
      const r = route(k, false)
      r.f = { read: 1, write: 1, static: 1 }
      r.toWrite = true
    }
    // Статика: в S3, иначе сервис отдаёт сам.
    for (const k of s3) route(k).f.static += 1 / s3.length
    // Вызовы других сервисов — синхронные, получают весь трафик.
    for (const k of chain) route(k).f = { read: 1, write: 1, static: 1 }
    return [...map.values()]
  }

  // ───── Сквозные метрики по синхронным путям ─────
  const memo = new Map<string, { lat: number; ok: number }>()
  const path = (id: string, c: Cls): { lat: number; ok: number } => {
    const key = `${id}|${c}`
    const hit = memo.get(key)
    if (hit) return hit
    const m = metrics[id]
    let lat = m ? m.latencyMs : 0
    let ok = m ? 1 - (userErr.get(id) ?? ownErr.get(id) ?? m.errorRate) : 1
    for (const r of routesOf.get(id) ?? []) {
      if (!r.sync || r.f[c] <= 0 || !metrics[r.to]) continue
      const sub = path(r.to, c)
      // Таймаут обрезает ожидание, ретраи умножают его; видимая ошибка пути = e^(retries+1).
      lat += r.f[c] * (r.timeoutMs !== undefined ? Math.min(sub.lat, r.timeoutMs) : sub.lat) * (r.mult ?? 1)
      let vis = 1 - sub.ok
      if (r.tfail || r.poolFail || r.retries) {
        const eCall = 1 - (1 - vis) * (1 - (r.tfail ?? 0)) * (1 - (r.poolFail ?? 0))
        vis = Math.pow(eCall, (r.retries ?? 0) + 1)
      }
      ok *= 1 - r.f[c] * vis
    }
    const res = { lat, ok }
    memo.set(key, res)
    return res
  }

  let wSum = 0, latSum = 0, errSum = 0
  for (const c of CLASSES) {
    const w = c === 'read' ? load.read - junkRps : load[c] // качество сервиса меряем по живым пользователям
    if (w <= 0 || clients.length === 0) continue
    const avg = clients.reduce(
      (acc, cl) => { const p = path(cl.id, c); return { lat: acc.lat + p.lat, ok: acc.ok + p.ok } },
      { lat: 0, ok: 0 },
    )
    wSum += w
    latSum += (w * avg.lat) / clients.length
    errSum += (w * (1 - avg.ok / clients.length))
  }

  // Латентность пути от каждого узла вниз (для hold-time и таймаутов вызывающих в следующем тике).
  for (const id of Object.keys(metrics)) {
    const inn = inbound.get(id) ?? zero()
    let worst = 0
    for (const c of CLASSES) if (inn[c] > 0) worst = Math.max(worst, path(id, c).lat)
    const ps = s.nodes[id]
    const cur = worst || metrics[id].latencyMs
    ps.prevPathMs = ps.prevPathMs === undefined || cur < ps.prevPathMs ? cur : (ps.prevPathMs + cur) / 2
  }

  // Узлы, до которых трафик не дошёл (не подключены) — простаивают.
  for (const n of graph.nodes) {
    if (metrics[n.id]) continue
    const ns = s.nodes[n.id]
    const info = capInfo(n, ns, t)
    metrics[n.id] = {
      id: n.id,
      rps: 0,
      capacity: info.capacity,
      utilization: 0,
      latencyMs: specOf(n).baseLatencyMs,
      errorRate: 0,
      costPerMonth: nodeCost(n, ns),
      status: info.killed ? 'down' : info.warming > 0 && info.capacity <= 0 ? 'warming' : info.capacity <= 0 ? 'down' : info.warming > 0 ? 'warming' : 'ok',
    }
  }

  return {
    nodes: metrics,
    lost: lostTick,
    p99Ms: wSum > 0 ? P99_FACTOR * (latSum / wSum) : 0,
    errorRate: wSum > 0 ? clamp(errSum / wSum, 0, 1) : 0,
  }
}

// ───────────────────────── Статический анализ ─────────────────────────

const SPOF_TYPES: BlockType[] = ['lb', 'gateway', 'service', 'postgres', 'redis', 'queue', 'kafka', 'search']

/** Стоимость, единые точки отказа (id узлов) и предупреждения на русском. */
export function staticAnalysis(graph: SimGraph): { costPerMonth: number; spofs: string[]; warnings: string[] } {
  graph = norm(graph)
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const kidsAll = (id: string) =>
    graph.edges.filter((e) => e.source === id).map((e) => byId.get(e.target)).filter((x): x is SimNodeConfig => !!x)
  const parentsAll = (id: string) =>
    graph.edges.filter((e) => e.target === id).map((e) => byId.get(e.source)).filter((x): x is SimNodeConfig => !!x)

  const costPerMonth = graph.nodes.reduce((sum, n) => sum + nodeCost(n), 0)

  // Достижимые от клиента.
  const reach = new Set<string>()
  const queue = graph.nodes.filter((n) => n.type === 'client').map((n) => n.id)
  while (queue.length) {
    const id = queue.pop()!
    if (reach.has(id)) continue
    reach.add(id)
    for (const k of kidsAll(id)) queue.push(k.id)
  }

  const hasReplica = graph.nodes.some((n) => n.type === 'replica' && reach.has(n.id))
  const spofs: string[] = []
  for (const n of graph.nodes) {
    if (!reach.has(n.id) || !SPOF_TYPES.includes(n.type) || instCount(n) > 1) continue
    const parentIds = new Set(parentsAll(n.id).map((p) => p.id))
    const hasPeer = graph.nodes.some(
      (o) => o.id !== n.id && o.type === n.type && parentsAll(o.id).some((p) => parentIds.has(p.id)),
    )
    if (n.type === 'postgres' ? hasReplica : hasPeer) continue
    spofs.push(n.id)
  }

  const warnings: string[] = []
  const seen = new Set<string>()
  const warn = (key: string, msg: string) => {
    if (!seen.has(key)) { seen.add(key); warnings.push(msg) }
  }
  for (const n of graph.nodes) {
    const kids = kidsAll(n.id)
    if (n.type !== 'client' && !reach.has(n.id)) warn(`dis|${n.id}`, `Блок «${n.label}» не подключён к клиенту`)
    if (n.type === 'service') {
      if (kids.some((k) => k.type === 'postgres' || k.type === 'replica') && !kids.some((k) => k.type === 'redis')) {
        warn(`cache|${n.id}`, `Сервис «${n.label}» ходит в Postgres без кэша`)
      }
      const parents = parentsAll(n.id)
      const pset = new Set(parents.map((p) => p.id))
      const group = graph.nodes.filter((o) => o.type === 'service' && (o.id === n.id || parentsAll(o.id).some((p) => pset.has(p.id))))
      const count = group.reduce((a, o) => a + instCount(o), 0)
      const fronted = parents.some((p) => p.type === 'lb' || p.type === 'gateway')
      if (count > 1 && !fronted && parents.every((p) => p.type === 'client' || p.type === 'cdn')) {
        warn(`lb|${group.map((g) => g.id).sort().join(',')}`, `Нет балансировщика перед ${count} инстансами сервиса «${n.label}»`)
      }
    }
    if ((n.type === 'queue' || n.type === 'kafka') && !kids.some((k) => k.type === 'worker' || k.type === 'service')) {
      warn(`nw|${n.id}`, `${n.type === 'kafka' ? 'Kafka' : 'Очередь'} без воркеров — сообщения копятся`)
    }
    if (n.type === 'kafka' && instCount(n) < 3) {
      warn(`k3|${n.id}`, 'Kafka меньше чем на 3 брокерах — нет репликации партиций')
    }
    if (n.type === 'replica' && !graph.nodes.some((o) => o.type === 'postgres')) {
      warn(`rep|${n.id}`, `Реплика «${n.label}» без Postgres — нечего реплицировать`)
    }
  }
  return { costPerMonth, spofs, warnings }
}
