import { Handle, type Node, type NodeProps, Position } from '@xyflow/react'
import clsx from 'clsx'
import { BlockHelp } from '../components/BlockHelp'
import { blocks } from '../lib/blocks'
import type { NodeMetrics, SimNodeConfig } from './types'

export type SimNodeData = { cfg: SimNodeConfig; m?: NodeMetrics; xray?: boolean }
export type SimNodeType = Node<SimNodeData, 'sim'>

const statusStyle: Record<string, string> = {
  ok: 'border-emerald-500/40',
  hot: 'border-amber-400 shadow-amber-500/20',
  overloaded: 'border-rose-500 shadow-rose-500/40 animate-pulse',
  down: 'border-zinc-600 opacity-50 grayscale',
  warming: 'border-sky-400 border-dashed',
}

const barColor = (u: number) => (u >= 1 ? 'bg-rose-500' : u >= 0.7 ? 'bg-amber-400' : 'bg-emerald-400')

export const fmtNum = (n: number) => Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

const sides = [Position.Top, Position.Right, Position.Bottom, Position.Left]

export function SimNode({ data, selected }: NodeProps<SimNodeType>) {
  const { cfg, m, xray } = data
  const meta = blocks[cfg.type]
  const Icon = meta.icon
  const u = m?.utilization ?? 0
  return (
    <div
      className={clsx(
        'w-44 rounded-xl border-2 bg-zinc-900 p-2 shadow-lg transition-colors',
        m ? statusStyle[m.status] : 'border-zinc-700',
        selected && 'ring-2 ring-white/70',
        xray && 'ring-4 ring-violet-400 ring-offset-2 ring-offset-zinc-950',
      )}
    >
      {xray && <div className="mb-1 rounded bg-violet-500/20 px-1.5 py-0.5 text-center text-[10px] font-medium text-violet-200">🧭 узкое место</div>}
      <div className="flex items-center gap-2">
        <div className="rounded-lg p-1" style={{ background: `${meta.color}22`, color: meta.color }}>
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-xs font-medium text-zinc-100">{cfg.label}</div>
          <div className="text-[10px] text-zinc-500">
            {meta.label}, {m?.instances ?? cfg.instances}× {cfg.size}
            {cfg.zone && cfg.zone !== 'a' && <span className="ml-1 rounded bg-zinc-800 px-1 text-zinc-300">зона {cfg.zone.toUpperCase()}</span>}
            {m?.paused && <span className="ml-1 text-amber-300">пауза</span>}
          </div>
        </div>
        <BlockHelp block={cfg.type} />
      </div>
      {cfg.type !== 'client' && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div className={clsx('h-full transition-all', barColor(u))} style={{ width: `${Math.min(100, u * 100)}%` }} />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-zinc-400">
            <span>{m ? `${fmtNum(m.rps)} rps` : '—'}</span>
            <span>{m ? `${Math.round(u * 100)}%` : ''}</span>
            <span>{m ? `${fmtNum(m.latencyMs)}ms` : ''}</span>
          </div>
          {m && (m.errorRate > 0.001 || (m.backlog ?? 0) > 0 || (m.lagSec ?? 0) > 1) && (
            <div className="mt-1 flex gap-2 font-mono text-[10px]">
              {m.errorRate > 0.001 && <span className="text-rose-400">err {(m.errorRate * 100).toFixed(0)}%</span>}
              {(m.backlog ?? 0) > 0 && <span className="text-amber-300">очередь {fmtNum(m.backlog!)}</span>}
              {(m.lagSec ?? 0) > 1 && <span className="text-amber-300">лаг {fmtNum(m.lagSec!)}с</span>}
            </div>
          )}
        </>
      )}
      {m?.status === 'warming' && <div className="mt-1 text-[10px] text-sky-300">прогрев…</div>}
      {m?.status === 'down' && <div className="mt-1 text-[10px] font-semibold text-rose-400">DOWN</div>}
      {sides.map((p) => (
        <Handle key={`${p}-s`} id={`${p}-s`} type="source" position={p} className="!h-2 !w-2 !border-zinc-950 !bg-zinc-500" />
      ))}
      {sides.map((p) => (
        <Handle key={`${p}-t`} id={`${p}-t`} type="target" position={p} className="!h-2 !w-2 !opacity-0" />
      ))}
    </div>
  )
}

export const simNodeTypes = { sim: SimNode }
