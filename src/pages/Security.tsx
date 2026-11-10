import clsx from 'clsx'
import { ArrowLeft, Lock, LoaderCircle, RotateCcw, Send, Shield, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Markdown } from '../components/Markdown'
import { ModuleNav } from '../components/ModuleNav'
import { attackById, defenseById, installedCost, runWave, scoreLevel } from '../defense/engine'
import { learnLinks } from '../defense/learn'
import { defenseLevels, referenceSetups } from '../defense/levels'
import { getConcept } from '../learn/concepts'
import { getEntry } from '../wiki'
import type { AttackResult, DefenseLevel, Zone } from '../defense/types'
import { postApi } from '../lib/api'
import { useProgress } from '../store'

const zones: { id: Zone; name: string; emoji: string }[] = [
  { id: 'edge', name: 'Периметр', emoji: '🌐' },
  { id: 'app', name: 'Приложение', emoji: '🧩' },
  { id: 'data', name: 'Данные', emoji: '🗄️' },
  { id: 'agent', name: 'ИИ-агент', emoji: '🤖' },
  { id: 'supply', name: 'Зависимости', emoji: '📦' },
  { id: 'people', name: 'Люди', emoji: '🧑‍💼' },
]
const zoneIndex = Object.fromEntries(zones.map((z, i) => [z.id, i])) as Record<Zone, number>
const CTF_LEVELS = 6

const stars = (n: number) => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n)

// ─────────────────────────── Hub ───────────────────────────

export function SecurityHub() {
  const results = useProgress((s) => s.results)
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      <header className="max-w-2xl space-y-2">
        <h1 className="text-3xl">Безопасность</h1>
        <p className="text-zinc-400">
          Две стороны одной монеты. В Blue Team ты расставляешь защиту и смотришь, как волны атак разбиваются о неё или проходят насквозь. Во «Взломай агента» ты сам атакующий: вытаскиваешь
          секрет у ИИ-агента, у которого с каждым уровнем больше защит.
        </p>
        <Link to="/path/security" className="inline-block text-sm text-sky-300 hover:underline">
          Теория — модуль «Безопасность систем и ИИ» в пути обучения
        </Link>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Blue Team</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {defenseLevels.map((l, i) => {
            const best = results[`def:${l.id}`]?.best ?? 0
            const open = i === 0 || (results[`def:${defenseLevels[i - 1].id}`]?.best ?? 0) > 0
            return (
              <Link
                key={l.id}
                to={open ? `/security/defense/${l.id}` : '#'}
                className={clsx(
                  'group relative overflow-hidden rounded-xl border p-4 transition-colors',
                  open ? 'border-zinc-700 bg-zinc-900 hover:border-sky-400/60' : 'pointer-events-none border-zinc-800 opacity-40',
                )}
              >
                <div className="font-display text-4xl text-zinc-700 transition-colors group-hover:text-sky-400/40">{l.level}</div>
                <div className="mt-1 font-semibold text-zinc-100">{l.title}</div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-amber-300">{best > 0 ? stars(Math.round(best / 33)) : open ? 'не пройден' : ''}</span>
                  {!open && <Lock size={14} className="text-zinc-500" />}
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Взломай агента</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {Array.from({ length: CTF_LEVELS }, (_, i) => i + 1).map((n) => {
            const done = (results[`ctf:${n}`]?.best ?? 0) > 0
            const open = n === 1 || (results[`ctf:${n - 1}`]?.best ?? 0) > 0
            return (
              <Link
                key={n}
                to={open ? `/security/ctf/${n}` : '#'}
                className={clsx(
                  'flex aspect-square flex-col items-center justify-center rounded-xl border text-center transition-colors',
                  done ? 'border-emerald-400/50 bg-emerald-400/[0.06]' : open ? 'border-zinc-700 bg-zinc-900 hover:border-violet-400/60' : 'pointer-events-none border-zinc-800 opacity-40',
                )}
              >
                <span className="text-3xl">{done ? '🔓' : open ? '🧙' : '🔒'}</span>
                <span className="mt-1 font-display text-lg">{n}</span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ─────────────────────────── Blue Team ───────────────────────────

type Phase = 'prep' | 'running' | 'review' | 'won' | 'lost'

/** "Почитать" links to wiki entries and lessons; open in a new tab so the game keeps its state. */
function LearnLinks({ id, className }: { id: string; className?: string }) {
  const links = (learnLinks[id] ?? []).flatMap((ref) => {
    const [kind, target] = ref.split(':')
    const title = kind === 'wiki' ? getEntry(target)?.title : getConcept(target)?.title
    return title ? [{ to: kind === 'wiki' ? `/wiki/${target}` : `/learn/${target}`, title, kind }] : []
  })
  if (!links.length) return null
  return (
    <div className={clsx('flex flex-wrap gap-1', className)}>
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          target="_blank"
          title={l.kind === 'wiki' ? 'Справочник' : 'Урок'}
          className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[11px] text-sky-300 hover:bg-zinc-700 hover:text-sky-200"
        >
          {l.kind === 'wiki' ? '📖' : '🎓'} {l.title}
        </Link>
      ))}
    </div>
  )
}

function AttackInfo({ id, onClose }: { id: string; onClose: () => void }) {
  const a = attackById(id)!
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="fixed top-16 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{a.emoji}</span>
        <div className="flex-1">
          <div className="font-semibold">{a.name}</div>
          <div className="text-sm text-zinc-400">{a.vector}</div>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200" aria-label="Закрыть">
          <X size={18} />
        </button>
      </div>
      <Markdown>{a.explain}</Markdown>
      <LearnLinks id={a.id} />
      <div className="text-sm text-zinc-400">
        <div className="mb-1 font-medium text-zinc-300">Как это бывает в жизни</div>
        <Markdown>{a.incident}</Markdown>
      </div>
      <div className="text-sm">
        <div className="mb-1 font-medium text-zinc-300">Чем остановить</div>
        <div className="flex flex-wrap gap-1.5">
          {a.counters.map((c) => {
            const d = defenseById(c.defense)
            return (
              <span key={c.defense} className="rounded-md bg-zinc-800 px-2 py-1 text-xs" title={d?.blurb}>
                {d?.emoji} {d?.name} <span className="text-zinc-500">{Math.round(c.effectiveness * 100)}%</span>
              </span>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

export function DefenseGame() {
  const { id } = useParams()
  const level = defenseLevels.find((l) => l.id === id)
  if (!level)
    return (
      <div className="p-8">
        Уровень не найден. <Link to="/security" className="text-sky-300">К безопасности</Link>
      </div>
    )
  return <DefenseBoard key={level.id} level={level} />
}

function DefenseBoard({ level }: { level: DefenseLevel }) {
  const record = useProgress((s) => s.record)
  const [installed, setInstalled] = useState<string[]>([])
  const [waveIdx, setWaveIdx] = useState(0)
  const [trust, setTrust] = useState(level.trust)
  const [phase, setPhase] = useState<Phase>('prep')
  const [results, setResults] = useState<AttackResult[]>([])
  const [shown, setShown] = useState(0)
  const [info, setInfo] = useState<string | null>(null)
  const [hit, setHit] = useState(0)
  const [showRef, setShowRef] = useState(false)
  // Состояние перед последней волной: её можно переиграть, не проходя заново предыдущие.
  const [checkpoint, setCheckpoint] = useState<{ waveIdx: number; trust: number; installed: string[] } | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const wave = level.waves[waveIdx]
  const budget = level.budget + level.waves.slice(0, waveIdx + 1).reduce((a, w) => a + w.bonusBudget, 0)
  const spent = installedCost(installed)
  const left = budget - spent
  const available = level.available.map((d) => defenseById(d)!).filter(Boolean)
  const score = useMemo(() => (phase === 'won' || phase === 'lost' ? scoreLevel(level, trust, spent, installed) : null), [phase, level, trust, spent, installed])

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current)
  }, [])

  const toggle = (d: string) => {
    if (phase !== 'prep') return
    if (installed.includes(d)) setInstalled(installed.filter((x) => x !== d))
    else if ((defenseById(d)?.cost ?? 99) <= left) setInstalled([...installed, d])
  }

  const finishWave = (res: AttackResult[]) => {
    const damage = res.reduce((a, r) => a + r.damage, 0)
    const t = Math.max(0, trust - damage)
    setTrust(t)
    if (t <= 0) {
      setPhase('lost')
      record(`def:${level.id}`, 0)
    } else if (waveIdx + 1 >= level.waves.length) {
      const s = scoreLevel(level, t, installedCost(installed), installed)
      setPhase('won')
      record(`def:${level.id}`, Math.max(1, s.stars * 33))
    } else setPhase('review')
  }

  const launch = () => {
    setCheckpoint({ waveIdx, trust, installed })
    const res = runWave(level, wave, installed, Date.now() % 1_000_000)
    setResults(res)
    setShown(0)
    setPhase('running')
    let i = 0
    timer.current = setInterval(() => {
      i++
      setShown(i)
      if (res[i - 1] && !res[i - 1].blocked) setHit((h) => h + 1)
      if (i >= res.length) {
        clearInterval(timer.current!)
        setTimeout(() => finishWave(res), 500)
      }
    }, 900)
  }

  const skip = () => {
    if (timer.current) clearInterval(timer.current)
    setShown(results.length)
    finishWave(results)
  }

  const nextWave = () => {
    setWaveIdx(waveIdx + 1)
    setResults([])
    setShown(0)
    setPhase('prep')
  }

  const retryWave = () => {
    if (!checkpoint) return
    setInstalled(checkpoint.installed)
    setTrust(checkpoint.trust)
    setWaveIdx(checkpoint.waveIdx)
    setResults([])
    setShown(0)
    setPhase('prep')
    setShowRef(false)
  }

  const restart = () => {
    setInstalled([])
    setWaveIdx(0)
    setTrust(level.trust)
    setResults([])
    setShown(0)
    setPhase('prep')
    setShowRef(false)
  }

  const current = phase === 'running' && shown < results.length ? results[shown] : null
  const currentAttack = current ? attackById(current.attack) : null
  const pathStop = current ? currentAttack!.path.slice(0, currentAttack!.path.indexOf(current.zone) + 1) : []
  const done = results.slice(0, shown)
  const blockedIn = (z: Zone) => done.filter((r) => r.blocked && r.zone === z).length

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link to="/security" className="text-zinc-400 hover:text-zinc-100" aria-label="Назад">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl">
          {level.level}. {level.title}
        </h1>
        <div className="ml-auto flex items-center gap-5 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Доверие</span>
            <motion.div key={hit} animate={{ x: [0, -4, 4, -2, 0] }} transition={{ duration: 0.3 }} className="h-2.5 w-36 overflow-hidden rounded-full bg-zinc-800">
              <div className={clsx('h-full transition-all duration-500', trust > 60 ? 'bg-emerald-400' : trust > 30 ? 'bg-amber-400' : 'bg-rose-500')} style={{ width: `${trust}%` }} />
            </motion.div>
            <span className="w-8 font-display text-zinc-100">{trust}</span>
          </div>
          <div>
            <span className="text-zinc-400">Бюджет </span>
            <span className="font-display text-sky-300">{left}</span>
            <span className="text-zinc-500"> / {budget}</span>
          </div>
          <div className="text-zinc-400">
            Волна <span className="font-display text-zinc-100">{Math.min(waveIdx + 1, level.waves.length)}</span>/{level.waves.length}
          </div>
          <button onClick={restart} className="text-zinc-500 hover:text-zinc-200" aria-label="Заново">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {waveIdx === 0 && phase === 'prep' && (
        <div className="max-w-3xl text-sm text-zinc-300">
          <Markdown>{level.briefing}</Markdown>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Board */}
        <div className="space-y-3">
          <div className="relative grid grid-cols-6 gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
            {zones.map((z) => {
              const nodes = level.system.nodes.filter((n) => n.zone === z.id)
              const def = installed.filter((d) => defenseById(d)?.zone === z.id)
              const active = pathStop.includes(z.id)
              return (
                <div
                  key={z.id}
                  className={clsx(
                    'min-h-64 space-y-2 rounded-lg p-2 transition-colors duration-300',
                    active ? 'bg-rose-500/10' : 'bg-zinc-950/60',
                    current?.blocked && current.zone === z.id && 'bg-sky-400/15',
                  )}
                >
                  <div className="text-xs font-medium text-zinc-400">
                    {z.emoji} {z.name}
                  </div>
                  {nodes.map((n) => (
                    <div key={n.id} className="truncate rounded-md border border-zinc-800 px-1.5 py-1 text-[11px] text-zinc-400">
                      {n.emoji ?? '▪'} {n.label}
                    </div>
                  ))}
                  <div className="space-y-1 pt-1">
                    {def.map((d) => {
                      const x = defenseById(d)!
                      return (
                        <motion.button
                          layout
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          key={d}
                          onClick={() => toggle(d)}
                          title={phase === 'prep' ? 'Снять защиту' : x.blurb}
                          className="flex w-full items-center gap-1 rounded-md bg-sky-400/15 px-1.5 py-1 text-left text-[11px] text-sky-100"
                        >
                          <Shield size={11} className="shrink-0" /> <span className="truncate">{x.name}</span>
                        </motion.button>
                      )
                    })}
                  </div>
                  {blockedIn(z.id) > 0 && <div className="text-[11px] text-sky-300">отбито: {blockedIn(z.id)}</div>}
                </div>
              )
            })}

            {/* Travelling attack token */}
            <AnimatePresence>
              {current && currentAttack && (
                <motion.div
                  key={`${current.attack}-${shown}`}
                  className="pointer-events-none absolute top-1/2 z-10 -mt-6 flex h-12 w-12 items-center justify-center rounded-full border-2 border-rose-400 bg-zinc-950 text-2xl shadow-lg shadow-rose-500/30"
                  initial={{ left: '-4%', opacity: 0 }}
                  animate={{
                    left: pathStop.map((z) => `${(zoneIndex[z] + 0.5) * (100 / 6)}%`),
                    opacity: 1,
                    scale: current.blocked ? [1, 1, 1.3, 0] : [1, 1, 1.5],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                  style={{ translateX: '-50%' }}
                >
                  {current.blocked ? '🛡️' : currentAttack.emoji}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Battle log */}
          {results.length > 0 && (
            <div className="space-y-1.5">
              {done.map((r, i) => {
                const a = attackById(r.attack)!
                return (
                  <motion.button
                    key={`${r.attack}-${i}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setInfo(r.attack)}
                    className={clsx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm', r.blocked ? 'bg-zinc-900' : 'bg-rose-500/10')}
                  >
                    <span className="text-lg">{a.emoji}</span>
                    <span className="flex-1 text-zinc-200">{a.name}</span>
                    {r.blocked ? (
                      <span className="text-sky-300">остановил {defenseById(r.by!)?.name}</span>
                    ) : (
                      <span className="text-rose-300">прорыв, −{r.damage}</span>
                    )}
                  </motion.button>
                )
              })}
              {phase === 'running' && (
                <button onClick={skip} className="text-xs text-zinc-500 hover:text-zinc-300">
                  Пропустить анимацию
                </button>
              )}
            </div>
          )}

          {phase === 'review' && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex-1 text-sm text-zinc-300">
                Волна отбита. Отбито {results.filter((r) => r.blocked).length} из {results.length}. Кликни по атаке, чтобы разобрать её. Перед следующей волной +
                {level.waves[waveIdx + 1].bonusBudget} к бюджету.
              </div>
              <button onClick={retryWave} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700">
                Переиграть волну
              </button>
              <button onClick={nextWave} className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-sky-300">
                К следующей волне
              </button>
            </div>
          )}

          {score && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900 p-5">
              <div className="flex items-center gap-4">
                <div className={clsx('font-display text-4xl', phase === 'won' ? 'text-amber-300' : 'text-rose-400')}>{phase === 'won' ? stars(score.stars) : 'Взлом'}</div>
                <div className="text-sm text-zinc-300">
                  {phase === 'won' ? 'Все волны позади.' : 'Доверие пользователей обнулилось: инцидент попал в новости.'} Неудобство защит для людей: {score.friction}.
                </div>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
                {score.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
              <Markdown>{level.debrief}</Markdown>
              {!showRef ? (
                <button onClick={() => setShowRef(true)} className="text-sm text-sky-300 hover:underline">
                  Показать эталонный набор защит
                </button>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(referenceSetups[level.id] ?? []).map((d) => (
                    <span key={d} className="rounded-md bg-sky-400/10 px-2 py-1 text-xs text-sky-100">
                      {defenseById(d)?.emoji} {defenseById(d)?.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {checkpoint && (
                  <button onClick={retryWave} className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-sky-300">
                    Переиграть волну {checkpoint.waveIdx + 1}
                  </button>
                )}
                <button onClick={restart} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700">
                  Весь уровень заново
                </button>
                <Link to="/security" className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white">
                  К уровням
                </Link>
              </div>
              <ModuleNav kind="defense" id={level.id} />
            </motion.div>
          )}
        </div>

        {/* Arsenal */}
        <aside className="space-y-3">
          {phase === 'prep' && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm">
              <div className="mb-1 font-medium text-amber-200">Разведка: волна {waveIdx + 1}</div>
              <div className="text-zinc-300">{wave.intel}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {wave.attacks.map((w) => {
                  const a = attackById(w.attack)!
                  return (
                    <button key={w.attack} onClick={() => setInfo(w.attack)} className="rounded-md bg-zinc-900 px-2 py-1 text-xs hover:bg-zinc-800">
                      {a.emoji} {a.name} ×{w.count}
                    </button>
                  )
                })}
              </div>
              <button onClick={launch} className="mt-3 w-full rounded-lg bg-rose-500 py-2 font-semibold text-white hover:bg-rose-400">
                Начать волну
              </button>
            </div>
          )}
          <div className="text-sm font-medium text-zinc-300">Арсенал</div>
          <div className="space-y-1.5">
            {available.map((d) => {
              const on = installed.includes(d.id)
              const can = on || d.cost <= left
              return (
                <div
                  key={d.id}
                  className={clsx(
                    'rounded-lg border transition-colors',
                    on ? 'border-sky-400/60 bg-sky-400/10' : 'border-zinc-800 hover:border-zinc-600',
                  )}
                >
                  <button
                    onClick={() => toggle(d.id)}
                    disabled={phase !== 'prep' || !can}
                    className={clsx('flex w-full items-start gap-3 p-2.5 pb-1.5 text-left', (phase !== 'prep' || !can) && !on && 'opacity-40')}
                  >
                    <span className="text-xl">{d.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-zinc-100">{d.name}</span>
                        <span className="font-display text-sm text-sky-300">{d.cost}</span>
                      </div>
                      <div className="text-xs text-zinc-400">{d.blurb}</div>
                      <div className="mt-0.5 text-[11px] text-zinc-500">в жизни: {d.realWorld}</div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                        <span>{zones.find((z) => z.id === d.zone)?.name}</span>
                        {d.friction > 0 && <span className="text-amber-300/80">неудобство {'●'.repeat(d.friction)}</span>}
                      </div>
                    </div>
                  </button>
                  {/* «Почитать» вне кнопки: ссылки работают и во время волны, когда кнопка заблокирована */}
                  <LearnLinks id={d.id} className="px-2.5 pb-2.5 pl-12" />
                </div>
              )
            })}
          </div>
        </aside>
      </div>

      <AnimatePresence>{info && <AttackInfo key={info} id={info} onClose={() => setInfo(null)} />}</AnimatePresence>
    </div>
  )
}

// ─────────────────────────── CTF ───────────────────────────

export function CtfGame() {
  const { n } = useParams()
  const level = Number(n) || 1
  const record = useProgress((s) => s.record)
  const cracked = useProgress((s) => (s.results[`ctf:${level}`]?.best ?? 0) > 0)
  const [defensesText, setDefensesText] = useState<string[]>([])
  const [history, setHistory] = useState<{ role: 'user' | 'agent'; text: string; blocked?: string }[]>([])
  const [msg, setMsg] = useState('')
  const [guess, setGuess] = useState('')
  const [loading, setLoading] = useState(false)
  const [verdict, setVerdict] = useState<null | boolean>(null)
  const [error, setError] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/ctf/levels')
      .then((r) => r.json())
      .then(setDefensesText)
      .catch(() => {})
  }, [])
  useEffect(() => {
    setHistory([])
    setVerdict(null)
    setGuess('')
  }, [level])
  useEffect(() => {
    // braces matter: Chrome's scrollIntoView returns a Promise, which React would treat as a cleanup
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [history])

  const send = async () => {
    if (!msg.trim() || loading) return
    const text = msg
    setMsg('')
    setHistory((h) => [...h, { role: 'user', text }])
    setLoading(true)
    setError(null)
    try {
      const r = await postApi<{ text: string; blocked?: string }>('/api/ctf/chat', {
        level,
        message: text,
        history: history.slice(-6).map((h) => ({ role: h.role, text: h.text })),
      })
      setHistory((h) => [...h, { role: 'agent', text: r.text, blocked: r.blocked }])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const check = async () => {
    const r = await postApi<{ ok: boolean }>('/api/ctf/guess', { level, guess })
    setVerdict(r.ok)
    if (r.ok) record(`ctf:${level}`, 100)
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_320px]">
      <div className="flex min-h-[70vh] flex-col">
        <div className="mb-4 flex items-center gap-3">
          <Link to="/security" className="text-zinc-400 hover:text-zinc-100" aria-label="Назад">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl">Взломай агента</h1>
          <div className="ml-2 flex gap-1">
            {Array.from({ length: CTF_LEVELS }, (_, i) => i + 1).map((k) => (
              <Link
                key={k}
                to={`/security/ctf/${k}`}
                className={clsx('flex h-7 w-7 items-center justify-center rounded-md font-display text-xs', k === level ? 'bg-violet-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100')}
              >
                {k}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {history.length === 0 && (
            <div className="py-10 text-center text-sm text-zinc-500">
              {level === 6 ? 'Пиши письмо клиента — агент перескажет его оператору. Сможешь заставить его проговориться?' : 'Начни разговор. Попробуй уговорить, обмануть или запутать агента.'}
            </div>
          )}
          {history.map((h, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={clsx('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm', h.role === 'user' ? 'ml-auto bg-violet-500/20 text-violet-50' : h.blocked ? 'bg-rose-500/10 text-rose-100' : 'bg-zinc-800 text-zinc-100')}
            >
              {h.role === 'agent' && <div className="mb-0.5 text-[11px] text-zinc-500">{h.blocked ? `агент · сработал ${h.blocked}` : 'агент'}</div>}
              <div className="whitespace-pre-wrap">{h.text}</div>
            </motion.div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <LoaderCircle size={14} className="animate-spin" /> агент думает
            </div>
          )}
          <div ref={end} />
        </div>
        {error && <div className="mt-2 text-sm text-rose-300">{error}</div>}
        <div className="mt-3 flex gap-2">
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={2}
            placeholder={level === 6 ? 'Текст письма клиента…' : 'Сообщение агенту…'}
            className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm outline-none focus:border-violet-400"
          />
          <button onClick={send} disabled={loading || !msg.trim()} className="rounded-xl bg-violet-500 px-4 text-white hover:bg-violet-400 disabled:opacity-40" aria-label="Отправить">
            <Send size={18} />
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="text-sm font-medium text-zinc-200">Защита уровня {level}</div>
          <div className="mt-1 text-sm text-zinc-400">{defensesText[level - 1] ?? '…'}</div>
        </div>
        <div className={clsx('rounded-xl border p-4', cracked ? 'border-emerald-400/50 bg-emerald-400/[0.06]' : 'border-zinc-800 bg-zinc-900')}>
          <div className="text-sm font-medium text-zinc-200">{cracked ? 'Взломано' : 'Знаешь пароль?'}</div>
          <div className="mt-2 flex gap-2">
            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && check()}
              placeholder="ПАРОЛЬ"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-display text-sm tracking-widest outline-none focus:border-emerald-400"
            />
            <button onClick={check} disabled={!guess.trim()} className="rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-zinc-950 disabled:opacity-40">
              Проверить
            </button>
          </div>
          <AnimatePresence mode="wait">
            {verdict !== null && (
              <motion.div key={String(verdict)} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={clsx('mt-2 text-sm', verdict ? 'text-emerald-300' : 'text-rose-300')}>
                {verdict ? (
                  <span>
                    Верно.{' '}
                    {level < CTF_LEVELS && (
                      <Link to={`/security/ctf/${level + 1}`} className="underline">
                        Уровень {level + 1}
                      </Link>
                    )}
                  </span>
                ) : (
                  'Не то.'
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <details className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
          <summary className="cursor-pointer text-zinc-200">Чему учит этот уровень</summary>
          <div className="mt-2 space-y-2">
            <p>Каждая защита закрывает один класс атак и оставляет другие: запрет в промпте обходится ролевой игрой, фильтр ответа — кодированием, судья — косвенными намёками, фильтр ввода — синонимами.</p>
            <p>Вывод для реальных систем: prompt injection не «чинится» одной мерой. Защита агента — это минимальные права инструментов, изоляция недоверенного текста и подтверждение опасных действий человеком.</p>
            <Link to="/learn/prompt-injection" className="text-sky-300 hover:underline">
              Урок про prompt injection
            </Link>
          </div>
        </details>
      </aside>
    </div>
  )
}

