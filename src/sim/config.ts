/** Выдержки из «реальных» конфигов блока с текущими значениями крутилок. */
import { baseOf } from './engine'
import { knobsOf } from './knobs'
import type { Knobs, SimNodeConfig } from './types'

export interface ConfigLine {
  text: string
  knob?: keyof Knobs
}

const L = (text: string, knob?: keyof Knobs): ConfigLine => (knob ? { text, knob } : { text })

/** Секунды → формат nginx/redis (1h, 5m, 30s). */
function dur(sec: number): string {
  if (sec <= 0) return '0'
  if (sec % 3600 === 0) return `${sec / 3600}h`
  if (sec % 60 === 0) return `${sec / 60}m`
  return `${sec}s`
}

/** HPA (по CPU) или KEDA (по лагу) для service/worker. */
function autoscaleLines(type: string, k: Knobs, instances: number): ConfigLine[] {
  const max = k.autoscaleMax ?? 10
  if (k.autoscale === 'cpu') {
    return [
      L('# HorizontalPodAutoscaler:'),
      L('autoscale: cpu', 'autoscale'),
      L(`minReplicas: ${instances}`),
      L(`maxReplicas: ${max}`, 'autoscaleMax'),
      L('metrics: [{ type: Resource, resource: { name: cpu, target: { averageUtilization: 70 } } }]'),
    ]
  }
  if (k.autoscale === 'queue') {
    return [
      L('# KEDA ScaledObject:'),
      L('autoscale: queue', 'autoscale'),
      L(`minReplicaCount: ${instances}`),
      L(`maxReplicaCount: ${max}`, 'autoscaleMax'),
      type === 'worker'
        ? L('triggers: [{ type: kafka, metadata: { lagThreshold: "30" } }]')
        : L('triggers: [{ type: prometheus, metadata: { threshold: "30" } }]'),
    ]
  }
  return [L('# autoscaler: выключен', 'autoscale'), L(`replicas: ${instances}`)]
}

export function configSnippet(node: SimNodeConfig): { file: string; lines: ConfigLine[] } {
  const k = knobsOf(node)
  switch (baseOf(node.type)) {
    case 'lb':
    case 'cdn': {
      const ttl = k.ttlSec ?? 0
      const lines: ConfigLine[] = [
        L('upstream backend { server app:8080; keepalive 64; }'),
        L('server {'),
        L('  listen 80;'),
      ]
      if (ttl > 0) {
        lines.push(L('  proxy_cache app_cache;'))
        lines.push(L(`  proxy_cache_valid 200 301 ${dur(ttl)};`, 'ttlSec'))
      } else {
        lines.push(L('  proxy_cache off;', 'ttlSec'))
      }
      lines.push(L('  location / { proxy_pass http://backend; }'), L('}'))
      return { file: 'nginx.conf', lines }
    }
    case 'postgres':
      return {
        file: 'postgresql.conf',
        lines: [
          L('shared_buffers = 4GB'),
          L(`max_connections = ${k.maxConnections}`, 'maxConnections'),
          L('work_mem = 16MB'),
          L('# проверка горячего запроса:'),
          L('# EXPLAIN ANALYZE SELECT * FROM items WHERE user_id = $1;'),
          k.indexed
            ? L('#   -> Index Scan using items_user_id_idx  (индекс есть)', 'indexed')
            : L('#   -> Seq Scan on items  (индекса нет, полный скан!)', 'indexed'),
        ],
      }
    case 'redis':
      return {
        file: 'redis.conf',
        lines: [
          L('maxmemory 2gb'),
          L(`maxmemory-policy ${k.evictionPolicy}`, 'evictionPolicy'),
          L('appendonly no'),
          L('# в приложении:'),
          L(`cache.set(key, value, ex=${k.ttlSec})  # TTL, сек`, 'ttlSec'),
        ],
      }
    case 'service':
    case 'worker':
      if (node.type === 'ssr' || node.type === 'bff') {
        return {
          file: 'deployment.yaml + server.ts',
          lines: [
            L(`replicas: ${node.instances}`),
            L(`# одновременных запросов на под (лимит конкурентности)`),
            L(`MAX_CONCURRENT_REQUESTS=${k.threads}`, 'threads'),
            L(`pg.Pool({ max: ${k.dbPool} })`, 'dbPool'),
            L(`fetch(api, { signal: AbortSignal.timeout(${k.timeoutMs}) })`, 'timeoutMs'),
            L(`retry: { retries: ${k.retries} }`, 'retries'),
            ...autoscaleLines(node.type, k, node.instances),
          ],
        }
      }
      return {
        file: 'application.yaml',
        lines: [
          L('server:'),
          L('  tomcat:'),
          L(`    threads.max: ${k.threads}`, 'threads'),
          L('spring.datasource.hikari:'),
          L(`  maximum-pool-size: ${k.dbPool}`, 'dbPool'),
          L('downstream.http-client:'),
          L(`  read-timeout-ms: ${k.timeoutMs}`, 'timeoutMs'),
          L(`  retry.max-attempts: ${k.retries}`, 'retries'),
          ...autoscaleLines(node.type, k, node.instances),
          ...(k.maxSteps !== undefined ? [L('agent:'), L(`  max_steps: ${k.maxSteps || 'null  # без лимита'}`, 'maxSteps')] : []),
          ...(node.type === 'worker'
            ? [
                L('# kafka consumer:'),
                L(`partition.assignment.strategy=${k.rebalance === 'cooperative' ? 'CooperativeStickyAssignor' : 'RangeAssignor  # eager'}`, 'rebalance'),
              ]
            : []),
        ],
      }
    case 'kafka':
      return {
        file: 'kafka-topics.sh --describe',
        lines: [
          L('Topic: events  ReplicationFactor: 3'),
          L(`  PartitionCount: ${k.partitions}`, 'partitions'),
          L('  Configs: retention.ms=604800000'),
          L('# консьюмеров в группе не больше партиций'),
          L('# consumer group:'),
          L(`auto.offset.reset=${k.offsetReset}`, 'offsetReset'),
        ],
      }
    default:
      return { file: `${node.type}.conf`, lines: [L(`# ${node.label}: настраиваемых параметров нет`)] }
  }
}
