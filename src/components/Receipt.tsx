import type { Sale, Settings } from '../db'
import { dateTime, money } from '../lib/format'
import { useT } from '../lib/i18n'


export default function Receipt({ sale, settings }: { sale: Sale; settings: Settings }) {
  const t = useT()
  const methodLabel = { cash: t('Cash'), card: t('Card'), transfer: t('Bank transfer') }
  const m = (n: number) => money(n, settings.currency)
  const rule = <div className="my-2 border-t border-dashed border-neutral-400" />

  return (
    <div className="receipt p-4">
      <div className="text-center">
        <div className="text-sm font-bold">{settings.shopName}</div>
        {settings.address && <div>{settings.address}</div>}
        {settings.phone && <div>{settings.phone}</div>}
      </div>
      {rule}
      <div className="flex justify-between">
        <span>{t('No.')} {sale.receiptNo}</span>
        <span>{dateTime(sale.createdAt)}</span>
      </div>
      {sale.status === 'void' && <div className="mt-1 text-center font-bold">{t('VOIDED')}</div>}
      {rule}
      {sale.lines.map((l, i) => (
        <div key={i} className="mb-1">
          <div>{l.name}</div>
          <div className="flex justify-between">
            <span>
              {l.qty} x {l.price.toFixed(2)}
            </span>
            <span>{(l.qty * l.price).toFixed(2)}</span>
          </div>
        </div>
      ))}
      {rule}
      <Row label={t('Subtotal')} value={m(sale.subtotal)} />
      {sale.discount > 0 && <Row label={t('Discount')} value={`-${m(sale.discount)}`} />}
      {sale.tax > 0 && <Row label={settings.taxInclusive ? t('Tax (included)') : t('Tax')} value={m(sale.tax)} />}
      <div className="mt-1 flex justify-between text-sm font-bold">
        <span>{t('TOTAL')}</span>
        <span>{m(sale.total)}</span>
      </div>
      {rule}
      <Row label={t('Paid by')} value={methodLabel[sale.method]} />
      {sale.method === 'cash' && (
        <>
          <Row label={t('Cash given')} value={m(sale.tendered)} />
          <Row label={t('Change')} value={m(sale.change)} />
        </>
      )}
      {settings.receiptFooter && (
        <>
          {rule}
          <div className="text-center">{settings.receiptFooter}</div>
        </>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
