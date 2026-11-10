import { Handle, type Node, type NodeProps, Position } from '@xyflow/react'
import clsx from 'clsx'
import { blocks } from '../lib/blocks'
import { BlockHelp } from './BlockHelp'
import type { BlockType } from '../tasks/types'

export type BlockNodeData = {
  type: BlockType
  label: string
  mark?: 'picked' | 'correct' | 'wrong'
}

export type BlockNodeType = Node<BlockNodeData, 'block'>

const sides = [Position.Top, Position.Right, Position.Bottom, Position.Left]

export function BlockNode({ data, selected }: NodeProps<BlockNodeType>) {
  const meta = blocks[data.type]
  const Icon = meta.icon
  return (
    <div
      className={clsx(
        'flex min-w-32 items-center gap-2 rounded-xl border bg-zinc-900 px-3 py-2 shadow-lg transition',
        selected ? 'border-white/60' : 'border-zinc-700',
        data.mark === 'picked' && 'ring-2 ring-sky-400',
        data.mark === 'correct' && 'ring-2 ring-emerald-400',
        data.mark === 'wrong' && 'ring-2 ring-rose-500',
      )}
    >
      <div className="rounded-lg p-1.5" style={{ background: `${meta.color}22`, color: meta.color }}>
        <Icon size={18} />
      </div>
      <div className="leading-tight">
        <div className="text-[10px] text-zinc-500">{meta.label}</div>
        <div className="text-sm font-medium text-zinc-100">{data.label}</div>
      </div>
      <BlockHelp block={data.type} />
      {sides.map((p) => (
        <Handle key={`${p}-s`} id={`${p}-s`} type="source" position={p} className="!h-2 !w-2 !border-zinc-950 !bg-zinc-500" />
      ))}
      {sides.map((p) => (
        <Handle key={`${p}-t`} id={`${p}-t`} type="target" position={p} className="!h-2 !w-2 !opacity-0" />
      ))}
    </div>
  )
}

export const nodeTypes = { block: BlockNode }

/** Pick facing sides for an edge between two preset diagram nodes. */
export function pickHandles(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const [out, inn] =
    Math.abs(dx) >= Math.abs(dy)
      ? dx >= 0
        ? [Position.Right, Position.Left]
        : [Position.Left, Position.Right]
      : dy >= 0
        ? [Position.Bottom, Position.Top]
        : [Position.Top, Position.Bottom]
  return { sourceHandle: `${out}-s`, targetHandle: `${inn}-t` }
}
