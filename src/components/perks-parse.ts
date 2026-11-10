/**
 * «На вашем проекте» as game items from a ```perks block: what each upgrade gives and takes.
 *
 *   HTTP/2 | upgrade            item: name | tier (upgrade = strictly better, tradeoff, trap)
 *   + одно соединение вместо 6  gives
 *   - потеря пакета тормозит все потоки   takes
 *   ! хаки под HTTP/1.1 начинают мешать   comment
 *                                         blank line between items
 */
export const TIERS = {
  upgrade: { label: '⬆ следующий ранг', hint: 'лучше во всём' },
  tradeoff: { label: '⚖ компромисс', hint: 'даёт и отнимает' },
  trap: { label: '⚠ ловушка', hint: 'ограничение, о котором стоит помнить' },
} as const
export type Tier = keyof typeof TIERS

export interface Perk { name: string; tier: Tier; lines: { sign: '+' | '-' | '!'; text: string }[] }

export function parsePerks(src: string): Perk[] {
  const items: Perk[] = []
  for (const block of src.trim().split(/\n\s*\n/)) {
    const [head, ...rest] = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const m = head.match(/^(.+?)\s*\|\s*([a-z]+)$/)
    if (!m) throw new Error(`первая строка предмета: «название | ${Object.keys(TIERS).join('/')}», а не «${head}»`)
    if (!(m[2] in TIERS)) throw new Error(`неизвестный ранг «${m[2]}»`)
    const lines = rest.map((l) => {
      const s = l.match(/^([+\-!])\s*(.+)$/)
      if (!s) throw new Error(`строка «${l}»: нужно начать с +, - или !`)
      return { sign: s[1] as '+' | '-' | '!', text: s[2] }
    })
    if (!lines.length) throw new Error(`у «${m[1]}» нет ни одной строки`)
    items.push({ name: m[1], tier: m[2] as Tier, lines })
  }
  return items
}
