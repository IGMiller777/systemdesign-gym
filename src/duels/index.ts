import { duels as base } from './duels'
import { duelsSec } from './duels-sec'
import { duelsFrontend } from './duels-frontend'
import { duelsLlm } from './duels-llm'

export const allDuels = [...base, ...duelsSec, ...duelsFrontend, ...duelsLlm]
