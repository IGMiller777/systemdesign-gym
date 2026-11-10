import type { BlockType } from '../tasks/types'

export type NodeSize = 'S' | 'M' | 'L' | 'XL'

/** Traffic split by class, in requests per second. */
export interface Load {
  read: number
  write: number
  static: number
}

export interface SimNodeConfig {
  id: string
  type: BlockType
  label: string
  /** Horizontal copies. Stateful single-leader stores (postgres) ignore >1 for writes. */
  instances: number
  /** Vertical size. */
  size: NodeSize
  /** redis/cdn: share of eligible requests served from cache, 0..1. */
  hitRatio?: number
  /** gateway: max rps let through, excess is rejected (429). */
  rateLimit?: number
  /** Real-life config settings. Absent = sane default (see engine `knobDefaults`). */
  knobs?: Knobs
  /** Set by the engine only: original type of a flavored block (ssr, llm…), `type` then holds its base model. */
  flavor?: BlockType
  /** Availability zone / provider the node lives in (e.g. "a", "b", "cloud-2"). Absent = "a". */
  zone?: string
}

/** A few settings per block that matter in production. */
export interface Knobs {
  /** service/worker: retries on downstream error (0..5). */
  retries?: number
  /** service/worker: timeout for downstream calls, ms. */
  timeoutMs?: number
  /** service/worker: concurrent requests per instance (thread/worker pool). */
  threads?: number
  /** service/worker: DB connections per instance. */
  dbPool?: number
  /** postgres: max_connections. */
  maxConnections?: number
  /** postgres: the hot query is covered by an index. */
  indexed?: boolean
  /** redis/cdn/lb (nginx proxy_cache): cache TTL, seconds. 0 = caching off. */
  ttlSec?: number
  /** redis: maxmemory-policy. */
  evictionPolicy?: 'noeviction' | 'allkeys-lru'
  /** kafka: partitions of the main topic. */
  partitions?: number
  /** service/worker: autoscaler trigger. cpu = by utilization, queue = by lag of the parent queue/kafka. */
  autoscale?: 'off' | 'cpu' | 'queue'
  /** service/worker: autoscaler upper bound of instances. */
  autoscaleMax?: number
  /** worker consuming kafka: group rebalance protocol. eager = whole group pauses on any membership change. */
  rebalance?: 'eager' | 'cooperative'
  /** kafka: where a consumer group resumes after a long outage. latest = skip the backlog (data loss). */
  offsetReset?: 'latest' | 'earliest'
  /** worker/service calling an LLM: max agent steps (LLM calls) per task, 0 = unlimited. */
  maxSteps?: number
}

export interface SimGraph {
  nodes: SimNodeConfig[]
  edges: { source: string; target: string }[]
}

export interface BlockSpec {
  /** Max rps one S-size instance handles at 100% utilization. */
  capacity: number
  /** Latency at low utilization, ms. */
  baseLatencyMs: number
  /** USD per month for one S-size instance. */
  cost: number
  scaling: 'horizontal' | 'vertical' | 'none'
  maxInstances: number
  /** Ticks (sim minutes) before a newly added instance starts serving. */
  warmupTicks: number
  /** Usage-based price (LLM API): USD per 1000 requests, added to the monthly cost at the current rps. */
  usdPer1kReq?: number
  /** Short Russian note about what the model assumes for this block. */
  modelNote: string
}

export type NodeStatus = 'ok' | 'hot' | 'overloaded' | 'down' | 'warming'

export interface NodeMetrics {
  id: string
  /** Total incoming rps. */
  rps: number
  /** Effective capacity this tick, rps. */
  capacity: number
  /** rps / capacity (can exceed 1). */
  utilization: number
  latencyMs: number
  /** Share of requests failing at this node, 0..1. */
  errorRate: number
  /** Queues/kafka: messages waiting. */
  backlog?: number
  /** Queues/kafka: seconds to drain at current consumer rate; replicas: replication lag seconds. */
  lagSec?: number
  /** Effective instances this tick when the autoscaler manages the node. */
  instances?: number
  /** Consumer paused by a group rebalance or stalled. */
  paused?: boolean
  costPerMonth: number
  status: NodeStatus
}

export interface TickResult {
  /** Sim minute. */
  t: number
  load: Load
  /** End-to-end p99 for synchronous user requests, ms. */
  p99Ms: number
  /** Share of user requests that failed (incl. rate-limited), 0..1. */
  errorRate: number
  /** Messages silently dropped this tick (offset reset to latest, retention). */
  lost?: number
  costPerMonth: number
  nodes: Record<string, NodeMetrics>
  /** True if SLO was violated this tick. */
  sloViolated: boolean
  /** Error budget left, 0..100. */
  health: number
}

export type ScenarioEventKind =
  | 'traffic' // multiply base load by value from now on
  | 'kill' // target node goes down (all instances) for duration ticks (or forever)
  | 'killOne' // one instance of target dies
  | 'slow' // target latency × value for duration
  | 'cacheFlush' // target cache hit ratio drops to 0 and recovers linearly over duration
  | 'ddos' // adds value rps of junk read traffic for duration
  | 'zoneDown' // every node whose zone === target is down for duration
  | 'stall' // target worker looks alive but makes no progress for duration ("живой мертвец")
  | 'restartLoop' // target worker instances restart every `value` ticks for duration (memory leak) → membership changes
  | 'loop' // target agent (service/worker) now makes `value` LLM calls per task instead of the normal 3, for duration
  | 'enqueue' // `value` messages land in target queue/kafka at once (batch reindex, backfill)
  | 'degrade' // target capacity ÷ value for duration (CPU burned by a bad regex, noisy neighbour)

export interface ScenarioEvent {
  /** Sim minute. */
  at: number
  kind: ScenarioEventKind
  /** Node id in startGraph, or block type (applies to first node of that type). */
  target?: string
  value?: number
  duration?: number
  /** Alert text shown to the player, Russian. */
  message: string
}

export interface Scenario {
  id: string
  title: string
  level: number
  /** Markdown briefing shown before start. */
  briefing: string
  durationMin: number
  baseLoad: Load
  /** Optional piecewise-linear traffic multiplier: [{at: minute, mult}]. */
  trafficCurve?: { at: number; mult: number }[]
  events: ScenarioEvent[]
  slo: {
    p99Ms: number
    errorRate: number
    /** Max total lost messages before it counts as a violation. */
    maxLost?: number
    /** Async SLO: any queue/kafka lag above this many seconds is a violation. */
    maxLagSec?: number
    /** Running cost (incl. usage-based LLM spend) above this many USD/month is a violation. */
    maxCostPerMonth?: number
  }
  /** How many violating minutes are allowed before game over. */
  errorBudgetMin: number
  /** USD per month the architecture may cost. */
  budgetPerMonth: number
  startGraph: SimGraph
  /** Markdown shown after the game: what a strong solution looked like. */
  debrief: string
  /** Hardcore: blocks the player may not add, with an in-world reason. */
  bannedBlocks?: { type: BlockType; reason: string }[]
  /** Hardcore variant of this scenario id (unlocked after winning it). */
  hardOf?: string
  /** "Inherited infra" mode: topology and sizes are frozen, only knobs can change. */
  configOnly?: boolean
}

/** Mutable runtime state carried between ticks. */
export interface SimState {
  t: number
  /** Per node: dynamic effects. */
  nodes: Record<
    string,
    {
      downUntil?: number
      deadInstances: number
      slowMult: number
      slowUntil?: number
      flushStart?: number
      flushDuration?: number
      backlog: number
      /** Tick when instances last changed, per node, for warmup. */
      warmingFrom?: number
      warmingInstances?: number
      /** Postgres: tick from which a replica is promoted while the primary is down. */
      failoverAt?: number
      /** Латентность узла в прошлом тике, мс (для hold-time потоков и пула соединений). */
      prevLatencyMs?: number
      /** Латентность синхронного пути от узла вниз в прошлом тике, мс. */
      prevPathMs?: number
      /** Доля ошибок узла в прошлом тике (для ретраев и таймаутов вызывающих). */
      prevErrRate?: number
      /** Автоскейлер: текущее число инстансов (старт = cfg.instances). */
      autoInstances?: number
      /** Тик последнего изменения автоскейлером (для cooldown на scale-down). */
      lastScaleAt?: number
      /** Консьюмер-группа поставлена на паузу ребалансом до этого тика (не включая его). */
      pausedUntil?: number
      /** «Живой мертвец»: воркер ничего не разбирает до этого тика. */
      stalledUntil?: number
      stalledSince?: number
      /** Тик, в который воркер вышел из долгого (>30 тиков) stall. */
      resumedAt?: number
      /** Число инстансов воркера в прошлом тике (детектор смены состава группы). */
      lastMembers?: number
      /** Kafka: сколько сообщений потеряно суммарно (offset reset, retention). */
      lostTotal?: number
      /** Ёмкость узла поделена на capDiv до capDivUntil (событие degrade). */
      capDiv?: number
      capDivUntil?: number
      /** Агент зациклился: шагов (вызовов LLM) на задачу до loopUntil. */
      loopSteps?: number
      loopUntil?: number
      /** Загрузка узла в прошлом тике (вход автоскейлера). */
      prevUtil?: number
      /** Лаг очереди/kafka в прошлом тике, с (вход автоскейлера). */
      prevLagSec?: number
    }
  >
  trafficMult: number
  ddos?: { rps: number; until: number }
  violatedMinutes: number
}
