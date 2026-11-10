/**
 * Sequence diagram from a ```seq block in lesson markdown.
 *
 *   Браузер | Сервер                 first line: participants
 *   Браузер -> Сервер: SYN           message (numbered)
 *   Сервер --> Браузер: ответ        dashed arrow (reply)
 *   Браузер => Сервер: GET /         encrypted message (green, lock)
 *   note Сервер: проверяет подпись   note over one participant
 *   note: общий секрет готов          note across all participants
 *   --- 1 RTT                         divider
 */
export type SeqRow =
  | { kind: 'msg'; from: number; to: number; text: string; style: 'solid' | 'dashed' | 'secure'; n: number }
  | { kind: 'note'; text: string }
  /** Notes over single participants; consecutive ones over different participants share a row. */
  | { kind: 'notes'; items: { at: number; text: string }[] }
  | { kind: 'divider'; text: string }

export function parseSeq(src: string): { actors: string[]; rows: SeqRow[] } {
  const lines = src.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) throw new Error('пустая схема')
  const actors = lines[0].split('|').map((s) => s.trim())
  if (actors.length < 2) throw new Error('первая строка: участники через |')
  const idx = (name: string) => {
    const i = actors.indexOf(name.trim())
    if (i < 0) throw new Error(`неизвестный участник «${name.trim()}»`)
    return i
  }
  let n = 0
  const rows: SeqRow[] = []
  const parseLine = (line: string): SeqRow => {
    const div = line.match(/^---\s*(.*)$/)
    if (div) return { kind: 'divider', text: div[1] }
    const note = line.match(/^note(?:\s+([^:]+?))?\s*:\s*(.+)$/)
    if (note) return note[1] ? { kind: 'notes', items: [{ at: idx(note[1]), text: note[2] }] } : { kind: 'note', text: note[2] }
    const msg = line.match(/^(.+?)\s*(-->|=>|->)\s*(.+?)\s*:\s*(.+)$/)
    if (msg) {
      const style = msg[2] === '-->' ? 'dashed' : msg[2] === '=>' ? 'secure' : 'solid'
      return { kind: 'msg', from: idx(msg[1]), to: idx(msg[3]), text: msg[4], style, n: ++n }
    }
    throw new Error(`не понял строку «${line}»`)
  }
  for (const line of lines.slice(1)) {
    const row = parseLine(line)
    const prev = rows.at(-1)
    if (row.kind === 'notes' && prev?.kind === 'notes' && !prev.items.some((x) => x.at === row.items[0].at)) prev.items.push(row.items[0])
    else rows.push(row)
  }
  return { actors, rows }
}
