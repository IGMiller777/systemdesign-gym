import {
  Background,
  type Connection,
  ConnectionMode,
  Controls,
  type Edge,
  MarkerType,
  type NodeChange,
  ReactFlow,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import { memo, useEffect, useMemo, useRef } from 'react'
import { pickHandles } from '../components/BlockNode'
import { autoLayout } from './layout'
import { simNodeTypes, type SimNodeType } from './SimNode'
import type { NodeMetrics, SimGraph } from './types'

interface Props {
  graph: SimGraph
  metrics?: Record<string, NodeMetrics>
  running: boolean
  onSelect: (id: string | null) => void
  onConnect: (c: Connection) => void
  onDeleteNode: (id: string) => void
  onDeleteEdge: (source: string, target: string) => void
  /** X-ray perk: node id to highlight as the main bottleneck. */
  xray?: string
}

/**
 * Canvas owns node positions, so dragging only re-renders React Flow,
 * not the dashboard and sidebar. Metrics are pushed in once per tick.
 */
export const SimCanvas = memo(function SimCanvas({
  graph,
  metrics,
  running,
  onSelect,
  onConnect,
  onDeleteNode,
  onDeleteEdge,
  xray,
}: Props) {
  const { screenToFlowPosition } = useReactFlow()
  const initial = useRef(autoLayout(graph))
  const [nodes, setNodes, onNodesChange] = useNodesState<SimNodeType>(
    graph.nodes.map((cfg) => ({
      id: cfg.id,
      type: 'sim',
      position: initial.current[cfg.id] ?? { x: 0, y: 0 },
      data: { cfg, m: metrics?.[cfg.id], xray: cfg.id === xray },
    })),
  )

  // Sync config/metrics into nodes, keeping positions; new nodes appear near the viewport center.
  useEffect(() => {
    setNodes((prev) =>
      graph.nodes.map((cfg) => {
        const old = prev.find((p) => p.id === cfg.id)
        const m = metrics?.[cfg.id]
        const x = cfg.id === xray
        if (old && old.data.cfg === cfg && old.data.m === m && old.data.xray === x) return old
        const position =
          old?.position ??
          (() => {
            const c = screenToFlowPosition({ x: window.innerWidth * 0.4, y: window.innerHeight * 0.35 })
            return { x: c.x + Math.random() * 60, y: c.y + Math.random() * 60 }
          })()
        return { ...old, id: cfg.id, type: 'sim', position, data: { cfg, m, xray: x } }
      }),
    )
  }, [graph, metrics, xray, setNodes, screenToFlowPosition])

  const posKey = nodes.map((n) => `${n.id}:${Math.round(n.position.x / 40)}:${Math.round(n.position.y / 40)}`).join('|')
  const edges: Edge[] = useMemo(() => {
    const pos = Object.fromEntries(nodes.map((n) => [n.id, n.position]))
    return graph.edges.map((e) => {
      const flow = metrics?.[e.target]?.rps ?? 0
      const bad = (metrics?.[e.target]?.utilization ?? 0) >= 1
      return {
        id: `${e.source}->${e.target}`,
        source: e.source,
        target: e.target,
        ...pickHandles(pos[e.source] ?? { x: 0, y: 0 }, pos[e.target] ?? { x: 0, y: 0 }),
        animated: running && flow > 0,
        markerEnd: { type: MarkerType.ArrowClosed, color: bad ? '#f43f5e' : '#71717a' },
        style: { stroke: bad ? '#f43f5e' : '#71717a', strokeWidth: 1 + Math.min(5, Math.log10(1 + flow)) },
      }
    })
    // posKey: recompute handles only when a node moves noticeably, not every drag pixel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.edges, metrics, running, posKey])

  const handleNodesChange = (changes: NodeChange<SimNodeType>[]) => {
    for (const c of changes) if (c.type === 'remove') onDeleteNode(c.id)
    onNodesChange(changes.filter((c) => c.type !== 'remove'))
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={simNodeTypes}
      connectionMode={ConnectionMode.Loose}
      onConnect={onConnect}
      onNodesChange={handleNodesChange}
      onEdgesChange={(changes) =>
        changes.forEach((c) => {
          if (c.type !== 'remove') return
          const [source, target] = c.id.split('->')
          onDeleteEdge(source, target)
        })
      }
      onNodeClick={(_, n) => onSelect(n.id)}
      onPaneClick={() => onSelect(null)}
      fitView
      fitViewOptions={{ maxZoom: 1, padding: 0.25 }}
      colorMode="dark"
      onlyRenderVisibleElements
    >
      <Background color="#27272a" gap={20} />
      <Controls />
    </ReactFlow>
  )
})
