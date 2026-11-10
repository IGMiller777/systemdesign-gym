import clsx from 'clsx'
import { ArrowLeft, Check, ChevronDown, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { AskBox } from '../components/AskBox'
import { ModuleNav } from '../components/ModuleNav'
import { InlineMarkdown, Markdown } from '../components/Markdown'
import { blocks } from '../lib/blocks'
import { useProgress } from '../store'
import { getEntry, wikiCategories, wikiEntries } from '../wiki'
import { cardKey, getCard, rarityMeta } from '../wiki/cards'
import { GameCard } from '../wiki/GameCard'
import { Implementations } from '../wiki/Implementations'
import { type Aspect, aspectMeta, aspects } from '../practice/aspects'
import { ExplainItem } from '../practice/ExplainItem'
import { Quiz } from '../wiki/Quiz'
import type { Rarity, WikiCategory } from '../wiki/types'
import { SetupDiagram, StatsRadar } from '../wiki/Visuals'

const useMastered = () => {
  const results = useProgress((s) => s.results)
  return (id: string) => (results[cardKey(id)]?.best ?? 0) >= 66
}

export function WikiList() {
  const isMastered = useMastered()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<WikiCategory | 'all'>('all')
  const [rarity, setRarity] = useState<Rarity | 'all'>('all')
  const withCards = wikiEntries.filter((e) => getCard(e.id))
  const mastered = withCards.filter((e) => isMastered(e.id)).length
  const list = withCards
    .filter((e) => cat === 'all' || e.category === cat)
    .filter((e) => rarity === 'all' || getCard(e.id)!.rarity === rarity)
    .filter((e) => `${e.title} ${e.tagline}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => rarityMeta[getCard(a.id)!.rarity].order - rarityMeta[getCard(b.id)!.rarity].order)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Колода компонентов</h1>
          <p className="mt-1 text-sm text-zinc-400">Открой карточку → пойми суть за минуту → пройди квиз → карточка освоена.</p>
        </div>
        <div className="w-64">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Освоено</span>
            <span className="font-mono text-zinc-200">
              {mastered} / {withCards.length}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all" style={{ width: `${(mastered / withCards.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск…"
          className="mr-2 w-44 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-sky-400"
        />
        {(['all', ...Object.keys(wikiCategories)] as (WikiCategory | 'all')[]).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={clsx('rounded-full px-3 py-1 text-xs', cat === c ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200')}
          >
            {c === 'all' ? 'Все' : wikiCategories[c]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'common', 'rare', 'epic', 'legendary'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRarity(r)}
            className={clsx(
              'rounded-full border px-3 py-1 text-xs',
              rarity === r ? 'border-zinc-300 text-zinc-100' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300',
              r !== 'all' && rarityMeta[r].text,
            )}
          >
            {r === 'all' ? 'Любая редкость' : rarityMeta[r].label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {list.map((e) => (
          <Link key={e.id} to={`/wiki/${e.id}`} className="block">
            <GameCard entry={e} card={getCard(e.id)!} mastered={isMastered(e.id)} />
          </Link>
        ))}
      </div>
    </div>
  )
}

function Bullets({ items, tone }: { items: string[]; tone: 'good' | 'bad' }) {
  return (
    <ul className="space-y-1.5">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2 text-sm text-zinc-300">
          {tone === 'good' ? <Check size={14} className="mt-1 shrink-0 text-emerald-400" /> : <X size={14} className="mt-1 shrink-0 text-rose-400" />}
          <span>
            <InlineMarkdown>{s}</InlineMarkdown>
          </span>
        </li>
      ))}
    </ul>
  )
}

function Fold({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [o, setO] = useState(open)
  return (
    <div className="rounded-xl border border-zinc-800">
      <button onClick={() => setO(!o)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-300 hover:text-zinc-100">
        {title}
        <ChevronDown size={16} className={clsx('transition', o && 'rotate-180')} />
      </button>
      {o && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </div>
  )
}

function ExplainBlock({ entry }: { entry: NonNullable<ReturnType<typeof getEntry>> }) {
  const [params] = useSearchParams()
  const fromLink = params.get('explain') as Aspect | null
  const [aspect, setAspect] = useState<Aspect>(fromLink && aspects.includes(fromLink) ? fromLink : 'essence')
  return (
    <section
      ref={(el) => {
        if (el && fromLink) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }}
      className="space-y-3 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-5"
    >
      <div className="text-sm font-medium text-violet-200">🗣️ Объясни сам — лучший способ запомнить</div>
      <div className="flex flex-wrap gap-1.5">
        {aspects.map((a) => (
          <button
            key={a}
            onClick={() => setAspect(a)}
            className={clsx('rounded-full px-3 py-1 text-xs', a === aspect ? 'bg-violet-400 text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200')}
          >
            {aspectMeta[a].emoji} {aspectMeta[a].label}
          </button>
        ))}
      </div>
      <ExplainItem key={aspect} entry={entry} aspect={aspect} />
    </section>
  )
}

export function WikiPage() {
  const { id } = useParams()
  const isMastered = useMastered()
  const e = id ? getEntry(id) : undefined
  const card = id ? getCard(id) : undefined
  if (!e || !card)
    return (
      <div className="p-8">
        Нет такой карточки. <Link to="/wiki" className="text-sky-400">К колоде</Link>
      </div>
    )
  const color = e.block ? blocks[e.block].color : '#a1a1aa'
  const idx = wikiEntries.findIndex((x) => x.id === e.id)
  const next = wikiEntries[(idx + 1) % wikiEntries.length]

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <Link to="/wiki" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft size={14} /> Колода
        </Link>
        <Link to={`/wiki/${next.id}`} className="text-sm text-zinc-400 hover:text-zinc-200">
          {getCard(next.id)?.emoji} {next.title} →
        </Link>
      </div>

      {/* Hero */}
      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <div className="self-start">
          <GameCard entry={e} card={card} mastered={isMastered(e.id)} large />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5">
            <div className="text-xs font-semibold text-amber-300">💡 Если по-простому</div>
            <div className="mt-2 text-lg leading-relaxed text-zinc-100">{card.analogy}</div>
          </div>
          <div className="rounded-2xl border border-zinc-800 p-5">
            <div className="text-xs font-semibold text-zinc-400">⚡ Суть за 10 секунд</div>
            <ol className="mt-3 space-y-2">
              {card.tldr.map((t, i) => (
                <li key={i} className="flex gap-3 text-zinc-200">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-zinc-950" style={{ background: color }}>
                    {i + 1}
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </div>
          <StatsRadar id={e.id} card={card} color={color} />
        </div>
      </div>

      {/* Infographic */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Где живёт в архитектуре</h2>
        <SetupDiagram setup={card.setup} focusBlock={e.block} />
        <div className="text-sm text-zinc-400">{card.setup.caption}</div>
      </section>

      {/* Story */}
      <section className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] p-6">
        <div className="text-xs font-semibold text-sky-300">📖 История из прода</div>
        <h2 className="mt-1 text-xl font-semibold">{card.example.title}</h2>
        <div className="mt-3">
          <Markdown>{card.example.story}</Markdown>
        </div>
      </section>

      <Quiz key={e.id} id={e.id} quiz={card.quiz} />

      <ExplainBlock key={`x-${e.id}`} entry={e} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/20 p-4">
          <div className="mb-2 text-sm font-semibold text-emerald-300">Когда брать</div>
          <Bullets items={e.whenToUse} tone="good" />
        </div>
        <div className="rounded-xl border border-rose-500/20 p-4">
          <div className="mb-2 text-sm font-semibold text-rose-300">Когда не брать</div>
          <Bullets items={e.whenNotToUse} tone="bad" />
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Дружит с</h2>
        <div className="flex flex-wrap gap-2">
          {e.pairsWith.map((p) => {
            const other = getEntry(p.id)
            const oc = getCard(p.id)
            return (
              <Link
                key={p.id}
                to={`/wiki/${p.id}`}
                title={p.why}
                className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm hover:border-zinc-600"
              >
                <span>{oc?.emoji}</span>
                <span className="text-zinc-200">{other?.title ?? p.id}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <Implementations key={`impl-${e.id}`} id={e.id} title={e.title} />

      {/* Deep dive */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Подробнее</h2>
        <Fold title="Что это и зачем">
          <Markdown size="lg">{e.what}</Markdown>
        </Fold>
        <Fold title="Как работает внутри">
          <Markdown size="lg">{e.how}</Markdown>
          {e.diagram && <pre className="overflow-x-auto rounded-xl bg-zinc-900 p-4 text-xs text-zinc-300">{e.diagram}</pre>}
        </Fold>
        <Fold title="Цифры, которые стоит помнить">
          <div className="grid gap-2 sm:grid-cols-2">
            {e.numbers.map((n) => (
              <div key={n.metric} className="rounded-lg bg-zinc-900 p-3">
                <div className="text-xs text-zinc-500">{n.metric}</div>
                <div className="font-mono text-sm text-zinc-100">{n.value}</div>
              </div>
            ))}
          </div>
        </Fold>
        <Fold title="Плюсы и минусы">
          <div className="grid gap-4 sm:grid-cols-2">
            <Bullets items={e.pros} tone="good" />
            <Bullets items={e.cons} tone="bad" />
          </div>
        </Fold>
        <Fold title="Масштабирование">
          <Markdown size="lg">{e.scaling}</Markdown>
        </Fold>
        <Fold title="Как ломается в проде">
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
            {e.failureModes.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </Fold>
        
        <Fold title="На практике">
          <Markdown size="lg">{e.inPractice}</Markdown>
        </Fold>
      </section>

      <AskBox
        topic={e.title}
        context={`${e.tagline}\n\n${card.analogy}\n\n${e.what}`}
        suggestions={['Объясни на примере интернет-магазина', 'Какие вопросы про это задают на собеседовании?', `Как поднять ${e.title} локально и что потрогать руками?`]}
      />

      <ModuleNav kind="card" id={e.id} />
    </div>
  )
}
