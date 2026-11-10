import clsx from 'clsx'
import { FlaskConical, House, LoaderCircle, Lock, Skull, Sparkles, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { postApi } from '../lib/api'
import { companyPack } from '../company'
import { hardcoreScenarios } from '../sim/hardcore'
import { inheritedScenarios } from '../sim/inherited'
import { opsScenarios } from '../sim/ops-scenarios'
import { frontendScenarios, llmScenarios } from '../sim/fe-llm-scenarios'
import { legendScenarios } from '../sim/legend-scenarios'
import { shop } from '../game/defs'
import { getScenario, scenarios } from '../sim/scenarios'
import { SimGame } from '../sim/SimGame'
import type { Scenario, SimGraph } from '../sim/types'
import { scenarioXp, simKey, useProgress } from '../store'

const sandboxGraph: SimGraph = {
  nodes: [
    { id: 'client', type: 'client', label: 'Пользователи', instances: 1, size: 'S' },
    { id: 'lb', type: 'lb', label: 'nginx', instances: 1, size: 'S' },
    { id: 'api', type: 'service', label: 'API', instances: 2, size: 'S' },
    { id: 'db', type: 'postgres', label: 'Postgres', instances: 1, size: 'S' },
  ],
  edges: [
    { source: 'client', target: 'lb' },
    { source: 'lb', target: 'api' },
    { source: 'api', target: 'db' },
  ],
}

export function OncallList() {
  const results = useProgress((s) => s.results)
  const aiScenarios = useProgress((s) => s.aiScenarios)
  const addAiScenario = useProgress((s) => s.addAiScenario)
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const won = (id: string) => (results[simKey(id)]?.best ?? 0) > 0
  const unlocked = (level: number) => level === 1 || scenarios.some((s) => s.level === level - 1 && won(s.id))

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const sc = await postApi<Scenario>('/api/scenario', { topic: topic || 'случайная цепочка инцидентов', difficulty })
      sc.id = `ai-${Date.now().toString(36)}`
      addAiScenario(sc)
      navigate(`/oncall/${sc.id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Дежурство</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Цепочки инцидентов в реальном времени. Масштабируй, добавляй кэш, очереди, реплики — укладывайся в SLO и бюджет, пока не сгорел бюджет ошибок.
        </p>
      </div>

      <Link
        to="/sandbox"
        className="flex items-center gap-3 rounded-xl border border-sky-400/30 bg-sky-400/5 p-4 hover:bg-sky-400/10"
      >
        <FlaskConical className="text-sky-300" />
        <div>
          <div className="font-medium text-sky-100">Песочница</div>
          <div className="text-sm text-zinc-400">Без таймера и бюджета: крути нагрузку, роняй блоки, смотри, что происходит.</div>
        </div>
      </Link>

      <div className="grid gap-3 sm:grid-cols-2">
        {scenarios.map((s) => {
          const open = unlocked(s.level)
          const best = results[simKey(s.id)]?.best
          return (
            <Link
              key={s.id}
              to={open ? `/oncall/${s.id}` : '#'}
              className={clsx(
                'rounded-xl border p-4 transition',
                open ? 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600' : 'pointer-events-none border-zinc-900 opacity-40',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-rose-400/10 px-2 py-0.5 text-xs text-rose-300">Ур. {s.level}</span>
                <span className="font-medium">{s.title}</span>
                {!open && <Lock size={14} className="ml-auto text-zinc-500" />}
                {open && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-amber-300">
                    <Trophy size={12} /> {scenarioXp(s.level)} XP
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                {s.durationMin} мин · SLO p99 ≤ {s.slo.p99Ms}ms · бюджет ${s.budgetPerMonth}/мес
                {best !== undefined && (best > 0 ? ` · ✅ ${best}%` : ' · ❌ не пройден')}
              </div>
            </Link>
          )
        })}
      </div>

      <LegendList />

      {[
        { title: 'Эксплуатация', text: 'Аварии зон, автоскейлинг, консьюмеры Kafka. То, что ломается в живом проде, а не на собеседовании.', list: opsScenarios },
        { title: 'Фронтенд', text: 'SSR под рекламой и волна переподключений WebSocket: где фронтенд-архитектура упирается в бэкенд.', list: frontendScenarios },
        { title: 'LLM-системы', text: 'Отказ провайдера, зациклившийся агент, переиндексация. Задержки здесь в секундах, а счёт растёт с каждым запросом.', list: llmScenarios },
      ].map((sec) => (
        <div key={sec.title} className="space-y-3">
          <h2 className="font-semibold text-zinc-100">{sec.title}</h2>
          <p className="text-sm text-zinc-400">{sec.text}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {sec.list.map((s) => {
              const best = results[simKey(s.id)]?.best
              return (
                <Link key={s.id} to={`/oncall/${s.id}`} className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 transition-colors hover:border-sky-400/60">
                  <div className="font-medium">{s.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {s.configOnly ? 'только настройки' : 'можно менять архитектуру'}
                    {best !== undefined && (best > 0 ? `, пройден на ${best}%` : ', не пройден')}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      {companyPack && (
        <div className="space-y-3 rounded-xl border border-sky-400/30 bg-sky-400/[0.06] p-4">
          <h2 className="font-semibold text-sky-200">Моя компания: {companyPack.name}</h2>
          <p className="text-sm text-zinc-400">{companyPack.about}</p>
          <Link to="/sandbox/company" className="inline-block text-sm text-sky-300 hover:underline">
            Открыть реальную топологию в песочнице
          </Link>
          <div className="grid gap-3 sm:grid-cols-2">
            {companyPack.scenarios.map((s) => {
              const best = results[simKey(s.id)]?.best
              return (
                <Link key={s.id} to={`/oncall/${s.id}`} className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 transition-colors hover:border-sky-400/60">
                  <div className="font-medium">{s.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {s.durationMin} мин, SLO p99 ≤ {s.slo.p99Ms} мс
                    {best !== undefined && (best > 0 ? `, пройден на ${best}%` : ', не пройден')}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-amber-200">
          <House size={18} /> Наследство
        </h2>
        <p className="text-sm text-zinc-400">
          Первый день в новой компании: всё уже построено, но работает неправильно. Железо заморожено — ищи кривую настройку по симптомам и чини конфиг.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {inheritedScenarios.map((s, k) => {
            const open = k === 0 || won(inheritedScenarios[k - 1].id)
            const best = results[simKey(s.id)]?.best
            return (
              <Link
                key={s.id}
                to={open ? `/oncall/${s.id}` : '#'}
                className={clsx(
                  'rounded-xl border p-4 transition',
                  open ? 'border-amber-400/30 bg-amber-400/5 hover:border-amber-300/60' : 'pointer-events-none border-zinc-900 opacity-40',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-amber-400/10 px-2 py-0.5 text-xs text-amber-300">#{s.level}</span>
                  <span className="font-medium">{s.title}</span>
                  {!open ? <Lock size={14} className="ml-auto text-zinc-500" /> : <span className="ml-auto text-xs text-amber-300">{scenarioXp(s.level + 1)} XP</span>}
                </div>
                {best !== undefined && <div className="mt-1 text-xs text-zinc-500">{best > 0 ? `✅ ${best}%` : '❌ не пройден'}</div>}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-rose-200">
          <Skull size={18} /> Хардкор
        </h2>
        <p className="text-sm text-zinc-400">Тот же инцидент, но очевидный инструмент запрещён — по правдоподобной причине. Открывается после победы в обычной версии.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {hardcoreScenarios.map((s) => {
            const open = won(s.hardOf!)
            const best = results[simKey(s.id)]?.best
            return (
              <Link
                key={s.id}
                to={open ? `/oncall/${s.id}` : '#'}
                className={clsx(
                  'rounded-xl border p-4 transition',
                  open ? 'border-rose-500/30 bg-rose-500/5 hover:border-rose-400/60' : 'pointer-events-none border-zinc-900 opacity-40',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.title}</span>
                  {!open ? <Lock size={14} className="ml-auto text-zinc-500" /> : <span className="ml-auto text-xs text-amber-300">{scenarioXp(s.level + 2)} XP</span>}
                </div>
                <div className="mt-2 text-xs text-rose-200/80">🚫 {s.bannedBlocks!.map((b) => b.type).join(', ')}</div>
                {best !== undefined && <div className="mt-1 text-xs text-zinc-500">{best > 0 ? `✅ ${best}%` : '❌ не пройден'}</div>}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-violet-400/20 bg-violet-400/5 p-4">
        <div className="flex items-center gap-2 font-medium text-violet-200">
          <Sparkles size={16} /> Сгенерировать сценарий ИИ
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Тема: «очереди и ретраи», «падение Kafka», «распродажа на маркетплейсе»…"
            className="min-w-64 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            Сложность
            <input type="range" min={1} max={10} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className="accent-violet-400" />
            <span className="w-4 font-mono text-zinc-200">{difficulty}</span>
          </label>
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-50"
          >
            {loading && <LoaderCircle size={14} className="animate-spin" />}
            {loading ? 'Гейм-мастер думает… (~1 мин)' : 'Сгенерировать'}
          </button>
        </div>
        {error && <div className="text-sm text-rose-300">{error}</div>}
        {aiScenarios.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {aiScenarios.map((s) => (
              <Link key={s.id} to={`/oncall/${s.id}`} className="rounded-lg border border-zinc-800 p-3 text-sm hover:border-zinc-600">
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-zinc-500">
                  {s.durationMin} мин · бюджет ${s.budgetPerMonth}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Legendary scenarios: locked cards until bought in the shop. */
function LegendList() {
  const owned = useProgress((s) => s.owned)
  const results = useProgress((s) => s.results)
  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-zinc-100">🏛️ Легендарные дежурства</h2>
      <p className="text-sm text-zinc-400">Упрощённые модели известных публичных аварий. После игры разбор с уроками из настоящего постмортема.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {legendScenarios.map((s) => {
          const item = shop.find((i) => i.id === s.id)
          const has = owned.includes(s.id)
          const best = results[simKey(s.id)]?.best
          return (
            <Link
              key={s.id}
              to={has ? `/oncall/${s.id}` : '/shop'}
              className={clsx(
                'rounded-xl border p-4 transition-colors',
                has ? 'border-amber-300/40 bg-amber-300/[0.04] hover:border-amber-300/70' : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600',
              )}
            >
              <div className="text-2xl">{has ? item?.emoji : '🔒'}</div>
              <div className={clsx('mt-1 font-medium', !has && 'text-zinc-400')}>{s.title}</div>
              <div className="mt-1 text-xs text-zinc-500">
                {has ? (best !== undefined ? (best > 0 ? `пройдено на ${best}%` : 'не пройдено') : `уровень ${s.level}`) : `${item?.cost ?? ''} 🪙 в магазине`}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function OncallGame() {
  const { id } = useParams()
  const aiScenarios = useProgress((s) => s.aiScenarios)
  const owned = useProgress((s) => s.owned)
  const legend = legendScenarios.find((s) => s.id === id)
  if (legend && !owned.includes(legend.id))
    return (
      <div className="mx-auto max-w-xl space-y-3 p-8 text-center">
        <div className="text-4xl">🔒</div>
        <div className="text-lg font-semibold">{legend.title}</div>
        <p className="text-sm text-zinc-400">Легендарное дежурство открывается в магазине.</p>
        <Link to="/shop" className="inline-block rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-300">
          В магазин
        </Link>
      </div>
    )
  const scenario =
    legend ??
    ((id && (getScenario(id) ?? hardcoreScenarios.find((s) => s.id === id) ?? inheritedScenarios.find((s) => s.id === id) ?? opsScenarios.find((s) => s.id === id) ?? frontendScenarios.find((s) => s.id === id) ?? llmScenarios.find((s) => s.id === id) ?? companyPack?.scenarios.find((s) => s.id === id) ?? aiScenarios.find((s) => s.id === id))) || undefined)
  if (!scenario)
    return (
      <div className="p-8">
        Сценарий не найден. <Link to="/oncall" className="text-sky-400">К списку</Link>
      </div>
    )
  return <SimGame key={scenario.id} scenario={scenario} initialGraph={scenario.startGraph} />
}

export function Sandbox() {
  return <SimGame scenario={null} initialGraph={sandboxGraph} />
}

export function CompanySandbox() {
  if (!companyPack) return <Sandbox />
  return <SimGame key="company" scenario={null} initialGraph={companyPack.sandbox} />
}
