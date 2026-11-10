import { memo } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtNum } from './SimNode'
import type { SimGraph, TickResult } from './types'

const axis = { stroke: '#52525b', fontSize: 10 }
const tooltip = { contentStyle: { background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 11 } }
const colors = ['#38bdf8', '#f472b6', '#fbbf24', '#4ade80', '#a78bfa', '#fb923c', '#22d3ee']

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-zinc-800 bg-[#111217] p-2">
      <div className="mb-1 px-1 text-[11px] font-medium text-zinc-400">{title}</div>
      <ResponsiveContainer width="100%" height={110}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}

/** Grafana-style panels over the tick history (last 120 minutes). Memoized: re-renders once per tick. */
export const Dashboard = memo(function Dashboard({
  history,
  graph,
  slo,
  budget,
}: {
  history: TickResult[]
  graph: SimGraph
  slo?: { p99Ms: number; errorRate: number }
  budget?: number
}) {
  const data = history.slice(-120).map((h) => ({
    t: h.t,
    read: Math.round(h.load.read),
    write: Math.round(h.load.write),
    static: Math.round(h.load.static),
    p99: Math.round(h.p99Ms),
    err: +(h.errorRate * 100).toFixed(2),
    cost: Math.round(h.costPerMonth),
    ...Object.fromEntries(Object.values(h.nodes).map((n) => [`u_${n.id}`, Math.round(n.utilization * 100)])),
    ...Object.fromEntries(
      Object.values(h.nodes)
        .filter((n) => n.backlog !== undefined)
        .map((n) => [`b_${n.id}`, Math.round(n.backlog ?? 0)]),
    ),
  }))
  const tracked = graph.nodes.filter((n) => n.type !== 'client')
  const queues = graph.nodes.filter((n) => n.type === 'queue' || n.type === 'kafka')

  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
      <Panel title="Трафик, rps">
        <AreaChart data={data}>
          <CartesianGrid stroke="#1f1f23" />
          <XAxis dataKey="t" {...axis} />
          <YAxis {...axis} width={40} tickFormatter={fmtNum} />
          <Tooltip {...tooltip} />
          <Area dataKey="read" stackId="1" stroke="#38bdf8" fill="#38bdf833" isAnimationActive={false} name="чтение" />
          <Area dataKey="write" stackId="1" stroke="#f472b6" fill="#f472b633" isAnimationActive={false} name="запись" />
          <Area dataKey="static" stackId="1" stroke="#4ade80" fill="#4ade8033" isAnimationActive={false} name="статика" />
        </AreaChart>
      </Panel>
      <Panel title="Latency p99, ms">
        <LineChart data={data}>
          <CartesianGrid stroke="#1f1f23" />
          <XAxis dataKey="t" {...axis} />
          <YAxis {...axis} width={40} tickFormatter={fmtNum} />
          <Tooltip {...tooltip} />
          {slo && <ReferenceLine y={slo.p99Ms} stroke="#f43f5e" strokeDasharray="4 4" />}
          <Line dataKey="p99" stroke="#fbbf24" dot={false} isAnimationActive={false} />
        </LineChart>
      </Panel>
      <Panel title="Ошибки, %">
        <AreaChart data={data}>
          <CartesianGrid stroke="#1f1f23" />
          <XAxis dataKey="t" {...axis} />
          <YAxis {...axis} width={40} />
          <Tooltip {...tooltip} />
          {slo && <ReferenceLine y={slo.errorRate * 100} stroke="#f43f5e" strokeDasharray="4 4" />}
          <Area dataKey="err" stroke="#f43f5e" fill="#f43f5e33" isAnimationActive={false} />
        </AreaChart>
      </Panel>
      <Panel title="Загрузка блоков, %">
        <LineChart data={data}>
          <CartesianGrid stroke="#1f1f23" />
          <XAxis dataKey="t" {...axis} />
          <YAxis {...axis} width={40} domain={[0, (max: number) => Math.max(100, max)]} />
          <Tooltip {...tooltip} />
          <ReferenceLine y={100} stroke="#f43f5e" strokeDasharray="4 4" />
          {tracked.map((n, i) => (
            <Line key={n.id} dataKey={`u_${n.id}`} name={n.label} stroke={colors[i % colors.length]} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </Panel>
      <Panel title="Стоимость, $/мес">
        <LineChart data={data}>
          <CartesianGrid stroke="#1f1f23" />
          <XAxis dataKey="t" {...axis} />
          <YAxis {...axis} width={40} tickFormatter={fmtNum} />
          <Tooltip {...tooltip} />
          {budget && <ReferenceLine y={budget} stroke="#f43f5e" strokeDasharray="4 4" />}
          <Line dataKey="cost" stroke="#4ade80" dot={false} isAnimationActive={false} type="stepAfter" />
        </LineChart>
      </Panel>
      <Panel title="Очереди: backlog, сообщений">
        <LineChart data={data}>
          <CartesianGrid stroke="#1f1f23" />
          <XAxis dataKey="t" {...axis} />
          <YAxis {...axis} width={40} tickFormatter={fmtNum} />
          <Tooltip {...tooltip} />
          {queues.map((n, i) => (
            <Line key={n.id} dataKey={`b_${n.id}`} name={n.label} stroke={colors[(i + 2) % colors.length]} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </Panel>
    </div>
  )
})
