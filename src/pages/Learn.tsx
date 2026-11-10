import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { AskBox } from '../components/AskBox'
import { InlineMarkdown, Markdown } from '../components/Markdown'
import { ModuleNav } from '../components/ModuleNav'
import { conceptKey, getConcept } from '../learn/concepts'
import { curriculum } from '../learn/curriculum'
import { CONCEPT_XP } from '../store'
import { getEntry } from '../wiki'
import { getCard } from '../wiki/cards'
import { Quiz } from '../wiki/Quiz'
import { SetupDiagram } from '../wiki/Visuals'

export function LearnPage() {
  const { id } = useParams()
  const c = id ? getConcept(id) : undefined
  if (!c)
    return (
      <div className="p-8">
        Урок не найден. <Link to="/path" className="text-sky-400">К пути</Link>
      </div>
    )
  // «Итоги» (keyPoints) go after the main text, before «На вашем проекте» and «Что дальше».
  const tailFrom = c.sections.findIndex((s) => s.title === 'На вашем проекте' || s.title === 'Что дальше')
  const body = tailFrom < 0 ? c.sections : c.sections.slice(0, tailFrom)
  const tail = tailFrom < 0 ? [] : c.sections.slice(tailFrom)
  const module = curriculum.find((m) => m.steps.some((s) => s.kind === 'concept' && s.id === c.id))

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <Link to={module ? `/path/${module.id}` : '/path'} className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200">
        <ArrowLeft size={14} /> {module ? `${module.emoji} ${module.title}` : 'Путь'}
      </Link>

      <div className="space-y-3">
        <div className="text-5xl">{c.emoji}</div>
        <h1 className="text-3xl font-bold tracking-tight">{c.title}</h1>
        <p className="text-lg text-zinc-400">{c.tagline}</p>
      </div>

      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5">
        <div className="text-xs font-semibold text-amber-300">💡 Если по-простому</div>
        <div className="mt-2 text-lg leading-relaxed text-zinc-100">{c.analogy}</div>
      </div>

      {c.diagram && (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-xl">
            <SetupDiagram setup={c.diagram} />
          </div>
          <div className="text-sm text-zinc-400">{c.diagram.caption}</div>
        </div>
      )}

      {body.map((s, i) => (
        <section key={i} className="space-y-2">
          <h2 className="text-xl font-semibold">{s.title}</h2>
          <Markdown size="lg">{s.body}</Markdown>
        </section>
      ))}

      {c.compare && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr>
                {c.compare.headers.map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-zinc-300">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.compare.rows.map((r, i) => (
                <tr key={i} className="border-t border-zinc-800">
                  {r.map((cell, j) => (
                    <td key={j} className={j === 0 ? 'px-3 py-2 font-medium text-zinc-100' : 'px-3 py-2 text-zinc-400'}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.04] p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">📋 Итоги</div>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-zinc-200 marker:text-emerald-400/70">
          {c.keyPoints.map((k, i) => (
            <li key={i}>
              <InlineMarkdown>{k}</InlineMarkdown>
            </li>
          ))}
        </ol>
      </div>

      {tail.map((s, i) => (
        <section key={i} className="space-y-2">
          <h2 className="text-xl font-semibold">{s.title}</h2>
          <Markdown size="lg">{s.body}</Markdown>
        </section>
      ))}

      <Quiz key={c.id} id={c.id} quiz={c.quiz} recordKey={conceptKey(c.id)} xp={CONCEPT_XP} doneLabel="урок пройден!" />

      {c.related.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-400">Карточки по теме</h2>
          <div className="flex flex-wrap gap-2">
            {c.related.map((r) => (
              <Link key={r} to={`/wiki/${r}`} className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm hover:border-zinc-600">
                {getCard(r)?.emoji} {getEntry(r)?.title ?? r}
              </Link>
            ))}
          </div>
        </section>
      )}

      <AskBox topic={c.title} context={`${c.tagline}\n${c.keyPoints.join('\n')}`} suggestions={['Приведи пример из интернет-магазина', 'Где это спрашивают на собеседовании?']} />

      <ModuleNav kind="concept" id={c.id} />
    </div>
  )
}
