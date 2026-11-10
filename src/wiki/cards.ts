import { cardsA } from './cards-a'
import { cardsB } from './cards-b'
import { vectorCard } from './card-vector'
import { frontendCards } from './frontend-wiki'
import { llmCards } from './llm-wiki'
import type { Rarity, WikiCard } from './types'

export const cards: Record<string, WikiCard> = { ...cardsA, ...cardsB, 'vector-db': vectorCard, ...frontendCards, ...llmCards }

export const getCard = (id: string): WikiCard | undefined => cards[id]

export const rarityMeta: Record<Rarity, { label: string; ring: string; glow: string; text: string; order: number }> = {
  common: { label: 'Обычная', ring: 'from-zinc-500 to-zinc-700', glow: 'shadow-zinc-500/10', text: 'text-zinc-300', order: 0 },
  rare: { label: 'Редкая', ring: 'from-sky-400 to-blue-700', glow: 'shadow-sky-500/20', text: 'text-sky-300', order: 1 },
  epic: { label: 'Эпическая', ring: 'from-fuchsia-400 to-violet-700', glow: 'shadow-violet-500/25', text: 'text-violet-300', order: 2 },
  legendary: { label: 'Легендарная', ring: 'from-amber-300 via-orange-400 to-amber-700', glow: 'shadow-amber-400/30', text: 'text-amber-300', order: 3 },
}

export const statMeta = [
  { key: 'speed', label: 'Скорость', icon: '⚡' },
  { key: 'scale', label: 'Масштаб', icon: '📈' },
  { key: 'reliability', label: 'Надёжность', icon: '🛡️' },
  { key: 'cost', label: 'Цена', icon: '💰' },
  { key: 'complexity', label: 'Сложность', icon: '🧩' },
] as const

export const CARD_XP = 20
export const cardKey = (id: string) => `card:${id}`
