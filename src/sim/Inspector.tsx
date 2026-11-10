import clsx from 'clsx'
import { BookOpen, Minus, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { blocks } from '../lib/blocks'
import { entryByBlock } from '../wiki'
import { baseOf, blockSpecs, sizeMult } from './engine'
import { fmtNum } from './SimNode'
import { KnobsPanel } from './KnobsPanel'
import type { NodeMetrics, NodeSize, SimNodeConfig } from './types'

const sizes: NodeSize[] = ['S', 'M', 'L', 'XL']

export function Inspector({
  cfg,
  m,
  onChange,
  onDelete,
  configOnly,
}: {
  cfg: SimNodeConfig
  m?: NodeMetrics
  onChange: (next: SimNodeConfig, text: string) => void
  onDelete: () => void
  /** Inherited-infra mode: topology and sizes frozen, only knobs editable. */
  configOnly?: boolean
}) {
  const spec = blockSpecs[cfg.type]
  const meta = blocks[cfg.type]
  const wiki = entryByBlock(cfg.type)
  const Icon = meta.icon
  const unitCost = spec.cost * sizeMult[cfg.size].cost
  const unitCap = spec.capacity * sizeMult[cfg.size].capacity
  const horizontal = spec.scaling === 'horizontal'

  return (
    <div className="space-y-4 p-4 text-sm">
      <div className="flex items-center gap-2">
        <div className="rounded-lg p-1.5" style={{ background: `${meta.color}22`, color: meta.color }}>
          <Icon size={18} />
        </div>
        <div className="flex-1">
          <div className="font-semibold">{cfg.label}</div>
          <div className="text-xs text-zinc-500">{meta.label}</div>
        </div>
        {wiki && (
          <Link to={`/wiki/${wiki.id}`} target="_blank" className="text-zinc-400 hover:text-sky-300" title="Справочник">
            <BookOpen size={16} />
          </Link>
        )}
      </div>

      <div className="rounded-lg bg-zinc-900 p-2 text-xs text-zinc-400">{spec.modelNote}</div>

      {cfg.type !== 'client' && (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="Ёмкость инстанса" value={`${fmtNum(unitCap)} rps`} />
            <Stat label="Цена инстанса" value={`$${Math.round(unitCost)}/мес`} />
            <Stat label="Базовая задержка" value={`${spec.baseLatencyMs} ms`} />
            <Stat label="Прогрев" value={`${spec.warmupTicks} мин`} />
          </div>

          {configOnly ? (
            <div className="rounded-lg bg-zinc-900 p-2 text-xs text-zinc-500">🔒 {cfg.instances}× {cfg.size} — железо заморожено, чини настройки</div>
          ) : (
            <>
          <div className="space-y-1.5">
            <div className="text-xs text-zinc-500">Инстансы {!horizontal && '(горизонтально не масштабируется)'}</div>
            <div className="flex items-center gap-2">
              <button
                disabled={cfg.instances <= 1 || !horizontal}
                onClick={() => onChange({ ...cfg, instances: cfg.instances - 1 }, `${cfg.label}: инстансы ${cfg.instances} → ${cfg.instances - 1}`)}
                className="rounded-lg border border-zinc-700 p-1.5 hover:bg-zinc-800 disabled:opacity-30"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center font-mono text-base">{cfg.instances}</span>
              <button
                disabled={cfg.instances >= spec.maxInstances || !horizontal}
                onClick={() => onChange({ ...cfg, instances: cfg.instances + 1 }, `${cfg.label}: инстансы ${cfg.instances} → ${cfg.instances + 1}`)}
                className="rounded-lg border border-zinc-700 p-1.5 hover:bg-zinc-800 disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
              <span className="text-xs text-zinc-500">max {spec.maxInstances}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs text-zinc-500">Размер (вертикально)</div>
            <div className="flex gap-1">
              {sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => s !== cfg.size && onChange({ ...cfg, size: s }, `${cfg.label}: размер ${cfg.size} → ${s}`)}
                  className={clsx(
                    'flex-1 rounded-lg border px-2 py-1 text-xs',
                    s === cfg.size ? 'border-sky-400 bg-sky-400/10 text-sky-200' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800',
                  )}
                >
                  <div className="font-semibold">{s}</div>
                  <div className="text-[10px] opacity-70">
                    ×{sizeMult[s].capacity} / ${Math.round(spec.cost * sizeMult[s].cost)}
                  </div>
                </button>
              ))}
            </div>
          </div>

            </>
          )}

          {(baseOf(cfg.type) === 'redis' || baseOf(cfg.type) === 'cdn') && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Hit ratio</span>
                <span className="font-mono text-zinc-300">{Math.round((cfg.hitRatio ?? 0.8) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.99}
                step={0.01}
                value={cfg.hitRatio ?? 0.8}
                onChange={(e) => onChange({ ...cfg, hitRatio: Number(e.target.value) }, `${cfg.label}: hit ratio ${Math.round(Number(e.target.value) * 100)}%`)}
                className="w-full accent-sky-400"
              />
              <div className="text-[10px] text-zinc-500">В жизни зависит от объёма памяти, TTL и распределения ключей.</div>
            </div>
          )}

          {baseOf(cfg.type) === 'gateway' && (
            <div className="space-y-1.5">
              <div className="text-xs text-zinc-500">Rate limit, rps (0 — выкл.)</div>
              <input
                type="number"
                value={cfg.rateLimit ?? 0}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  onChange({ ...cfg, rateLimit: v > 0 ? v : undefined }, `${cfg.label}: rate limit ${v || 'выкл'}`)
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono"
              />
            </div>
          )}
        </>
      )}

      {cfg.type !== 'client' && cfg.type !== 'external' && (
        <div className="space-y-1.5">
          <div className="text-xs text-zinc-500">Зона доступности</div>
          <div className="flex gap-1">
            {['a', 'b', 'c'].map((z) => (
              <button
                key={z}
                disabled={configOnly}
                onClick={() => z !== (cfg.zone ?? 'a') && onChange({ ...cfg, zone: z }, `${cfg.label}: зона ${cfg.zone ?? 'a'} → ${z}`)}
                className={clsx(
                  'flex-1 rounded-lg border px-2 py-1 text-xs disabled:opacity-40',
                  (cfg.zone ?? 'a') === z ? 'border-sky-400 bg-sky-400/10 text-sky-200' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800',
                )}
              >
                {z.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      <KnobsPanel cfg={cfg} onChange={onChange} />

      {m && cfg.type !== 'client' && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat label="Входящий поток" value={`${fmtNum(m.rps)} rps`} />
          <Stat label="Загрузка" value={`${Math.round(m.utilization * 100)}%`} tone={m.utilization >= 1 ? 'bad' : m.utilization >= 0.7 ? 'warn' : 'ok'} />
          <Stat label="Задержка" value={`${fmtNum(m.latencyMs)} ms`} />
          <Stat label="Ошибки" value={`${(m.errorRate * 100).toFixed(1)}%`} tone={m.errorRate > 0.01 ? 'bad' : 'ok'} />
          {m.backlog !== undefined && <Stat label="Очередь" value={fmtNum(m.backlog)} />}
          {m.lagSec !== undefined && <Stat label="Лаг" value={`${fmtNum(m.lagSec)} с`} />}
          <Stat label="Стоимость" value={`$${Math.round(m.costPerMonth)}/мес`} />
        </div>
      )}

      {cfg.type !== 'client' && !configOnly && (
        <button
          onClick={onDelete}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
        >
          <Trash2 size={12} /> Удалить блок
        </button>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-lg bg-zinc-900 p-2">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div
        className={clsx(
          'font-mono text-sm',
          tone === 'bad' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-300' : 'text-zinc-100',
        )}
      >
        {value}
      </div>
    </div>
  )
}
