import clsx from 'clsx'
import { Clock, LoaderCircle, Mic, MicOff, Send, Volume2, VolumeX } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { DesignCanvas } from '../components/DesignView'
import { type InterviewMode, interviewModes, type InterviewProblem, interviewProblems } from '../interview/problems'
import { useProgress } from '../store'

interface Turn {
  role: 'interviewer' | 'candidate'
  text: string
}

interface Session {
  problemId: string
  durationMin: number
  mode?: InterviewMode
  startedAt: number
  history: Turn[]
  finishedAt?: number
  grade?: Grade
}

interface Grade {
  score: number
  hire: string
  level: string
  summary: string
  axes: { axis: string; score: number; comment: string }[]
  strengths: string[]
  improvements: string[]
  missed: string[]
}

const STORAGE_KEY = 'interview-session'
const tracks: { id: InterviewProblem['track']; title: string }[] = [
  { id: 'backend', title: 'Бэкенд' },
  { id: 'frontend', title: 'Фронтенд' },
  { id: 'llm', title: 'LLM-системы' },
]
const phases = [
  { until: 0.12, name: 'Требования' },
  { until: 0.25, name: 'Оценки' },
  { until: 0.55, name: 'Дизайн' },
  { until: 0.88, name: 'Deep dive' },
  { until: 1.01, name: 'Итоги' },
]
const hireLabel: Record<string, { text: string; cls: string }> = {
  'strong hire': { text: 'Strong hire', cls: 'bg-emerald-400/20 text-emerald-200' },
  hire: { text: 'Hire', cls: 'bg-emerald-400/15 text-emerald-200' },
  'lean hire': { text: 'Lean hire', cls: 'bg-sky-400/15 text-sky-200' },
  'lean no hire': { text: 'Lean no hire', cls: 'bg-amber-400/15 text-amber-200' },
  'no hire': { text: 'No hire', cls: 'bg-rose-500/15 text-rose-200' },
  'strong no hire': { text: 'Strong no hire', cls: 'bg-rose-500/20 text-rose-200' },
}

const draftId = (problemId: string) => `interview:${problemId}`
const problemOf = (id: string) => interviewProblems.find((p) => p.id === id)

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable: the session just won't survive a reload
  }
}

function designOf(problemId: string) {
  const d = useProgress.getState().drafts[draftId(problemId)]
  return {
    nodes: (d?.nodes ?? []).map((n) => ({ id: n.id, type: n.type, label: n.label })),
    edges: (d?.edges ?? []).map((e) => ({ source: e.source, target: e.target, label: e.label })),
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data as T
}

/** Fresh session for a problem; also clears its diagram draft. */
function newSession(p: InterviewProblem, durationMin: number, mode: InterviewMode = 'standard'): Session {
  useProgress.getState().saveDraft(draftId(p.id), { notes: {}, nodes: [], edges: [] })
  return { problemId: p.id, durationMin, mode, startedAt: Date.now(), history: [{ role: 'interviewer', text: `${p.prompt} С чего начнёте?` }] }
}

export function Interview() {
  // Deep link /interview?p=<id> starts that problem right away (unless an interview is already running).
  const [session, setSession] = useState<Session | null>(() => {
    const saved = loadSession()
    const linked = problemOf(new URLSearchParams(window.location.search).get('p') ?? '')
    return saved && !saved.grade ? saved : linked ? newSession(linked, 45) : saved
  })
  useEffect(() => saveSession(session), [session])

  if (!session) return <Setup onStart={setSession} />
  const problem = problemOf(session.problemId)
  if (!problem) return <Setup onStart={setSession} />
  if (session.grade) return <Result session={session} problem={problem} onReset={() => setSession(null)} />
  return <Live session={session} problem={problem} setSession={setSession} />
}

// ───────────────────────── Выбор задачи ─────────────────────────

function Setup({ onStart }: { onStart: (s: Session) => void }) {
  const [duration, setDuration] = useState(45)
  const [mode, setMode] = useState<InterviewMode>('standard')
  const results = useProgress((s) => s.results)
  const start = (p: InterviewProblem) => onStart(newSession(p, duration, mode))

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">Mock-интервью</h1>
        <p className="max-w-2xl text-zinc-400">
          ИИ-интервьюер ведёт собеседование по system design: задаёт расплывчатую задачу, отвечает на уточнения, давит на цифры и слабые места. Ты рисуешь схему и
          проговариваешь решение. В конце разбор по шести осям и вердикт комиссии.
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-zinc-400">Насколько интервьюер помогает</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {interviewModes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={clsx(
                'rounded-xl border p-3 text-left text-sm transition-colors',
                m.id === mode ? 'border-sky-400/70 bg-sky-400/[0.08]' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600',
              )}
            >
              <div className={clsx('font-medium', m.id === mode ? 'text-sky-200' : 'text-zinc-200')}>{m.title}</div>
              <div className="mt-1 text-zinc-400">{m.text}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-zinc-400">Длительность</span>
        {[30, 45, 60].map((d) => (
          <button
            key={d}
            onClick={() => setDuration(d)}
            className={clsx('rounded-lg px-3 py-1.5', d === duration ? 'bg-sky-400 text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:text-zinc-100')}
          >
            {d} мин
          </button>
        ))}
      </div>

      {tracks.map((tr) => (
        <section key={tr.id} className="space-y-3">
          <h2 className="font-semibold text-zinc-100">{tr.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {interviewProblems
              .filter((p) => p.track === tr.id)
              .map((p) => {
                const best = results[`interview:${p.id}`]?.best
                return (
                  <button
                    key={p.id}
                    onClick={() => start(p)}
                    className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-left transition-colors hover:border-sky-400/60"
                  >
                    <div className="font-medium">{p.title}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-zinc-400">{p.prompt}</div>
                    {best !== undefined && <div className="mt-2 text-xs text-zinc-500">лучший результат: {best}</div>}
                  </button>
                )
              })}
          </div>
        </section>
      ))}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
        Как это проходит на реальном собеседовании: 5 минут на требования и масштаб, 5 на оценки, 15 на общую схему, остальное на deep dive по узким местам.
        Не бросайся рисовать сразу: сначала спроси, сколько пользователей и что важнее, задержка или согласованность. Микрофон работает в Chrome.
      </div>
    </div>
  )
}

// ───────────────────────── Собеседование ─────────────────────────

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

/** Web Speech API errors in plain Russian. */
const speechErrors: Record<string, string> = {
  'not-allowed': 'Браузер не дал доступ к микрофону. Разреши его в настройках сайта (значок слева от адреса) и в macOS: Системные настройки → Конфиденциальность → Микрофон.',
  'service-not-allowed': 'Браузер не разрешает распознавание речи. Оно работает в Google Chrome; в Яндекс Браузере, Brave, Arc и Firefox обычно нет.',
  network: 'Сервис распознавания недоступен. Chrome отправляет звук на серверы Google, из РФ они часто не отвечают без VPN.',
  'audio-capture': 'Микрофон не найден или занят другим приложением.',
  'no-speech': 'Не услышал речи. Проверь, что выбран правильный микрофон.',
}

const SpeechRecognitionCtor: (new () => Recognition) | undefined =
  typeof window !== 'undefined'
    ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as
        | (new () => Recognition)
        | undefined
    : undefined

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ru-RU'
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('ru'))
  if (voice) u.voice = voice
  window.speechSynthesis.speak(u)
}

function Live({ session, problem, setSession }: { session: Session; problem: InterviewProblem; setSession: (s: Session | null) => void }) {
  const [now, setNow] = useState(Date.now())
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voice, setVoice] = useState(false)
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const base = useRef('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [session.history.length, loading])
  useEffect(() => () => rec.current?.stop(), [])

  const elapsedMin = (now - session.startedAt) / 60000
  const frac = Math.min(1, elapsedMin / session.durationMin)
  const phaseIdx = phases.findIndex((p) => frac < p.until)
  const left = Math.max(0, session.durationMin * 60 - (now - session.startedAt) / 1000)
  const timeUp = left <= 0
  const payload = (history: Turn[]) => ({ problem, history, design: designOf(problem.id), elapsedMin, durationMin: session.durationMin, mode: session.mode })

  const hints = useProgress((s) => s.inventory['perk-iv-hint'] ?? 0)
  const askHint = async () => {
    if (loading || !useProgress.getState().useItem('perk-iv-hint')) return
    const history: Turn[] = [...session.history, { role: 'candidate', text: '💡 [взял подсказку]' }]
    setSession({ ...session, history })
    setLoading(true)
    setError(null)
    try {
      const r = await post<{ text: string }>('/api/interview/turn', { ...payload(history), hint: true })
      setSession({ ...session, history: [...history, { role: 'interviewer', text: r.text }] })
      if (voice) speak(r.text)
    } catch (e) {
      setError(`Интервьюер не ответил: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const send = async () => {
    const text = msg.trim()
    if (!text || loading) return
    rec.current?.stop()
    const history: Turn[] = [...session.history, { role: 'candidate', text }]
    setSession({ ...session, history })
    setMsg('')
    base.current = ''
    setLoading(true)
    setError(null)
    try {
      const r = await post<{ text: string }>('/api/interview/turn', payload(history))
      setSession({ ...session, history: [...history, { role: 'interviewer', text: r.text }] })
      if (voice) speak(r.text)
    } catch (e) {
      setError(`Интервьюер не ответил: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const finish = async () => {
    setGrading(true)
    setError(null)
    window.speechSynthesis?.cancel()
    try {
      const grade = await post<Grade>('/api/interview/grade', payload(session.history))
      useProgress.getState().record(`interview:${problem.id}`, grade.score)
      setSession({ ...session, finishedAt: Date.now(), grade })
    } catch (e) {
      setError(`Не удалось получить разбор: ${(e as Error).message}`)
      setGrading(false)
    }
  }

  const toggleMic = async () => {
    if (!SpeechRecognitionCtor) return
    if (listening) {
      rec.current?.stop()
      return
    }
    setError(null)
    // Явный запрос микрофона: показывает диалог разрешения и сразу говорит, если доступа нет.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch (e) {
      setError(`Микрофон: ${speechErrors['not-allowed']} (${(e as Error).name})`)
      return
    }
    const r = new SpeechRecognitionCtor()
    r.lang = 'ru-RU'
    r.continuous = true
    r.interimResults = true
    base.current = msg ? `${msg.trim()} ` : ''
    r.onresult = (e) => {
      let finalText = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText += res[0].transcript
        else interim += res[0].transcript
      }
      if (finalText) base.current += finalText
      setMsg(base.current + interim)
    }
    r.onend = () => setListening(false)
    r.onerror = (e) => {
      setListening(false)
      if (e.error !== 'aborted') setError(`Голосовой ввод: ${speechErrors[e.error] ?? e.error}`)
    }
    rec.current = r
    try {
      r.start()
      setListening(true)
    } catch (e) {
      setError(`Голосовой ввод не запустился: ${(e as Error).message}`)
    }
  }

  const mm = Math.floor(left / 60)
  const ss = Math.floor(left % 60)

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-2">
        <div className="font-medium">{problem.title}</div>
        <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          режим: {interviewModes.find((m) => m.id === (session.mode ?? 'standard'))?.title}
        </span>
        <div className="flex gap-1">
          {phases.map((p, i) => (
            <span
              key={p.name}
              className={clsx(
                'rounded-md px-2 py-0.5 text-xs',
                i === phaseIdx ? 'bg-sky-400/20 text-sky-200' : i < phaseIdx || timeUp ? 'text-zinc-500 line-through' : 'text-zinc-500',
              )}
            >
              {p.name}
            </span>
          ))}
        </div>
        <div className={clsx('ml-auto flex items-center gap-1.5 font-mono text-sm', timeUp ? 'text-rose-300' : left < 300 ? 'text-amber-300' : 'text-zinc-300')}>
          <Clock size={14} /> {timeUp ? 'время вышло' : `${mm}:${String(ss).padStart(2, '0')}`}
        </div>
        <button
          onClick={() => {
            if (window.confirm('Бросить собеседование без разбора?')) setSession(null)
          }}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          Выйти
        </button>
        <button
          onClick={finish}
          disabled={grading || session.history.length < 3}
          className="flex items-center gap-1.5 rounded-lg bg-sky-400 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-sky-300 disabled:opacity-40"
        >
          {grading && <LoaderCircle size={14} className="animate-spin" />}
          {grading ? 'Комиссия совещается' : 'Завершить и получить разбор'}
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_440px]">
        <div className="min-h-[50vh] border-r border-zinc-800">
          <ReactFlowProvider>
            <DesignCanvas draftId={draftId(problem.id)} />
          </ReactFlowProvider>
        </div>

        <div className="flex min-h-0 flex-col p-3">
          <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            {session.history.map((h, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={clsx('max-w-[90%] rounded-2xl px-4 py-2.5 text-sm', h.role === 'candidate' ? 'ml-auto bg-sky-400/15 text-sky-50' : 'bg-zinc-800 text-zinc-100')}
              >
                {h.role === 'interviewer' && <div className="mb-0.5 text-[11px] text-zinc-500">интервьюер</div>}
                <div className="whitespace-pre-wrap">{h.text}</div>
              </motion.div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <LoaderCircle size={14} className="animate-spin" /> интервьюер думает
              </div>
            )}
            {timeUp && !grading && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3 text-sm text-amber-100">
                Время вышло. На реальном собеседовании здесь прощаются. Завершай и смотри разбор.
              </div>
            )}
            <div ref={end} />
          </div>
          {error && <div className="mt-2 text-sm text-rose-300">{error}</div>}
          <div className="mt-3 flex gap-2">
            <textarea
              value={msg}
              onChange={(e) => {
                setMsg(e.target.value)
                base.current = e.target.value
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={3}
              placeholder="Отвечай как на собеседовании: вслух рассуждения, цифры, компромиссы…"
              className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm outline-none focus:border-sky-400"
            />
            <div className="flex flex-col gap-2">
              <button onClick={send} disabled={loading || !msg.trim()} className="flex-1 rounded-xl bg-sky-400 px-3 text-zinc-950 hover:bg-sky-300 disabled:opacity-40" aria-label="Отправить">
                <Send size={18} />
              </button>
              {hints > 0 && (session.mode ?? 'standard') !== 'coach' && (
                <button
                  onClick={askHint}
                  disabled={loading}
                  className="rounded-xl bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100 disabled:opacity-40"
                  title="Подсказка интервьюера: одно направление вопросом. Разбор это учтёт"
                >
                  💡{hints}
                </button>
              )}
              {SpeechRecognitionCtor && (
                <button
                  onClick={toggleMic}
                  className={clsx('rounded-xl px-3 py-2', listening ? 'bg-rose-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:text-zinc-100')}
                  aria-label={listening ? 'Остановить диктовку' : 'Диктовать'}
                  title={listening ? 'Остановить диктовку' : 'Диктовать голосом'}
                >
                  {listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
            </div>
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={voice}
              onChange={(e) => {
                setVoice(e.target.checked)
                if (!e.target.checked) window.speechSynthesis?.cancel()
              }}
              className="accent-sky-400"
            />
            {voice ? <Volume2 size={14} /> : <VolumeX size={14} />} Озвучивать реплики интервьюера
          </label>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Разбор ─────────────────────────

function Result({ session, problem, onReset }: { session: Session; problem: InterviewProblem; onReset: () => void }) {
  const g = session.grade!
  const hire = hireLabel[g.hire] ?? { text: g.hire, cls: 'bg-zinc-800 text-zinc-200' }
  const color = g.score >= 70 ? 'text-emerald-300' : g.score >= 45 ? 'text-amber-300' : 'text-rose-300'
  const minutes = Math.round(((session.finishedAt ?? Date.now()) - session.startedAt) / 60000)

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="text-sm text-zinc-500">
            {problem.title} · {minutes} мин · {session.history.filter((h) => h.role === 'candidate').length} реплик
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span className={clsx('font-display text-5xl font-semibold', color)}>{g.score}</span>
            <span className={clsx('rounded-lg px-2.5 py-1 text-sm font-medium', hire.cls)}>{hire.text}</span>
            <span className="rounded-lg bg-zinc-800 px-2.5 py-1 text-sm text-zinc-300">уровень: {g.level}</span>
          </div>
        </div>
        <button onClick={onReset} className="ml-auto rounded-lg bg-sky-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-300">
          Новое собеседование
        </button>
      </div>
      <p className="text-zinc-300">{g.summary}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {g.axes.map((a) => (
          <div key={a.axis} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-200">{a.axis}</span>
              <span className="flex gap-1" aria-label={`${a.score} из 4`}>
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={clsx('h-2 w-5 rounded-full', i <= a.score ? (a.score >= 3 ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-zinc-700')} />
                ))}
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-400">{a.comment}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ListCard title="Сильные стороны" items={g.strengths} cls="text-emerald-300" />
        <ListCard title="Что сделать иначе" items={g.improvements} cls="text-amber-300" />
        <ListCard title="Не затронул" items={g.missed} cls="text-rose-300" />
      </div>

      <details className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <summary className="cursor-pointer text-sm text-zinc-200">Запись собеседования</summary>
        <div className="mt-3 space-y-2 text-sm">
          {session.history.map((h, i) => (
            <p key={i} className={h.role === 'candidate' ? 'text-sky-100' : 'text-zinc-400'}>
              <span className="text-zinc-500">{h.role === 'candidate' ? 'Ты: ' : 'Интервьюер: '}</span>
              {h.text}
            </p>
          ))}
        </div>
      </details>
    </div>
  )
}

function ListCard({ title, items, cls }: { title: string; items: string[]; cls: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className={clsx('text-sm font-medium', cls)}>{title}</div>
      <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
        {items.length ? items.map((x) => <li key={x}>{x}</li>) : <li className="text-zinc-500">—</li>}
      </ul>
    </div>
  )
}
