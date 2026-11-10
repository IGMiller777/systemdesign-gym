import { conceptsA } from './concepts-1'
import { conceptsB } from './concepts-2'
import { conceptsSec } from './concepts-sec'
import { conceptsOps } from './concepts-ops'
import { conceptsOps2 } from './concepts-ops2'
import { conceptsFrontend } from './concepts-frontend'
import { conceptsLlm } from './concepts-llm'
import type { Concept } from './types'

export const concepts: Concept[] = [...conceptsA, ...conceptsB, ...conceptsSec, ...conceptsOps, ...conceptsOps2, ...conceptsFrontend, ...conceptsLlm]
export const getConcept = (id: string) => concepts.find((c) => c.id === id)
export const conceptKey = (id: string) => `concept:${id}`
