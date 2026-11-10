import type { BlockType } from '../tasks/types'

/**
 * Новые блоки — «вкусы» базовых: считаются моделью базового типа со своими цифрами
 * (blockSpecs) и парой отличий (edge кэширует HTML, LLM получает все классы трафика).
 */
export const baseType: Partial<Record<BlockType, BlockType>> = {
  ssr: 'service',
  bff: 'service',
  edge: 'cdn',
  realtime: 'gateway',
  llmgw: 'gateway',
  llm: 'external',
  semcache: 'redis',
  vectordb: 'search',
}
export const baseOf = (t: BlockType): BlockType => baseType[t] ?? t
