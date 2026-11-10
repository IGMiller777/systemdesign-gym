/**
 * Content checks for lessons and wiki: broken internal links, em-dashes, quiz answers given away by length,
 * banned filler phrases. Usage: ./node_modules/.bin/tsx scripts/check-content.ts [file-substring]
 */
import { concepts } from '../src/learn/concepts'
import { curriculum } from '../src/learn/curriculum'
import { wikiEntries } from '../src/wiki'
import { cards } from '../src/wiki/cards'
import { parseSeq } from '../src/components/seq'
import { parseTimeline } from '../src/components/timeline-parse'
import { parsePerks } from '../src/components/perks-parse'
import { GLOSSARY, NOT_TERMS } from '../src/components/glossary'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const only = process.argv[2]
const wikiIds = new Set(wikiEntries.map((e) => e.id))
const lessonIds = new Set(concepts.map((c) => c.id))
const problems: string[] = []

const files = [
  'src/learn/concepts-1.ts', 'src/learn/concepts-2.ts', 'src/learn/concepts-sec.ts', 'src/learn/concepts-ops.ts',
  'src/learn/concepts-ops2.ts', 'src/learn/concepts-frontend.ts', 'src/learn/concepts-llm.ts',
  'src/wiki/entries.ts', 'src/wiki/entry-vector.ts', 'src/wiki/frontend-wiki.ts', 'src/wiki/llm-wiki.ts',
  'src/wiki/cards-a.ts', 'src/wiki/cards-b.ts', 'src/wiki/card-vector.ts',
  'src/wiki/compare-data.ts', 'src/wiki/impl-data.ts', 'src/wiki/impl-infra.ts', 'src/wiki/extra-vector.ts',
].filter((f) => !only || f.includes(only))

const banned = [/\bне просто\b/i, /стоит отметить/i, /по сути/i, /фактически,/i, /ключевой момент/i, /важно понимать/i, /\bВывод:/, /\bВажно:/, /давайте разберёмся/i]

for (const f of files) {
  const text = readFileSync(join(import.meta.dirname, '..', f), 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (line.includes('—')) problems.push(`${f}:${i + 1}: em-dash`)
    for (const b of banned) if (b.test(line)) problems.push(`${f}:${i + 1}: filler ${b}`)
    if (/^\s*(HTTPS?|TCP|TLS|DNS|SQL|REST|gRPC)\s+это\s+язык/i.test(line.replace(/^>\s*/, '').replace(/\*\*/g, ''))) problems.push(`${f}:${i + 1}: протокол назван языком`)
    for (const m of line.matchAll(/\]\(\/(wiki|learn)\/([a-z0-9-]+)\)/g)) {
      const ok = m[1] === 'wiki' ? wikiIds.has(m[2]) : lessonIds.has(m[2])
      if (!ok) problems.push(`${f}:${i + 1}: broken link /${m[1]}/${m[2]}`)
    }
  })
}

// ```seq diagrams must parse
for (const f of files) {
  const text = readFileSync(join(import.meta.dirname, '..', f), 'utf8').replaceAll('\\`', '`')
  for (const m of text.matchAll(/```seq\n([\s\S]*?)```/g))
    try {
      parseSeq(m[1])
    } catch (e) {
      problems.push(`${f}: seq: ${(e as Error).message}`)
    }
  for (const m of text.matchAll(/```timeline\n([\s\S]*?)```/g))
    try {
      parseTimeline(m[1])
    } catch (e) {
      problems.push(`${f}: timeline: ${(e as Error).message}`)
    }
  for (const m of text.matchAll(/```perks\n([\s\S]*?)```/g))
    try {
      parsePerks(m[1])
    } catch (e) {
      problems.push(`${f}: perks: ${(e as Error).message}`)
    }
}

// Every lesson ends with «На вашем проекте» (```perks cards) right before «Что дальше»
if (!only)
  for (const c of concepts) {
    const t = c.sections.map((s) => s.title)
    const i = t.indexOf('На вашем проекте')
    if (i < 0 || !c.sections[i].body.includes('```perks') || t[i + 1] !== 'Что дальше') problems.push(`lesson ${c.id}: нет секции «На вашем проекте» с perks перед «Что дальше»`)
  }

// Every abbreviation in lesson prose has a glossary entry (tooltip on first mention)
for (const f of files.filter((f) => f.startsWith('src/learn/'))) {
  const prose = readFileSync(join(import.meta.dirname, '..', f), 'utf8').replace(/\\`\\`\\`[\s\S]*?\\`\\`\\`/g, ' ').replace(/\\`[^`]*?\\`/g, ' ')
  const missing = new Set<string>()
  for (const m of prose.matchAll(/(?<![A-Za-z0-9_\-./])([A-Z][A-Z0-9]+)(?![A-Za-z0-9_])/g))
    if (!(m[1] in GLOSSARY) && !NOT_TERMS.has(m[1])) missing.add(m[1])
  if (missing.size) problems.push(`${f}: сокращения без словаря (src/components/glossary.ts): ${[...missing].join(', ')}`)
}

// Quiz answer given away by length (correct option > 1.3x longest distractor)
const quizzes = [
  ...concepts.map((c) => ({ where: `lesson ${c.id}`, quiz: c.quiz })),
  ...Object.entries(cards).map(([id, c]) => ({ where: `card ${id}`, quiz: c.quiz })),
]
for (const { where, quiz } of quizzes)
  for (const q of quiz) {
    const L = q.options.map((o) => o.length)
    const others = Math.max(...L.filter((_, i) => i !== q.correct))
    if (L[q.correct] > 1.3 * others) problems.push(`${where}: correct answer longest («${q.q.slice(0, 50)}…»)`)
  }

console.log(problems.length ? problems.join('\n') : 'content OK')
console.log(`\n${problems.length} problems`)

if (process.argv.includes('--order')) {
  // Lesson order along the learning path, for "Что дальше" links
  const seen = new Set<string>()
  for (const m of curriculum)
    for (const s of m.steps) if (s.kind === 'concept' && !seen.has(s.id)) {
      seen.add(s.id)
      console.log(`${m.id}\t${s.id}\t${concepts.find((c) => c.id === s.id)?.title}`)
    }
}
