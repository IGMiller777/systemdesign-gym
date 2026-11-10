import { serve } from '@hono/node-server'
import { type Context, Hono } from 'hono'
import { streamText } from 'hono/streaming'
import { MODEL, runClaude, streamClaude } from './claude'
import { ctfChat, type CtfChatRequest, ctfDefenses, ctfGuess } from './ctf'
import { buildExplainPrompt, type ExplainRequest, explainSchema, explainSystem } from './explain'
import { loadProgress, saveProgress } from './progress'
import { buildGradePrompt, type GradeRequest, gradeSchema, gradeSystem } from './grade'
import { buildInterviewGradePrompt, buildInterviewPrompt, interviewGradeSchema, interviewGradeSystem, interviewSystemFor, type InterviewRequest } from './interview'
import { askSystem, buildAskPrompt, type AskRequest } from './ask'
import { buildPostmortemPrompt, type PostmortemRequest, postmortemSystem } from './postmortem'
import { buildScenarioPrompt, checkScenario, type ScenarioRequest, scenarioSchema, scenarioSystem } from './scenario'
import type { Scenario } from '../src/sim/types'

const PORT = Number(process.env.API_PORT ?? 5801)
const app = new Hono()

function route<T>(path: string, handler: (body: T) => Promise<unknown>) {
  app.post(path, async (c) => {
    try {
      const result = await handler(await c.req.json<T>())
      return c.json(typeof result === 'string' ? { text: result } : result)
    } catch (e) {
      console.error(e)
      return c.json({ error: (e as Error).message }, 500)
    }
  })
}

route<GradeRequest>('/api/grade', (b) => runClaude(buildGradePrompt(b), { system: gradeSystem, schema: gradeSchema }))
route<ExplainRequest>('/api/explain', (b) => runClaude(buildExplainPrompt(b), { system: explainSystem, schema: explainSchema }))
route<CtfChatRequest>('/api/ctf/chat', (b) => ctfChat(b))
route<{ level: number; guess: string }>('/api/ctf/guess', async (b) => ({ ok: ctfGuess(b.level, b.guess) }))
app.get('/api/ctf/levels', (c) => c.json(ctfDefenses))
route<InterviewRequest>('/api/interview/turn', (b) => runClaude(buildInterviewPrompt(b), { system: interviewSystemFor(b.mode) }))
route<InterviewRequest>('/api/interview/grade', (b) =>
  runClaude(buildInterviewGradePrompt(b), { system: interviewGradeSystem, schema: interviewGradeSchema }),
)
route<AskRequest>('/api/ask', (b) => runClaude(buildAskPrompt(b), { system: askSystem }))
// Plain-text stream of the answer. Errors before the first chunk are a JSON 500;
// later ones are appended after a NUL separator, so the client can tell them from the text.
app.post('/api/ask/stream', async (c) => {
  const gen = streamClaude(buildAskPrompt(await c.req.json<AskRequest>()), { system: askSystem })
  let first: IteratorResult<string>
  try {
    first = await gen.next()
  } catch (e) {
    console.error(e)
    return c.json({ error: (e as Error).message }, 500)
  }
  return streamText(c, async (s) => {
    s.onAbort(() => void gen.return(undefined))
    try {
      if (!first.done) await s.write(first.value)
      for await (const chunk of gen) await s.write(chunk)
    } catch (e) {
      console.error(e)
      await s.write(`\0${(e as Error).message}`)
    }
  })
})
route<PostmortemRequest>('/api/postmortem', (b) => runClaude(buildPostmortemPrompt(b), { system: postmortemSystem }))
route<ScenarioRequest>('/api/scenario', async (b) => {
  // Generate, then playtest with the engine; feed problems back to the model (up to 2 retries).
  let feedback = ''
  let sc: Scenario | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    sc = (await runClaude(buildScenarioPrompt(b) + feedback, { system: scenarioSystem, schema: scenarioSchema })) as Scenario
    const problem = checkScenario(sc)
    if (!problem) return sc
    console.log(`scenario attempt ${attempt + 1} rejected: ${problem}`)
    feedback = `\n\nПредыдущая версия не прошла плейтест движком: ${problem}. Исправь цифры.`
  }
  return sc!
})

// Прогресс игрока: файл в data/ вместо localStorage, чтобы не терялся при очистке браузера.
app.get('/api/progress/:name', async (c) => {
  const body = await loadProgress(c.req.param('name'))
  return body === null ? c.body(null, 204) : c.body(body, 200, { 'Content-Type': 'application/json' })
})
const putProgress = async (c: Context) => {
  try {
    await saveProgress(c.req.param('name'), await c.req.text())
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400)
  }
}
app.put('/api/progress/:name', putProgress)
app.post('/api/progress/:name', putProgress) // sendBeacon on page close

const server = serve({ fetch: app.fetch, port: PORT }, () => console.log(`ai api on :${PORT} (model: ${MODEL})`))

// tsx watch restarts via SIGTERM; close the port immediately so the new process can bind it
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => {
    server.close()
    process.exit(0)
  })
