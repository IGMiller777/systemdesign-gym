import type { SimGraph } from './types'

export type Positions = Record<string, { x: number; y: number }>

/** Layered left→right layout by longest distance from sources. */
export function autoLayout(graph: SimGraph): Positions {
  const depth: Record<string, number> = {}
  const incoming = new Set(graph.edges.map((e) => e.target))
  const roots = graph.nodes.filter((n) => !incoming.has(n.id)).map((n) => n.id)
  const queue = roots.map((id) => ({ id, d: 0 }))
  while (queue.length) {
    const { id, d } = queue.shift()!
    if ((depth[id] ?? -1) >= d || d > graph.nodes.length) continue
    depth[id] = d
    for (const e of graph.edges) if (e.source === id) queue.push({ id: e.target, d: d + 1 })
  }
  const columns: Record<number, string[]> = {}
  for (const n of graph.nodes) (columns[depth[n.id] ?? 0] ??= []).push(n.id)
  const pos: Positions = {}
  for (const [d, ids] of Object.entries(columns))
    ids.forEach((id, i) => (pos[id] = { x: Number(d) * 240, y: (i - (ids.length - 1) / 2) * 130 }))
  return pos
}
