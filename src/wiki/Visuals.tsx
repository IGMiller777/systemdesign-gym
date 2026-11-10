import { Background, Handle, MarkerType, type Node, type NodeProps, Position, ReactFlow } from '@xyflow/react'
import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { BlockHelp } from '../components/BlockHelp'
import { pickHandles } from '../components/BlockNode'
import { blocks } from '../lib/blocks'
import { autoLayout } from '../sim/layout'
import type { SimGraph } from '../sim/types'
import { getCard, statMeta } from './cards'
import { wikiEntries } from './index'
import type { WikiCard } from './types'

type InfoNodeType = Node<{ label: string; emoji?: string; block?: keyof typeof blocks; focus: boolean }, 'info'>

function InfoNode({ data }: NodeProps<InfoNodeType>) {
  const meta = data.block ? blocks[data.block] : undefined
  const Icon = meta?.icon
  return (
    <div
      className={clsx(
        'flex items-center gap-2 rounded-xl border bg-zinc-900 px-3 py-2 shadow-lg',
        data.focus ? 'border-amber-300 shadow-amber-400/20' : 'border-zinc-700',
      )}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg text-lg" style={{ background: `${meta?.color ?? '#a1a1aa'}22`, color: meta?.color }}>
        {Icon ? <Icon size={18} /> : data.emoji}
      </div>
      <div className="text-sm font-medium text-zinc-100">{data.label}</div>
      {data.block && !data.focus && <BlockHelp block={data.block} />}
      {[Position.Left, Position.Right, Position.Top, Position.Bottom].map((p) => (
        <span key={p}>
          <Handle id={`${p}-s`} type="source" position={p} className="!opacity-0" />
          <Handle id={`${p}-t`} type="target" position={p} className="!opacity-0" />
        </span>
      ))}
    </div>
  )
}

const infoTypes = { info: InfoNode }

/** Animated "typical setup" infographic. The focus node is the component itself. */
export function SetupDiagram({ setup, focusBlock }: { setup: WikiCard['setup']; focusBlock?: string }) {
  const { nodes, edges } = useMemo(() => {
    const pos = autoLayout({ nodes: setup.nodes, edges: setup.edges } as unknown as SimGraph)
    const nodes: InfoNodeType[] = setup.nodes.map((n) => ({
      id: n.id,
      type: 'info',
      position: { x: pos[n.id].x * 1.4, y: pos[n.id].y * 0.9 },
      data: { label: n.label, emoji: n.emoji, block: n.block, focus: !!focusBlock && n.block === focusBlock },
      draggable: false,
    }))
    const edges = setup.edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      ...pickHandles(pos[e.source] ?? { x: 0, y: 0 }, pos[e.target] ?? { x: 0, y: 0 }),
      label: e.label,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#71717a', strokeWidth: 1.5 },
      labelStyle: { fill: '#d4d4d8', fontSize: 11 },
      labelBgStyle: { fill: '#18181b' },
      labelBgPadding: [4, 2] as [number, number],
    }))
    return { nodes, edges }
  }, [setup, focusBlock])

  return (
    <div className="h-72 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={infoTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
        nodesConnectable={false}
        zoomOnScroll={false}
        panOnDrag={false}
        colorMode="dark"
      >
        <Background color="#1f1f23" gap={16} />
      </ReactFlow>
    </div>
  )
}

/** Stats radar with an optional comparison against another component. */
export function StatsRadar({ id, card, color }: { id: string; card: WikiCard; color: string }) {
  const [other, setOther] = useState('')
  const otherCard = other ? getCard(other) : undefined
  const otherTitle = wikiEntries.find((e) => e.id === other)?.title
  const data = statMeta.map((s) => ({ stat: `${s.icon} ${s.label}`, a: card.stats[s.key], b: otherCard?.stats[s.key] ?? 0 }))
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-zinc-300">Характеристики</div>
        <select
          value={other}
          onChange={(e) => setOther(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
        >
          <option value="">Сравнить с…</option>
          {wikiEntries
            .filter((e) => e.id !== id && getCard(e.id))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {getCard(e.id)!.emoji} {e.title}
              </option>
            ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#3f3f46" />
          <PolarAngleAxis dataKey="stat" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
          <PolarRadiusAxis type="number" domain={[0, 5]} allowDataOverflow tickCount={6} tick={false} axisLine={false} />
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} />
          <Radar dataKey="a" name="Этот" stroke={color} fill={color} fillOpacity={0.35} isAnimationActive />
          {otherCard && <Radar dataKey="b" name={otherTitle} stroke="#f472b6" fill="#f472b6" fillOpacity={0.2} />}
        </RadarChart>
      </ResponsiveContainer>
      {otherCard && (
        <div className="flex justify-center gap-4 text-xs">
          <span style={{ color }}>■ этот</span>
          <span className="text-pink-400">■ {otherTitle}</span>
        </div>
      )}
      <div className="mt-1 text-center text-[10px] text-zinc-500">💰 и 🧩: больше — дороже и сложнее в эксплуатации</div>
    </div>
  )
}
