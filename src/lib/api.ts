export async function postApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  // Vite proxy answers with an empty body when the api process is down.
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(json.error ?? (text ? res.statusText : `AI-сервер не отвечает (HTTP ${res.status}). Запущен ли pnpm dev:api?`))
  return json as T
}

/** POST that reads a plain-text stream; onText gets the whole text so far. Server errors come after a NUL. */
export async function streamApi(path: string, body: unknown, onText: (text: string) => void, signal?: AbortSignal): Promise<string> {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal })
  if (!res.ok || !res.body) {
    const text = await res.text()
    const json = text.startsWith('{') ? JSON.parse(text) : {}
    throw new Error(json.error ?? (text ? res.statusText : `AI-сервер не отвечает (HTTP ${res.status}). Запущен ли pnpm dev:api?`))
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    text += value
    onText(text.split('\0')[0])
  }
  const nul = text.indexOf('\0')
  if (nul >= 0) throw new Error(text.slice(nul + 1) || 'ошибка генерации')
  return text
}
