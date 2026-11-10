import type { Aspect } from '../practice/aspects'
import { frontendModule } from './module-frontend'
import { llmModule } from './module-llm'

export type Step =
  | { kind: 'concept'; id: string }
  | { kind: 'card'; id: string }
  | { kind: 'task'; id: string }
  | { kind: 'duel'; id: string }
  | { kind: 'explain'; id: string; aspect: Aspect }
  | { kind: 'scenario'; id: string; optional?: boolean }
  | { kind: 'defense'; id: string }
  | { kind: 'ctf'; id: string }

export interface Module {
  id: string
  emoji: string
  title: string
  /** What you will be able to do after the module. */
  goal: string
  requires: string[]
  steps: Step[]
  /** Final challenge: scenario or design task id. */
  boss: { kind: 'scenario' | 'task' | 'defense' | 'ctf'; id: string }
}

const c = (...ids: string[]): Step[] => ids.map((id) => ({ kind: 'concept', id }))
const k = (...ids: string[]): Step[] => ids.map((id) => ({ kind: 'card', id }))
const t = (...ids: string[]): Step[] => ids.map((id) => ({ kind: 'task', id }))
const d = (...ids: string[]): Step[] => ids.map((id) => ({ kind: 'duel', id }))
const x = (id: string, aspect: Aspect): Step => ({ kind: 'explain', id, aspect })
const extra = (...ids: string[]): Step[] => ids.map((id) => ({ kind: 'scenario', id, optional: true }))

/** Learning path from basics to advanced. Each module: understand → meet components → practice → compare → explain → boss. */
export const curriculum: Module[] = [
  {
    id: 'web-basics',
    emoji: '🌐',
    title: 'Как устроена веб-система',
    goal: 'Понимать путь запроса, знать порядки задержек и уметь прикинуть нагрузку и число серверов.',
    requires: [],
    steps: [
      ...c('request-lifecycle', 'latency-numbers', 'capacity-estimation', 'stateless-stateful'),
      ...k('dns', 'cdn', 'load-balancer', 'app-service'),
      ...t('est-rps-from-dau', 'est-servers-count', 'est-image-bandwidth'),
      x('app-service', 'essence'),
    ],
    boss: { kind: 'scenario', id: 'first-shift' },
  },
  {
    id: 'data',
    emoji: '🐘',
    title: 'Хранение данных',
    goal: 'Выбирать БД под задачу, понимать индексы, транзакции и почему одни движки быстро пишут, а другие быстро читают.',
    requires: ['web-basics'],
    steps: [
      ...c('indexes', 'transactions-acid', 'storage-engines', 'choosing-database'),
      ...k('postgres', 'mysql', 'mongodb'),
      ...t('ch-pg-default', 'ch-index-gin', 'ch-index-brin', 'ch-isolation', 'est-storage-messages', 'bn-missing-index'),
      ...d('postgres-vs-mongo-orders', 'mongo-vs-postgres-cms-content', 'optimistic-vs-pessimistic'),
      x('postgres', 'compare'),
    ],
    boss: { kind: 'scenario', id: 'inh-slow-query' },
  },
  {
    id: 'caching',
    emoji: '⚡',
    title: 'Кэширование',
    goal: 'Снимать нагрузку с БД кэшем, считать hit ratio и не уронить базу при сбросе кэша.',
    requires: ['web-basics'],
    steps: [
      ...c('caching-patterns'),
      ...k('redis', 'memcached', 'nginx'),
      ...t('est-cache-memory', 'ch-redis-usecases', 'ch-redis-eviction', 'ch-cdn-invalidation', 'bn-redis-eviction', 'bn-cdn-hit-ratio'),
      ...d('redis-vs-memcached-sessions', 'memcached-vs-redis-html-fragments', 'cache-aside-vs-write-through', 'cdn-vs-own-nginx'),
      x('redis', 'breaks'),
      ...extra('inh-dead-cache'),
    ],
    boss: { kind: 'scenario', id: 'morning-reads' },
  },
  {
    id: 'scaling',
    emoji: '📈',
    title: 'Масштабирование и согласованность',
    goal: 'Масштабировать чтение и запись, понимать реплики, шардинг, лаг и компромиссы согласованности.',
    requires: ['data'],
    steps: [
      ...c('replication', 'partitioning', 'consistency-cap'),
      ...k('read-replica', 'pgbouncer', 'sharding', 'cassandra'),
      ...t('est-replication-lag', 'ch-read-your-writes', 'bn-replica-lag', 'bn-pool-exhaustion'),
      ...d('read-replica-vs-cache', 'sharding-vs-vertical'),
      x('sharding', 'whenNot'),
      ...extra('inh-too-many-connections'),
    ],
    boss: { kind: 'scenario', id: 'primary-down' },
  },
  {
    id: 'async',
    emoji: '📬',
    title: 'Асинхронность и очереди',
    goal: 'Разносить работу по времени, выбирать очередь или лог, не терять и не дублировать события.',
    requires: ['caching', 'scaling'],
    steps: [
      ...c('async-messaging', 'idempotency-outbox'),
      ...k('worker', 'rabbitmq', 'kafka'),
      ...t('est-kafka-retention', 'ch-kafka-vs-rabbit', 'ch-delivery', 'bn-kafka-consumer-lag', 'ds-duplicate-payments'),
      ...d('kafka-vs-rabbit-events', 'rabbit-vs-kafka-tasks', 'sync-vs-queue-report', 'outbox-vs-dual-write', 'idempotency-key-vs-dedup'),
      x('kafka', 'scale'),
      ...extra('inh-lag-and-static'),
    ],
    boss: { kind: 'scenario', id: 'black-friday' },
  },
  {
    id: 'special',
    emoji: '🗄️',
    title: 'Специализированные хранилища',
    goal: 'Знать, когда нужны аналитическая БД, поиск, объектное и time-series хранилище вместо Postgres.',
    requires: ['data'],
    steps: [
      ...c('oltp-olap', 'vector-search-rag'),
      ...k('clickhouse', 'elasticsearch', 's3', 'timeseries-db', 'vector-db'),
      ...t('est-clickhouse-storage', 'est-video-storage', 'ch-clickhouse-inserts', 'ch-search-primary', 'ch-s3-presigned'),
      ...d('clickhouse-vs-postgres-analytics', 'es-vs-pg-fts', 'es-vs-pg-marketplace', 'presigned-vs-through-backend'),
      x('clickhouse', 'essence'),
      ...extra('inh-redis-oom'),
    ],
    boss: { kind: 'task', id: 'ds-file-upload' },
  },
  {
    id: 'ops',
    emoji: '🛠️',
    title: 'Эксплуатация продакшена',
    goal: 'Переживать аварии зон, настраивать автоскейлинг и консьюмеров Kafka, не терять данные и не упираться в квоты внешних API.',
    requires: ['async', 'scaling'],
    steps: [
      ...c('dr-backups', 'autoscaling', 'kafka-consumers', 'outbound-rate-limits', 'id-generation'),
      ...k('kafka', 'worker', 'redis', 'docker-kubernetes'),
      x('kafka', 'breaks'),
      { kind: 'scenario', id: 'ops-sleepy-limiter' },
      { kind: 'scenario', id: 'ops-rebalance-storm' },
      { kind: 'scenario', id: 'ops-living-dead' },
    ],
    boss: { kind: 'scenario', id: 'ops-zone-outage' },
  },
  {
    id: 'resilience',
    emoji: '🛡️',
    title: 'Надёжность и периметр',
    goal: 'Переживать сбои зависимостей и атаки: таймауты, ретраи, rate limit, SLO и бюджет ошибок.',
    requires: ['async'],
    steps: [
      ...c('resilience-patterns', 'observability-slo'),
      ...k('waf-ddos', 'api-gateway', 'external-api', 'observability'),
      ...t('ch-l4-l7', 'ds-rate-limiter', 'ds-lost-orders-failover'),
      ...d('l4-vs-l7-lb', 'polling-vs-webhooks'),
      x('external-api', 'breaks'),
      ...extra('slow-payments', 'cache-flush', 'inh-slow-payments'),
    ],
    boss: { kind: 'scenario', id: 'ddos' },
  },
  {
    id: 'platform',
    emoji: '🏗️',
    title: 'Платформа и большие системы',
    goal: 'Собирать систему целиком: контейнеры, оркестрация, discovery, realtime — и проектировать сервис с нуля.',
    requires: ['resilience', 'special'],
    steps: [
      ...k('docker-kubernetes', 'service-discovery-mesh', 'etcd-zookeeper', 'serverless', 'websocket-gateway'),
      ...t('est-websocket-nodes', 'ds-url-shortener', 'ds-notification-service', 'ds-chat-messenger'),
      ...d('monolith-vs-micro-5people', 'serverless-vs-always-on', 'ws-sse-polling'),
    ],
    boss: { kind: 'scenario', id: 'chain' },
  },
  {
    id: 'security',
    emoji: '🔐',
    title: 'Безопасность систем и ИИ',
    goal: 'Видеть систему глазами атакующего: веб-уязвимости, секреты и зависимости, prompt injection и безопасность агентов, эшелонированная защита.',
    requires: ['web-basics', 'data'],
    steps: [
      ...c('authn-authz', 'web-owasp', 'secrets-supply-chain', 'prompt-injection', 'agent-security', 'defense-in-depth'),
      ...k('waf-ddos', 'api-gateway', 'external-api'),
      ...d(
        'sec-jwt-vs-session-bank',
        'sec-httponly-vs-localstorage',
        'sec-waf-vs-parameterized',
        'sec-rate-limit-ip-vs-account',
        'sec-npm-ci-vs-latest',
        'sec-csp-vs-sanitize',
        'sec-vault-vs-k8s-env',
        'sec-allowlist-vs-denylist-agent-tools',
        'sec-hitl-vs-guardrail-refunds',
        'sec-mtls-vs-networkpolicy',
      ),
      { kind: 'ctf', id: '1' },
      { kind: 'ctf', id: '3' },
      { kind: 'defense', id: 'def-1' },
      { kind: 'defense', id: 'def-3' },
      { kind: 'defense', id: 'def-5' },
      x('external-api', 'breaks'),
    ],
    boss: { kind: 'defense', id: 'def-6' },
  },
  frontendModule,
  llmModule,
]

export const getModule = (id: string) => curriculum.find((m) => m.id === id)
