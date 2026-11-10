import type { BlockType } from '../tasks/types'
import { wikiEntries as base } from './entries'
import { vectorEntry } from './entry-vector'
import { frontendEntries } from './frontend-wiki'
import { llmEntries } from './llm-wiki'
import type { WikiCategory, WikiEntry } from './types'

export const wikiEntries: WikiEntry[] = [...base, vectorEntry, ...frontendEntries, ...llmEntries]
export type { WikiEntry, WikiCategory }

export const wikiCategories: Record<WikiCategory, string> = {
  edge: 'Периметр (DNS, CDN, защита)',
  traffic: 'Трафик и балансировка',
  compute: 'Вычисления и платформа',
  database: 'Базы данных',
  cache: 'Кэши',
  messaging: 'Очереди и потоки событий',
  storage: 'Хранилища файлов',
  'search-analytics': 'Поиск и аналитика',
  coordination: 'Координация и discovery',
  observability: 'Наблюдаемость',
  frontend: 'Фронтенд-архитектура',
  ai: 'LLM-системы',
}

const byId = new Map(wikiEntries.map((e) => [e.id, e]))

export function getEntry(id: string): WikiEntry | undefined {
  return byId.get(id)
}

export function entryByBlock(block: BlockType): WikiEntry | undefined {
  return wikiEntries.find((e) => e.block === block)
}
