import type { Scenario, SimGraph } from './sim/types'

/**
 * Optional private pack with your real company architecture.
 * Lives in src/company/*.ts, which is gitignored: internal data never gets committed.
 * Without the folder the "Моя компания" section simply doesn't appear.
 */
export interface CompanyPack {
  name: string
  /** One paragraph: what the company does, shown above the scenarios. */
  about: string
  sandbox: SimGraph
  scenarios: Scenario[]
}

const mods = import.meta.glob<{ companyPack: CompanyPack }>('./company/*.ts', { eager: true })

export const companyPack: CompanyPack | undefined = Object.values(mods)[0]?.companyPack
