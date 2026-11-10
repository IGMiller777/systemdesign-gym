/**
 * Timeline (waterfall) from a ```timeline block in lesson markdown: what happens on each lane over time.
 *
 *   шкала: 400 мс                                   optional: total length and unit (default: last end, «мс»)
 *   Соединение 1: TCP 0-50 hs; TLS 50-100 hs; a.js 100-200
 *   Соединение 2: TCP 0-50 hs; ждёт 50-200 wait     segments: «имя начало-конец [вид]», через «;»
 *   --- HTTP/2                                      divider between groups of lanes
 *   note: подпись под шкалой
 *
 * Kinds: data (default), hs (handshake), wait, lost, cpu.
 */
export const KINDS = { data: 'данные', hs: 'рукопожатие', wait: 'ожидание', cpu: 'обработка', lost: 'потеря' } as const
export type Kind = keyof typeof KINDS

export interface Segment { name: string; start: number; end: number; kind: Kind }
export type TimelineRow = { kind: 'lane'; label: string; segments: Segment[] } | { kind: 'divider'; text: string }

const num = (s: string) => Number(s.replace(',', '.'))

export function parseTimeline(src: string): { total: number; unit: string; rows: TimelineRow[]; notes: string[] } {
  const lines = src.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) throw new Error('пустая шкала')
  let total = 0
  let unit = 'мс'
  const rows: TimelineRow[] = []
  const notes: string[] = []
  for (const line of lines) {
    const scale = line.match(/^шкала\s*:\s*(\d+(?:[.,]\d+)?)\s*(.*)$/)
    if (scale) {
      total = num(scale[1])
      if (scale[2]) unit = scale[2]
      continue
    }
    const div = line.match(/^---\s*(.*)$/)
    if (div) {
      rows.push({ kind: 'divider', text: div[1] })
      continue
    }
    const note = line.match(/^note\s*:\s*(.+)$/)
    if (note) {
      notes.push(note[1])
      continue
    }
    const lane = line.match(/^(.+?):\s+(.+)$/)
    if (!lane) throw new Error(`не понял строку «${line}»`)
    const segments = lane[2].split(';').map((s) => s.trim()).filter(Boolean).map((s): Segment => {
      const m = s.match(/^(.*?)\s*(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)(?:\s+([a-z]+))?$/)
      if (!m) throw new Error(`отрезок «${s}»: нужно «имя начало-конец [вид]»`)
      const kind = (m[4] ?? 'data') as Kind
      if (!(kind in KINDS)) throw new Error(`неизвестный вид «${m[4]}» (есть: ${Object.keys(KINDS).join(', ')})`)
      const start = num(m[2])
      const end = num(m[3])
      if (end <= start) throw new Error(`отрезок «${s}»: конец раньше начала`)
      return { name: m[1], start, end, kind }
    })
    rows.push({ kind: 'lane', label: lane[1], segments })
  }
  const last = Math.max(0, ...rows.flatMap((r) => (r.kind === 'lane' ? r.segments.map((s) => s.end) : [])))
  if (!last) throw new Error('нет ни одного отрезка')
  if (total && last > total) throw new Error(`отрезок кончается на ${last}, а шкала ${total}`)
  return { total: total || last, unit, rows, notes }
}
