/** Реальные «крутилки» конфигурации блоков: дефолты и описания для UI. */
import type { BlockType } from '../tasks/types'
import { baseOf } from './flavors'
import type { Knobs } from './types'

/** Значения по умолчанию для типа блока (то, что стоит «из коробки»). */
export function knobDefaults(type: BlockType): Knobs {
  switch (baseOf(type)) {
    case 'service':
      return { retries: 0, timeoutMs: 2000, threads: 200, dbPool: 20, autoscale: 'off', autoscaleMax: 10 }
    case 'worker':
      return { retries: 0, timeoutMs: 2000, threads: 200, dbPool: 20, autoscale: 'off', autoscaleMax: 10, rebalance: 'eager' }
    case 'postgres':
      return { maxConnections: 500, indexed: true }
    case 'redis':
      return { ttlSec: 300, evictionPolicy: 'allkeys-lru' }
    case 'cdn':
      return { ttlSec: 3600 }
    case 'lb':
      return { ttlSec: 0 }
    case 'kafka':
      return { partitions: 12, offsetReset: 'earliest' }
    default:
      return {}
  }
}

/** Настройки узла с подставленными дефолтами (undefined в knobs не затирает дефолт). */
export function knobsOf(n: { type: BlockType; knobs?: Knobs }): Knobs {
  const out: Record<string, unknown> = { ...knobDefaults(n.type) }
  for (const [k, v] of Object.entries(n.knobs ?? {})) if (v !== undefined) out[k] = v
  return out as Knobs
}

export interface KnobMeta {
  label: string
  hint: string
  kind: 'number' | 'bool' | 'select'
  min?: number
  max?: number
  step?: number
  options?: string[]
  unit?: string
  appliesTo: BlockType[]
  /** Show only on nodes whose scenario sets this knob explicitly (niche settings). */
  onlyIfSet?: boolean
}

export const knobMeta: Record<keyof Knobs, KnobMeta> = {
  retries: {
    label: 'Ретраи', kind: 'number', min: 0, max: 5, step: 1, appliesTo: ['service', 'worker'],
    hint: 'Сколько раз повторять упавший вызов зависимости. Слишком мало — сбои видны пользователю; слишком много — при перегрузке зависимости ретраи множат нагрузку и добивают её (retry storm).',
  },
  timeoutMs: {
    label: 'Таймаут вызова', kind: 'number', min: 100, max: 60000, step: 100, unit: 'мс', appliesTo: ['service', 'worker'],
    hint: 'Сколько ждём ответ зависимости. Слишком короткий — ложные ошибки на медленных, но живых вызовах; слишком длинный — потоки висят на медленной зависимости, и сервис целиком перестаёт отвечать.',
  },
  threads: {
    label: 'Потоки на инстанс', kind: 'number', min: 10, max: 2000, step: 10, appliesTo: ['service', 'worker'],
    hint: 'Размер пула потоков (одновременных запросов) на инстанс. Мало — упрёмся в пул раньше CPU; много — больше памяти и переключений контекста, а медленная зависимость всё равно съест любой пул.',
  },
  dbPool: {
    label: 'Пул соединений с БД', kind: 'number', min: 1, max: 200, step: 1, appliesTo: ['service', 'worker'],
    hint: 'Соединений к Postgres на инстанс. Мало — запросы ждут свободное соединение (pool exhaustion); много — сумма по всем инстансам превысит max_connections и БД начнёт отбивать подключения.',
  },
  maxConnections: {
    label: 'max_connections', kind: 'number', min: 20, max: 5000, step: 10, appliesTo: ['postgres'],
    hint: 'Лимит соединений Postgres. Мало — клиенты получают «too many connections»; много — на каждое соединение процесс и память, после ~300 БД медленнее из-за переключений контекста.',
  },
  indexed: {
    label: 'Индекс на горячем запросе', kind: 'bool', appliesTo: ['postgres'],
    hint: 'Покрыт ли частый запрос индексом. Без индекса каждое чтение — полный скан и стоит как ~8 обычных, БД быстро упирается в CPU.',
  },
  ttlSec: {
    label: 'TTL кэша', kind: 'number', min: 0, max: 86400, step: 10, unit: 'с', appliesTo: ['redis', 'cdn', 'lb'],
    hint: 'Сколько живёт запись в кэше. Мало — низкий hit ratio и поток промахов в БД (0 = кэш выключен); много — выше hit ratio, но пользователи дольше видят устаревшие данные.',
  },
  evictionPolicy: {
    label: 'maxmemory-policy', kind: 'select', options: ['allkeys-lru', 'noeviction'], appliesTo: ['redis'],
    hint: 'Что делает Redis при нехватке памяти. noeviction — память заполняется и новые ключи не сохраняются (hit ratio падает); allkeys-lru вытесняет старые ключи и держит кэш полезным.',
  },
  partitions: {
    label: 'Партиции топика', kind: 'number', min: 1, max: 100, step: 1, appliesTo: ['kafka'],
    hint: 'Число партиций определяет максимум параллельных консьюмеров. Мало — лишние воркеры простаивают и lag растёт; много — больше накладных расходов брокеров и дольше ребаланс.',
  },
  autoscale: {
    label: 'Автоскейлер', kind: 'select', options: ['off', 'cpu', 'queue'], appliesTo: ['service', 'worker'],
    hint: 'off — число инстансов фиксировано. cpu (HPA) — по загрузке CPU: консьюмер, который ждёт внешний API, почти не грузит CPU, и такой скейлер не реагирует, пока очередь растёт. queue (KEDA) — по лагу очереди/Kafka: масштабирует именно тогда, когда копится бэклог.',
  },
  autoscaleMax: {
    label: 'Автоскейлер: максимум', kind: 'number', min: 1, max: 50, step: 1, appliesTo: ['service', 'worker'],
    hint: 'Верхняя граница инстансов (maxReplicas). Мало — под пиком упрёмся в потолок; много — счёт за облако и риск задавить БД соединениями; для Kafka больше партиций бесполезно.',
  },
  rebalance: {
    label: 'Ребаланс группы', kind: 'select', options: ['eager', 'cooperative'], appliesTo: ['worker'],
    hint: 'Протокол распределения партиций консьюмер-группы. eager — при любой смене состава (деплой, рестарт, автоскейл) встаёт ВСЯ группа, и чем она больше, тем дольше пауза; cooperative — переезжают только затронутые партиции, остальные работают.',
  },
  maxSteps: {
    label: 'Лимит шагов агента', kind: 'number', min: 0, max: 50, step: 1, appliesTo: ['worker', 'service'], onlyIfSet: true,
    hint: 'Сколько вызовов LLM агент может сделать на одну задачу (0 — без лимита). Обычная задача укладывается в ~3 шага. Без лимита зациклившийся агент жжёт токены, пока его не остановят; слишком жёсткий лимит обрывает и нормальные задачи.',
  },
  offsetReset: {
    label: 'auto.offset.reset', kind: 'select', options: ['earliest', 'latest'], appliesTo: ['kafka'],
    hint: 'Откуда группа читает, если смещение потеряно или устарело. earliest — с начала, ничего не теряем, но лаг придётся разбирать; latest — с конца: бэклог пропускается молча, то есть это потеря данных.',
  },
}
