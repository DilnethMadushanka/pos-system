import { ChartBar } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Badge, EmptyState, PageHeader } from '../components/ui'
import { db } from '../db'
import { money, startOfDay } from '../lib/format'
import { useT } from '../lib/i18n'
import { useSettings } from '../lib/useSettings'

const ranges = [
  { id: 'today', label: 'Today' },
  { id: '7', label: '7 days' },
  { id: '30', label: '30 days' },
  { id: 'month', label: 'This month' },
]

function rangeStart(id: string) {
  const today = startOfDay(Date.now())
  if (id === 'today') return today
  if (id === '7') return today - 6 * 86_400_000
  if (id === '30') return today - 29 * 86_400_000
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
}

export default function Reports() {
  const settings = useSettings()
  const t = useT()
  const [range, setRange] = useState('7')
  const m = (n: number) => money(n, settings.currency)

  const sales = useLiveQuery(async () => {
    const from = rangeStart(range)
    return (await db.sales.where('createdAt').aboveOrEqual(from).toArray()).filter((s) => s.status === 'paid')
  }, [range])
  const products = useLiveQuery(() => db.products.toArray(), [])

  const report = useMemo(() => {
    const list = sales ?? []
    const revenue = list.reduce((s, x) => s + x.total, 0)
    const net = list.reduce((s, x) => s + x.total - x.tax, 0)
    const cogs = list.reduce((s, x) => s + x.lines.reduce((c, l) => c + l.cost * l.qty, 0), 0)

    const byProduct = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const s of list)
      for (const l of s.lines) {
        const cur = byProduct.get(l.name) ?? { name: l.name, qty: 0, revenue: 0 }
        cur.qty += l.qty
        cur.revenue += l.qty * l.price
        byProduct.set(l.name, cur)
      }

    const hourly = range === 'today'
    const buckets = new Map<string, { label: string; total: number }>()
    const from = rangeStart(range)
    if (hourly) {
      for (let h = 0; h < 24; h++) buckets.set(String(h), { label: String(h), total: 0 })
      for (const s of list) buckets.get(String(new Date(s.createdAt).getHours()))!.total += s.total
    } else {
      const days = Math.round((startOfDay(Date.now()) - from) / 86_400_000) + 1
      for (let i = 0; i < days; i++) {
        const d = new Date(from + i * 86_400_000)
        buckets.set(String(startOfDay(d.getTime())), {
          label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          total: 0,
        })
      }
      for (const s of list) {
        const b = buckets.get(String(startOfDay(s.createdAt)))
        if (b) b.total += s.total
      }
    }

    const methods = { cash: 0, card: 0, transfer: 0 }
    for (const s of list) methods[s.method] += s.total

    return {
      count: list.length,
      revenue,
      profit: net - cogs,
      average: list.length ? revenue / list.length : 0,
      top: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
      series: [...buckets.values()],
      hourly,
      methods,
    }
  }, [sales, range])

  const lowStock = (products ?? [])
    .filter((p) => p.trackStock && p.stock <= p.lowStock)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8)

  const max = Math.max(...report.series.map((b) => b.total), 1)
  const labelEvery = report.series.length > 14 ? 5 : report.hourly ? 3 : 1

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-6">
        <PageHeader title={t('Reports')}>
          <div className="flex overflow-hidden rounded-lg border border-line">
            {ranges.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                aria-pressed={range === r.id}
                className={`min-h-10 px-3 text-sm font-medium ${
                  range === r.id ? 'bg-ink text-surface' : 'bg-panel text-muted hover:text-ink'
                }`}
              >
                {t(r.label)}
              </button>
            ))}
          </div>
        </PageHeader>

        {sales === undefined ? (
          <div className="h-64 animate-pulse rounded-lg bg-raised" />
        ) : report.count === 0 ? (
          <div className="rounded-lg border border-line bg-panel">
            <EmptyState
              icon={<ChartBar size={24} />}
              title={t('No sales yet in this period')}
              body={t('Sales, profit and best sellers show up here as soon as you complete a sale.')}
            />
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-panel lg:grid-cols-4">
              {[
                [t('Sales'), m(report.revenue)],
                [t('Profit'), m(report.profit)],
                [t('Orders'), String(report.count)],
                [t('Average sale'), m(report.average)],
              ].map(([label, value], i) => (
                <div
                  key={label}
                  className={`flex flex-col gap-1 p-4 ${i % 2 === 1 ? 'border-l border-line' : ''} ${
                    i >= 2 ? 'border-t border-line lg:border-t-0' : ''
                  } ${i === 2 ? 'lg:border-l' : ''}`}
                >
                  <dt className="text-xs font-medium text-muted">{label}</dt>
                  <dd className="num text-xl font-semibold tracking-tight">{value}</dd>
                </div>
              ))}
            </dl>

            <section className="flex flex-col gap-3">
              <h2 className="text-base font-semibold tracking-tight">
                {t(report.hourly ? 'Sales by hour' : 'Sales by day')}
              </h2>
              <div className="rounded-lg border border-line bg-panel p-4">
                <div className="flex h-44 items-end gap-1" role="img" aria-label={t('Sales chart')}>
                  {report.series.map((b, i) => (
                    <div key={i} className="group relative flex h-full flex-1 items-end" title={`${b.label}: ${m(b.total)}`}>
                      <div
                        className="w-full rounded-t-lg bg-accent transition-opacity group-hover:opacity-80"
                        style={{ height: `${(b.total / max) * 100}%`, minHeight: b.total > 0 ? 3 : 0 }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-1 text-[11px] text-faint">
                  {report.series.map((b, i) => (
                    <div key={i} className="num flex-1 overflow-visible whitespace-nowrap text-center">
                      {i % labelEvery === 0 ? b.label : ''}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
              <section className="flex flex-col gap-3">
                <h2 className="text-base font-semibold tracking-tight">{t('Best sellers')}</h2>
                <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
                  {report.top.map((p) => (
                    <li key={p.name} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="num text-xs text-faint">{t('{n} sold', { n: p.qty })}</div>
                      </div>
                      <div className="num text-sm font-semibold">{m(p.revenue)}</div>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="text-base font-semibold tracking-tight">{t('Payment methods')}</h2>
                <dl className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
                  {(
                    [
                      [t('Cash'), report.methods.cash],
                      [t('Card'), report.methods.card],
                      [t('Transfer'), report.methods.transfer],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between px-4 py-3 text-sm">
                      <dt className="text-muted">{label}</dt>
                      <dd className="num font-semibold">{m(value)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </>
        )}

        {lowStock.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold tracking-tight">{t('Running low')}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {lowStock.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel px-4 py-3"
                >
                  <span className="truncate text-sm font-medium">{p.name}</span>
                  <Badge tone={p.stock <= 0 ? 'bad' : 'warn'}>{p.stock <= 0 ? t('Out') : t('{n} left', { n: p.stock })}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
