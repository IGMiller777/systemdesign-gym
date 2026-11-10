import {
  Archive,
  Bot,
  Brain,
  Layers,
  Radio,
  Route,
  ScanSearch,
  SquareStack,
  Waypoints,
  ChartColumn,
  Cloud,
  Cog,
  Database,
  DatabaseBackup,
  Globe,
  Inbox,
  type LucideIcon,
  Monitor,
  ScrollText,
  Search,
  Server,
  Shield,
  Split,
  Zap,
} from 'lucide-react'
import type { BlockType, Topic } from '../tasks/types'

export const blocks: Record<BlockType, { label: string; icon: LucideIcon; color: string }> = {
  client: { label: 'Клиент', icon: Monitor, color: '#a1a1aa' },
  cdn: { label: 'CDN', icon: Globe, color: '#38bdf8' },
  lb: { label: 'Балансер', icon: Split, color: '#22d3ee' },
  gateway: { label: 'API Gateway', icon: Shield, color: '#2dd4bf' },
  service: { label: 'Сервис', icon: Server, color: '#818cf8' },
  worker: { label: 'Воркер', icon: Cog, color: '#a78bfa' },
  postgres: { label: 'Postgres', icon: Database, color: '#60a5fa' },
  replica: { label: 'Реплика', icon: DatabaseBackup, color: '#93c5fd' },
  redis: { label: 'Redis', icon: Zap, color: '#f87171' },
  queue: { label: 'RabbitMQ', icon: Inbox, color: '#fb923c' },
  kafka: { label: 'Kafka', icon: ScrollText, color: '#fbbf24' },
  s3: { label: 'S3', icon: Archive, color: '#4ade80' },
  search: { label: 'Elasticsearch', icon: Search, color: '#facc15' },
  clickhouse: { label: 'ClickHouse', icon: ChartColumn, color: '#fde047' },
  external: { label: 'Внешний API', icon: Cloud, color: '#d4d4d8' },
  ssr: { label: 'SSR-сервер', icon: Layers, color: '#c084fc' },
  bff: { label: 'BFF', icon: Waypoints, color: '#a5b4fc' },
  edge: { label: 'Edge / ISR', icon: SquareStack, color: '#67e8f9' },
  realtime: { label: 'WebSocket-шлюз', icon: Radio, color: '#34d399' },
  llm: { label: 'LLM API', icon: Brain, color: '#f0abfc' },
  llmgw: { label: 'LLM-шлюз', icon: Route, color: '#e879f9' },
  semcache: { label: 'Семантический кэш', icon: Bot, color: '#fda4af' },
  vectordb: { label: 'Векторная БД', icon: ScanSearch, color: '#fcd34d' },
}

export const topics: Record<Topic, string> = {
  estimation: 'Оценки',
  postgres: 'Postgres',
  cache: 'Кэш',
  queues: 'Очереди',
  storage: 'Хранилища',
  networking: 'Сеть',
  search: 'Поиск',
  analytics: 'Аналитика',
  reliability: 'Надёжность',
  frontend: 'Фронтенд',
  llm: 'LLM-системы',
}

export const levels: Record<number, { name: string; color: string }> = {
  1: { name: 'Оценка', color: 'text-emerald-400 bg-emerald-400/10' },
  2: { name: 'Выбор', color: 'text-sky-400 bg-sky-400/10' },
  3: { name: 'Узкое место', color: 'text-violet-400 bg-violet-400/10' },
  4: { name: 'Инцидент', color: 'text-amber-400 bg-amber-400/10' },
  5: { name: 'Дизайн', color: 'text-orange-400 bg-orange-400/10' },
  6: { name: 'Босс', color: 'text-rose-400 bg-rose-400/10' },
}

export const ranks = [
  { name: 'Intern', xp: 0 },
  { name: 'Junior', xp: 100 },
  { name: 'Middle', xp: 300 },
  { name: 'Senior', xp: 700 },
  { name: 'Staff', xp: 1300 },
  { name: 'Principal', xp: 2000 },
]

export function rankOf(xp: number) {
  const i = ranks.findLastIndex((r) => xp >= r.xp)
  return { current: ranks[i], next: ranks[i + 1] as (typeof ranks)[number] | undefined }
}
