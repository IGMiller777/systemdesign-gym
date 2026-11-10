import { GLOSSARY } from './glossary'

/**
 * Wraps the first mention of each glossary abbreviation in a markdown block into <abbr data-term>.
 * A term in **bold** counts as defined right there and gets no tooltip. Code, links and headings are left alone.
 */
interface Node {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: Node[]
}

const keys = Object.keys(GLOSSARY).filter((k) => !GLOSSARY[k].known).sort((a, b) => b.length - a.length)
const re = new RegExp(`(?<![\\p{L}\\p{N}_/.\\-])(${keys.join('|')})(?![\\p{L}\\p{N}_])`, 'gu')
const SKIP = new Set(['code', 'pre', 'a', 'abbr', 'h1', 'h2', 'h3', 'h4'])

export function rehypeTerms() {
  return (tree: Node) => {
    const seen = new Set<string>()
    const walk = (n: Node) => {
      if (n.type === 'element' && SKIP.has(n.tagName!)) return
      if (n.type === 'element' && n.tagName === 'strong') {
        for (const m of textOf(n).matchAll(re)) seen.add(m[1])
        return
      }
      if (!n.children) return
      n.children = n.children.flatMap((c) => {
        if (c.type !== 'text') {
          walk(c)
          return [c]
        }
        const out: Node[] = []
        let last = 0
        for (const m of c.value!.matchAll(re)) {
          if (seen.has(m[1])) continue
          seen.add(m[1])
          if (m.index > last) out.push({ type: 'text', value: c.value!.slice(last, m.index) })
          out.push({ type: 'element', tagName: 'abbr', properties: { dataTerm: m[1] }, children: [{ type: 'text', value: m[1] }] })
          last = m.index + m[1].length
        }
        if (!out.length) return [c]
        if (last < c.value!.length) out.push({ type: 'text', value: c.value!.slice(last) })
        return out
      })
    }
    walk(tree)
  }
}

const textOf = (n: Node): string => n.value ?? (n.children ?? []).map(textOf).join('')
