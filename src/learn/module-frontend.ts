import type { Module, Step } from './curriculum'
import type { Aspect } from '../practice/aspects'

const c = (...ids: string[]): Step[] => ids.map((id) => ({ kind: 'concept', id }))
const k = (...ids: string[]): Step[] => ids.map((id) => ({ kind: 'card', id }))
const t = (...ids: string[]): Step[] => ids.map((id) => ({ kind: 'task', id }))
const d = (...ids: string[]): Step[] => ids.map((id) => ({ kind: 'duel', id }))
const x = (id: string, aspect: Aspect): Step => ({ kind: 'explain', id, aspect })
const extra = (...ids: string[]): Step[] => ids.map((id) => ({ kind: 'scenario', id, optional: true }))

export const frontendModule: Module = {
  id: 'frontend',
  emoji: '🖥️',
  title: 'Фронтенд-архитектура',
  goal: 'Выбирать стратегию рендеринга, кэшировать на всех слоях, строить realtime и слой данных клиента, проектировать виджеты и редакторы.',
  requires: ['web-basics', 'caching'],
  steps: [
    ...c('fe-rendering', 'fe-web-vitals', 'fe-caching', 'fe-realtime', 'fe-data-layer', 'fe-scale'),
    ...k('ssr-server', 'bff', 'edge-isr', 'websocket-gateway'),
    ...t(
      'est-fe-widget-egress',
      'est-fe-ws-nodes',
      'est-fe-ssr-instances',
      'ch-fe-rendering-catalog',
      'ch-fe-inbox-transport',
      'ch-fe-widget-token',
      'ch-fe-reconnect-storm',
      'ds-fe-chat-widget',
      'ds-fe-operator-inbox',
      'ds-fe-flow-builder',
    ),
    ...d(
      'fe-isr-vs-ssr-catalog',
      'fe-bff-vs-graphql',
      'fe-iframe-vs-shadow-dom',
      'fe-ws-vs-sse-console',
      'fe-reconnect-jitter',
      'fe-cursor-vs-offset',
      'ssr-csr-ssg-pages',
      'edge-html-vs-per-user',
      'bff-vs-direct',
      'react-query-vs-global-store',
      'optimistic-ui-vs-confirmed',
      'ws-sse-polling',
      'microfrontends-vs-monorepo',
      'image-cdn-vs-pregenerated',
    ),
    x('ssr-server', 'compare'),
    ...extra('fe-reconnect-storm'),
  ],
  boss: { kind: 'scenario', id: 'fe-ssr-meltdown' },
}
