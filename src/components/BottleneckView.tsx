import { Background, MarkerType, ReactFlow } from '@xyflow/react'
import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useProgress } from '../store'
import type { BottleneckTask, MetricChart } from '../tasks/types'
import { type BlockNodeType, nodeTypes, pickHandles } from './BlockNode'
import { InstantLayout, NextLink } from './InstantViews'
import { Markdown } from './Markdown'
import { Hints, scoreForAttempt, Verdict } from './TaskShell'

const palette = ['#38bdf8', '#f472b6', '#fbbf24', '#4ade80', '#a78bfa']

function Chart({ chart }: { chart: MetricChart }) {
  const data = chart.lines[0].data.map((_, i) => ({
    t: i,
    ...Object.fromEntries(chart.lines.map((l) => [l.name, l.data[i]])),
  }))
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="mb-2 text-sm text-zinc-300">
        {chart.title} <span className="text-zinc-500">({chart.unit})</span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid stroke="#27272a" />
          <XAxis dataKey="t" stroke="#71717a" fontSize={11} tickFormatter={(t) => `${t}м`} />
          <YAxis
            stroke="#71717a"
            fontSize={11}
            width={48}
            tickFormatter={(v: number) => Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(v)}
          />
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {chart.lines.map((l, i) => (
            <Line key={l.name} dataKey={l.name} stroke={palette[i % palette.length]} dot={false} strokeWidth={2} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BottleneckView({ task }: { task: BottleneckTask }) {
  const record = useProgress((s) => s.record)
  const [picked, setPicked] = useState<string | null>(null)
  const [wrong, setWrong] = useState<string[]>([])
  const [done, setDone] = useState<null | { ok: boolean; score: number }>(null)

  const nodes: BlockNodeType[] = useMemo(
    () =>
      task.nodes.map((n) => ({
        id: n.id,
        type: 'block',
        position: { x: n.x, y: n.y },
        data: {
          type: n.type,
          label: n.label,
          mark:
            done && n.id === task.correct
              ? 'correct'
              : wrong.includes(n.id)
                ? 'wrong'
                : n.id === picked
                  ? 'picked'
                  : undefined,
        },
      })),
    [task, picked, wrong, done],
  )
  const edges = useMemo(
    () =>
      task.edges.map((e, i) => ({
        id: `e${i}`,
        source: e.source,
        target: e.target,
        ...pickHandles(task.nodes.find((n) => n.id === e.source)!, task.nodes.find((n) => n.id === e.target)!),
        label: e.label,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#52525b' },
        labelStyle: { fill: '#a1a1aa', fontSize: 11 },
        labelBgStyle: { fill: '#18181b' },
      })),
    [task],
  )

  const check = () => {
    if (!picked || done) return
    if (picked === task.correct) {
      const score = scoreForAttempt(wrong.length)
      record(task.id, score)
      setDone({ ok: true, score })
    } else {
      setWrong([...wrong, picked])
      setPicked(null)
    }
  }

  return (
    <InstantLayout task={task}>
      <div className="h-80 overflow-hidden rounded-xl border border-zinc-800">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, n) => !done && !wrong.includes(n.id) && setPicked(n.id)}
          colorMode="dark"
        >
          <Background color="#27272a" />
        </ReactFlow>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {task.charts.map((c) => (
          <Chart key={c.title} chart={c} />
        ))}
      </div>
      <Hints hints={task.hints} />
      {!done ? (
        <div className="flex items-center gap-3">
          <button
            onClick={check}
            disabled={!picked}
            className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-zinc-950 hover:bg-sky-400 disabled:opacity-40"
          >
            Это узкое место
          </button>
          <span className="text-sm text-zinc-500">
            {picked ? `Выбрано: ${task.nodes.find((n) => n.id === picked)?.label}` : 'Кликни по блоку на схеме'}
          </span>
        </div>
      ) : (
        <Verdict ok={done.ok} score={done.score}>
          <Markdown>{task.explanation}</Markdown>
          <NextLink task={task} />
        </Verdict>
      )}
    </InstantLayout>
  )
}
