import { Printer, Receipt as ReceiptIcon } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import Receipt from '../components/Receipt'
import { Badge, Button, ConfirmDialog, EmptyState, Modal, PageHeader, useToast } from '../components/ui'
import { db, voidSale, type Sale } from '../db'
import { dateTime, money, startOfDay } from '../lib/format'
import { useT } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/useSettings'

const ranges = [
  { id: 'today', label: 'Today', days: 0 },
  { id: '7', label: '7 days', days: 6 },
  { id: '30', label: '30 days', days: 29 },
  { id: 'all', label: 'All', days: -1 },
]


export default function Sales() {
  const settings = useSettings()
  const toast = useToast()
  const t = useT()
  const { hasPin, unlocked } = useAuth()
  const methodLabel = { cash: t('Cash'), card: t('Card'), transfer: t('Transfer') }
  const [range, setRange] = useState('today')
  const [open, setOpen] = useState<Sale | null>(null)
  const [confirmVoid, setConfirmVoid] = useState(false)
  const m = (n: number) => money(n, settings.currency)

  const sales = useLiveQuery(async () => {
    const r = ranges.find((x) => x.id === range)!
    const all = await db.sales.orderBy('createdAt').reverse().toArray()
    if (r.days < 0) return all
    const from = startOfDay(Date.now()) - r.days * 86_400_000
    return all.filter((s) => s.createdAt >= from)
  }, [range])

  const paid = (sales ?? []).filter((s) => s.status === 'paid')
  const revenue = paid.reduce((sum, s) => sum + s.total, 0)

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 md:p-6">
        <PageHeader title={t('Sales')}>
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

        <div className="num text-sm text-muted">
          {t(paid.length === 1 ? '{n} sale' : '{n} sales', { n: paid.length })}, <span className="font-semibold text-ink">{m(revenue)}</span>
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-panel">
          {sales === undefined ? (
            <div className="flex flex-col gap-px">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse bg-raised" />
              ))}
            </div>
          ) : sales.length === 0 ? (
            <EmptyState
              icon={<ReceiptIcon size={24} />}
              title={t('No sales in this period')}
              body={t('Completed sales will appear here with their receipts.')}
            />
          ) : (
            <ul className="divide-y divide-line">
              {sales.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setOpen(s)}
                    className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-raised"
                  >
                    <div className="min-w-0">
                      <div className="num text-sm font-medium">#{s.receiptNo}</div>
                      <div className="truncate text-xs text-faint">
                        {dateTime(s.createdAt)}, {t('{n} items', { n: s.lines.reduce((n, l) => n + l.qty, 0) })}, {methodLabel[s.method]}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {s.status === 'void' && <Badge tone="bad">{t('Voided')}</Badge>}
                      <span className={`num text-sm font-semibold ${s.status === 'void' ? 'text-faint line-through' : ''}`}>
                        {m(s.total)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {open && (
        <Modal
          title={t('Receipt #{no}', { no: open.receiptNo })}
          onClose={() => setOpen(null)}
          width="max-w-sm"
          footer={
            <>
              {open.status === 'paid' && (!hasPin || unlocked) && (
                <Button variant="ghost" className="mr-auto text-danger" onClick={() => setConfirmVoid(true)}>
                  {t('Void sale')}
                </Button>
              )}
              <Button variant="primary" onClick={() => window.print()}>
                <Printer size={18} weight="bold" />
                {t('Print')}
              </Button>
            </>
          }
        >
          <div className="flex justify-center overflow-x-auto">
            <div className="overflow-hidden rounded-lg border border-line">
              <Receipt sale={open} settings={settings} />
            </div>
          </div>
        </Modal>
      )}

      {open && confirmVoid && (
        <ConfirmDialog
          title={t('Void this sale')}
          message={t('The items go back into stock and the sale is removed from your totals. This cannot be undone.')}
          confirmLabel={t('Void sale')}
          danger
          onCancel={() => setConfirmVoid(false)}
          onConfirm={async () => {
            await voidSale(open.id)
            setConfirmVoid(false)
            setOpen(null)
            toast(t('Sale voided'))
          }}
        />
      )}
    </div>
  )
}
