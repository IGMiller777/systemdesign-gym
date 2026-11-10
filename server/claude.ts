import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'

export const MODEL = process.env.GRADER_MODEL ?? 'sonnet'

/**
 * Runs the local Claude Code CLI headless (`claude -p`), no tools, no MCP, no session saved.
 * With a JSON schema returns the structured object, otherwise the markdown text.
 */
export function runClaude(prompt: string, opts: { system: string; schema?: object; model?: string }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--output-format', 'json',
      '--model', opts.model ?? MODEL,
      '--system-prompt', opts.system,
      '--tools', '',
      '--strict-mcp-config',
      '--no-session-persistence',
    ]
    if (opts.schema) args.push('--json-schema', JSON.stringify(opts.schema))
    const child = spawn('claude', args, { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${err || out}`))
      try {
        const res = JSON.parse(out)
        if (res.is_error) return reject(new Error(res.result ?? 'claude error'))
        if (!opts.schema) return resolve(res.result ?? '')
        if (res.structured_output) return resolve(res.structured_output)
        const text: string = res.result ?? ''
        resolve(JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)))
      } catch (e) {
        reject(new Error(`cannot parse claude output: ${(e as Error).message}\n${out.slice(0, 500)}`))
      }
    })
    child.stdin.end(prompt)
  })
}

/** Same CLI call, but yields the answer text chunk by chunk as the model writes it. */
export async function* streamClaude(prompt: string, opts: { system: string; model?: string }): AsyncGenerator<string> {
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--model', opts.model ?? MODEL,
    '--system-prompt', opts.system,
    '--tools', '',
    '--strict-mcp-config',
    '--no-session-persistence',
  ]
  const child = spawn('claude', args, { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] })
  let err = ''
  child.stderr.on('data', (d) => (err += d))
  const exited = new Promise<number | null>((resolve) => child.on('close', resolve))
  child.stdin.end(prompt)
  let buf = ''
  let error: string | null = null
  try {
    for await (const d of child.stdout) {
      buf += d
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 1)
        if (!line.trim()) continue
        const msg = JSON.parse(line)
        if (msg.type === 'stream_event' && msg.event.type === 'content_block_delta' && msg.event.delta.type === 'text_delta') yield msg.event.delta.text
        else if (msg.type === 'result' && msg.is_error) error = msg.result ?? 'claude error'
      }
    }
  } finally {
    // Client went away: stop generating.
    if (child.exitCode === null) child.kill()
  }
  const code = await exited
  if (error) throw new Error(error)
  if (code !== 0) throw new Error(`claude exited ${code}: ${err}`)
}
