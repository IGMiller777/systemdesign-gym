import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { SequenceDiagram } from './SequenceDiagram'
import { Perks } from './Perks'
import { Timeline } from './Timeline'
import { Term } from './Term'
import { rehypeTerms } from './rehype-terms'
import 'highlight.js/styles/github-dark-dimmed.css'

interface HastNode {
  value?: string
  properties?: { className?: string[] }
  children?: HastNode[]
}
const textOf = (n: HastNode): string => n.value ?? (n.children ?? []).map(textOf).join('')

/** ```summary: boxed markdown at the end of a lesson. */
const callouts = {
  summary: { label: '📋 Итоги', box: 'border-emerald-400/30 bg-emerald-400/[0.05]', head: 'text-emerald-300' },
} as const

/** GFM: tables, strikethrough, task lists. Wide tables scroll inside their own box. */
const components = {
  // Сокращение из словаря (первое упоминание в блоке): подсказка с расшифровкой.
  abbr: ({ node: _node, ...props }: React.ComponentProps<'abbr'> & { node?: unknown; 'data-term'?: string }) => <Term term={props['data-term'] ?? String(props.children)} />,
  // Внутренние ссылки (/wiki/…, /learn/…) открываем роутером, внешние в новой вкладке.
  a: ({ node: _node, href = '', ...props }: React.ComponentProps<'a'> & { node?: unknown }) =>
    href.startsWith('/') ? (
      <Link to={href} className="text-sky-300 underline decoration-sky-300/30 underline-offset-2 hover:decoration-sky-300" {...props} />
    ) : (
      <a href={href} target="_blank" rel="noreferrer" className="text-sky-300 underline decoration-sky-300/30 underline-offset-2" {...props} />
    ),
  // Цитата в уроке = справка-врезка: короткое объяснение термина, без которого дальше будет непонятно.
  blockquote: ({ node: _node, ...props }: React.ComponentProps<'blockquote'> & { node?: unknown }) => (
    <blockquote
      className="not-prose my-4 rounded-lg border-l-4 border-sky-400/60 bg-sky-400/[0.06] px-4 py-3 text-sm leading-relaxed text-zinc-300 [&_code]:rounded [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px] [&_p+p]:mt-2 [&_strong]:text-zinc-100"
      {...props}
    />
  ),
  // Блоки кода: своя рамка и фон, подсветка от highlight.js (язык берётся из ```js, ```http и т.д.)
  // ```seq рисуется как схема обмена сообщениями (SequenceDiagram).
  pre: ({ node, ...props }: React.ComponentProps<'pre'> & { node?: HastNode }) => {
    const code = node?.children?.[0]
    const lang = code?.properties?.className?.find((c) => c.startsWith('language-'))?.slice(9)
    if (code && lang === 'seq') return <SequenceDiagram source={textOf(code)} />
    if (code && lang === 'timeline') return <Timeline source={textOf(code)} />
    if (code && lang === 'perks') return <Perks source={textOf(code)} />
    if (code && lang === 'summary') {
      const c = callouts[lang]
      return (
        <div className={`my-5 rounded-xl border px-4 py-1 ${c.box}`}>
          <div className={`not-prose mt-3 text-xs font-semibold uppercase tracking-wide ${c.head}`}>{c.label}</div>
          <Markdown size="lg">{textOf(code)}</Markdown>
        </div>
      )
    }
    return (
    <pre
      className="not-prose my-3 overflow-x-auto rounded-lg border border-zinc-800 bg-[#1c2128] p-3.5 font-mono text-[13px] leading-relaxed text-zinc-200 [&_code]:!bg-transparent [&_code]:!p-0"
      {...props}
    />
    )
  },
  // `node` is react-markdown's AST node: keep it out of the DOM.
  table: ({ node: _node, ...props }: React.ComponentProps<'table'> & { node?: unknown }) => (
    <div className="not-prose my-3 overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full border-collapse text-left text-xs [&_td]:border-t [&_td]:border-zinc-800 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-zinc-300 [&_th]:bg-zinc-900 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_th]:text-zinc-200" {...props} />
    </div>
  ),
}

/** `lg` for long reading (lessons, wiki): 16px body, bigger quotes and tables. */
export function Markdown({ children, size = 'sm' }: { children: string; size?: 'sm' | 'lg' }) {
  return (
    <div
      className={clsx(
        'prose prose-invert max-w-none prose-headings:font-semibold prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5',
        size === 'lg' ? 'prose-base leading-relaxed prose-li:my-1 [&_blockquote]:text-[15px] [&_table]:text-sm' : 'prose-sm',
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false, plainText: ['seq', 'timeline', 'summary', 'perks'] }], rehypeTerms]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

/** One line of markdown inside lists and labels: links, `code`, **bold**, no paragraphs. */
export function InlineMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children: c }) => <>{c}</>,
        a: components.a,
        code: ({ children: c }) => <code className="rounded bg-zinc-800 px-1 font-mono text-[0.9em]">{c}</code>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
