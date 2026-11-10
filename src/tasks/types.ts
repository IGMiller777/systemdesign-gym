export type Topic =
  | 'estimation'
  | 'postgres'
  | 'cache'
  | 'queues'
  | 'storage'
  | 'networking'
  | 'search'
  | 'analytics'
  | 'reliability'
  | 'frontend'
  | 'llm'

export type BlockType =
  | 'client'
  | 'cdn'
  | 'lb'
  | 'gateway'
  | 'service'
  | 'worker'
  | 'postgres'
  | 'replica'
  | 'redis'
  | 'queue'
  | 'kafka'
  | 's3'
  | 'search'
  | 'clickhouse'
  | 'external'
  // Frontend
  | 'ssr'
  | 'bff'
  | 'edge'
  | 'realtime'
  // LLM systems
  | 'llm'
  | 'llmgw'
  | 'semcache'
  | 'vectordb'

export interface DiagramNode {
  id: string
  type: BlockType
  label: string
  x: number
  y: number
}

export interface DiagramEdge {
  source: string
  target: string
  label?: string
}

interface BaseTask {
  id: string
  title: string
  level: 1 | 2 | 3 | 4 | 5 | 6
  topic: Topic
  xp: number
  /** Markdown statement of the task. */
  prompt: string
  /** Markdown shown after submit: the reasoning behind the answer. */
  explanation: string
  hints?: string[]
}

/** Level 1: back-of-envelope estimate, checked instantly. */
export interface EstimateTask extends BaseTask {
  kind: 'estimate'
  answer: number
  unit: string
  /** Accepted if answer/factor <= input <= answer*factor. */
  factor: number
}

/** Level 2: pick the right building block / approach. */
export interface ChoiceTask extends BaseTask {
  kind: 'choice'
  multiple?: boolean
  options: { id: string; label: string; why: string }[]
  correct: string[]
}

export interface MetricChart {
  title: string
  unit: string
  /** One value per minute. */
  lines: { name: string; data: number[] }[]
}

/** Level 3: find the failing component from a diagram + metrics. */
export interface BottleneckTask extends BaseTask {
  kind: 'bottleneck'
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  charts: MetricChart[]
  correct: string
}

/** Levels 4–6: free-form design on a canvas, graded by an LLM against a rubric. */
export interface DesignTask extends BaseTask {
  kind: 'design'
  requirements: string[]
  starter?: { nodes: DiagramNode[]; edges: DiagramEdge[] }
  rubric: string[]
  /** Markdown reference solution, shown after grading. */
  reference: string
}

export type Task = EstimateTask | ChoiceTask | BottleneckTask | DesignTask
