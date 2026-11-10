import {
  addEdge,
  Background,
  type Connection,
  ConnectionMode,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import clsx from 'clsx'
import { Check, ChevronDown, LoaderCircle, Minus, Send, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { blocks } from '../lib/blocks'
import { useProgress } from '../store'
import type { BlockType, DesignTask, DiagramEdge, DiagramNode } from '../tasks/types'
import { type BlockNodeType, nodeTypes, pickHandles } from './BlockNode'
import { NextLink } from './InstantViews'
import { Markdown } from './Markdown'
import { Hints, TaskHeader } from './TaskShell'

const steps = [
  { key: 'Требования', hint: 'Функциональные и нефункциональные: что делает система, какие SLA, что вне скоупа.' },
  { key: 'Оценка нагрузки', hint: 'RPS чтения/записи, объём данных в год, пиковые коэффициенты.' },
  { key: 'API', hint: 'Основные эндпоинты: метод, путь, вход/выход.' },
  { key: 'Модель данных', hint: 'Сущности, ключи, индексы, где что хранится и почему.' },
  { key: 'Схема', hint: 'Пояснения к схеме справа: поток запроса, зачем каждый блок.' },
  { key: 'Deep dives', hint: 'Узкие места, отказы, консистентность, масштабирование, компромиссы.' },
]

interface Grade {
  score: number
  verdict: string
  criteria: { criterion: string; status: 'met' | 'partial' | 'missed'; comment: string }[]
  strengths: string[]
  issues: string[]
  followUp: string
}

const edgeDefaults = {
  markerEnd: { type: MarkerType.ArrowClosed },
  style: { stroke: '#71717a' },
  labelStyle: { fill: '#d4d4d8', fontSize: 11 },
  labelBgStyle: { fill: '#18181b' },
}

const toFlowNodes = (nodes: DiagramNode[]): BlockNodeType[] =>
  nodes.map((n) => ({ id: n.id, type: 'block', position: { x: n.x, y: n.y }, data: { type: n.type, label: n.label } }))

type DraftEdge = DiagramEdge & { id?: string; sourceHandle?: string | null; targetHandle?: string | null }

const toFlowEdges = (edges: DraftEdge[], nodes: DiagramNode[]): Edge[] =>
  edges.map((e, i) => {
    const from = nodes.find((n) => n.id === e.source)
    const to = nodes.find((n) => n.id === e.target)
    const handles = e.sourceHandle || !from || !to ? {} : pickHandles(from, to)
    return { id: e.id ?? `e${i}-${e.source}-${e.target}`, ...e, ...handles, ...edgeDefaults }
  })

/** Free-form diagram editor; the diagram is autosaved as a draft under `draftId`. */
export function DesignCanvas({ draftId, starter }: { draftId: string; starter?: DesignTask['starter'] }) {
  const draft = useProgress((s) => s.drafts[draftId])
  const saveDraft = useProgress((s) => s.saveDraft)
  const initial = draft?.nodes.length ? draft : starter
  const [nodes, setNodes, onNodesChange] = useNodesState<BlockNodeType>(toFlowNodes(initial?.nodes ?? []))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    toFlowEdges(initial?.edges ?? [], initial?.nodes ?? []),
  )
  const { screenToFlowPosition } = useReactFlow()

  useEffect(() => {
    const t = setTimeout(
      () =>
        saveDraft(draftId, {
          notes: useProgress.getState().drafts[draftId]?.notes ?? {},
          nodes: nodes.map((n) => ({ id: n.id, type: n.data.type, label: n.data.label, x: n.position.x, y: n.position.y })),
          edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            label: e.label as string | undefined,
          })),
        }),
      300,
    )
    return () => clearTimeout(t)
  }, [nodes, edges, draftId, saveDraft])

  const onConnect = useCallback(
    (c: Connection) => setEdges((es) => addEdge({ ...c, ...edgeDefaults }, es)),
    [setEdges],
  )

  const add = (type: BlockType) => {
    const center = screenToFlowPosition({ x: window.innerWidth * 0.65, y: window.innerHeight / 2 })
    const id = `${type}-${crypto.randomUUID().slice(0, 4)}`
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'block',
        position: { x: center.x + Math.random() * 80 - 40, y: center.y + Math.random() * 80 - 40 },
        data: { type, label: blocks[type].label },
      },
    ])
  }

  return (
    <div className="relative h-full">
      <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1.5 backdrop-blur">
        {(Object.keys(blocks) as BlockType[]).map((t) => {
          const Icon = blocks[t].icon
          return (
            <button
              key={t}
              onClick={() => add(t)}
              title={`Добавить: ${blocks[t].label}`}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              <Icon size={14} style={{ color: blocks[t].color }} />
              {blocks[t].label}
            </button>
          )
        })}
      </div>
      <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-zinc-900/80 px-3 py-1 text-[11px] text-zinc-500">
        Двойной клик — переименовать блок / подписать стрелку · Backspace — удалить
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodeDoubleClick={(_, n) => {
          const label = window.prompt('Название блока', n.data.label)
          if (label) setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, data: { ...x.data, label } } : x)))
        }}
        onEdgeDoubleClick={(_, e) => {
          const label = window.prompt('Подпись связи (протокол, что передаётся)', (e.label as string) ?? '')
          if (label !== null) setEdges((es) => es.map((x) => (x.id === e.id ? { ...x, label } : x)))
        }}
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
        colorMode="dark"
      >
        <Background color="#27272a" gap={20} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  )
}

const statusIcon = {
  met: <Check size={14} className="text-emerald-400" />,
  partial: <Minus size={14} className="text-amber-400" />,
  missed: <X size={14} className="text-rose-400" />,
}

function GradeView({ grade }: { grade: Grade }) {
  const color = grade.score >= 70 ? 'text-emerald-300' : grade.score >= 40 ? 'text-amber-300' : 'text-rose-300'
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className={clsx('text-4xl font-bold tabular-nums', color)}>{grade.score}</div>
        <div className="text-sm text-zinc-300">{grade.verdict}</div>
      </div>
      <ul className="space-y-2">
        {grade.criteria.map((c, i) => (
          <li key={i} className="rounded-lg bg-zinc-900 p-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="mt-0.5">{statusIcon[c.status]}</span>
              <div>
                <div className="font-medium text-zinc-200">{c.criterion}</div>
                <div className="text-zinc-400">{c.comment}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {grade.strengths.length > 0 && (
        <div>
          <div className="mb-1 text-xs text-emerald-400">Сильные стороны</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
            {grade.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {grade.issues.length > 0 && (
        <div>
          <div className="mb-1 text-xs text-rose-400">Что сломается</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
            {grade.issues.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Panel({ task }: { task: DesignTask }) {
  const draft = useProgress((s) => s.drafts[task.id])
  const saveDraft = useProgress((s) => s.saveDraft)
  const record = useProgress((s) => s.record)
  const [step, setStep] = useState(0)
  const [showPrompt, setShowPrompt] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [followAnswer, setFollowAnswer] = useState('')
  const notes = draft?.notes ?? {}

  const setNote = (key: string, value: string) =>
    saveDraft(task.id, { nodes: draft?.nodes ?? [], edges: draft?.edges ?? [], notes: { ...notes, [key]: value } })

  const submit = async (withFollowUp = false) => {
    setLoading(true)
    setError(null)
    try {
      const d = useProgress.getState().drafts[task.id]
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          task: { title: task.title, prompt: task.prompt, requirements: task.requirements, rubric: task.rubric },
          design: { nodes: d?.nodes ?? [], edges: d?.edges ?? [], notes: d?.notes ?? {} },
          answerToFollowUp:
            withFollowUp && grade ? { question: grade.followUp, answer: followAnswer } : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? res.statusText)
      setGrade(json)
      setFollowAnswer('')
      record(task.id, json.score)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <TaskHeader task={task} />
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-zinc-300"
        >
          Условие <ChevronDown size={16} className={clsx('transition', showPrompt && 'rotate-180')} />
        </button>
        {showPrompt && (
          <div className="space-y-3 px-4 pb-4">
            <Markdown>{task.prompt}</Markdown>
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
              {task.requirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Hints hints={task.hints} />

      <div>
        <div className="flex flex-wrap gap-1">
          {steps.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStep(i)}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs',
                i === step ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:bg-zinc-800',
              )}
            >
              <span
                className={clsx('h-1.5 w-1.5 rounded-full', notes[s.key]?.trim() ? 'bg-emerald-400' : 'bg-zinc-600')}
              />
              {i + 1}. {s.key}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-zinc-500">{steps[step].hint}</div>
        <textarea
          value={notes[steps[step].key] ?? ''}
          onChange={(e) => setNote(steps[step].key, e.target.value)}
          rows={8}
          className="mt-2 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm outline-none focus:border-sky-400"
          placeholder="Пиши тезисно…"
        />
      </div>

      <button
        onClick={() => submit(false)}
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2 font-medium text-zinc-950 hover:bg-sky-400 disabled:opacity-50"
      >
        {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
        {loading ? 'Интервьюер изучает решение…' : 'Отправить на проверку'}
      </button>
      {error && <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}

      {grade && (
        <div className="space-y-4 rounded-xl border border-zinc-800 p-4">
          <GradeView grade={grade} />
          <div className="rounded-lg border border-violet-400/30 bg-violet-400/5 p-3">
            <div className="mb-1 text-xs text-violet-300">Вопрос интервьюера</div>
            <div className="text-sm text-zinc-200">{grade.followUp}</div>
            <textarea
              value={followAnswer}
              onChange={(e) => setFollowAnswer(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-sm outline-none focus:border-violet-400"
              placeholder="Ответ — решение будет переоценено с его учётом"
            />
            <button
              onClick={() => submit(true)}
              disabled={loading || !followAnswer.trim()}
              className="mt-2 rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-40"
            >
              Ответить и переоценить
            </button>
          </div>
          <details className="rounded-lg bg-zinc-900 p-3">
            <summary className="cursor-pointer text-sm font-medium text-zinc-300">Эталонное решение</summary>
            <div className="mt-3">
              <Markdown>{task.reference}</Markdown>
            </div>
          </details>
          <NextLink task={task} />
        </div>
      )}
    </div>
  )
}

export function DesignView({ task }: { task: DesignTask }) {
  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(380px,460px)_1fr]">
      <div className="border-r border-zinc-800 lg:h-full lg:overflow-hidden">
        <Panel task={task} />
      </div>
      <div className="h-[70vh] lg:h-full">
        <ReactFlowProvider>
          <DesignCanvas draftId={task.id} starter={task.starter} />
        </ReactFlowProvider>
      </div>
    </div>
  )
}
