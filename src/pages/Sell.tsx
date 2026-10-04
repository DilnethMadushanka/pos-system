import {
  Bank,
  CreditCard,
  Cube,
  MagnifyingGlass,
  Minus,
  Money,
  Pause,
  Play,
  Plus,
  Printer,
  ShoppingCartSimple,
  Trash,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Receipt from '../components/Receipt'
import { Badge, Button, EmptyState, Field, Input, Modal, useToast } from '../components/ui'
import { AppError } from '../lib/actions'
import { useActions, useHeld, useProducts } from '../lib/data'
import {
  calcTotals,
  sampleProducts,
  type HeldSale,
  type PaymentMethod,
  type Product,
  type Sale,
  type SaleLine,
} from '../model'
import { money, timeOnly } from '../lib/format'
import { useT } from '../lib/i18n'
import { useSettings } from '../lib/useSettings'

type DiscountMode = 'amount' | 'percent'

export default function Sell() {
  const settings = useSettings()
  const toast = useToast()
  const t = useT()
  const products = useProducts()
  const heldSales = useHeld()
  const actions = useActions()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [lines, setLines] = useState<SaleLine[]>([])
  const [discountInput, setDiscountInput] = useState('')
  const [discountMode, setDiscountMode] = useState<DiscountMode>('amount')
  const [payOpen, setPayOpen] = useState(false)
  const [heldOpen, setHeldOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const m = (n: number) => money(n, settings.currency)
  const totals = useMemo(
    () => calcTotals(lines, parseFloat(discountInput) || 0, discountMode, settings.taxRate, settings.taxInclusive),
    [lines, discountInput, discountMode, settings.taxRate, settings.taxInclusive],
  )
  const itemCount = lines.reduce((s, l) => s + l.qty, 0)

  const categories = useMemo(() => {
    const set = new Set((products ?? []).map((p) => p.category).filter(Boolean))
    return ['All', ...[...set].sort()]
  }, [products])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (products ?? []).filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    )
  }, [products, query, category])

  const stockOf = useCallback(
    (productId: string) => products?.find((p) => p.id === productId),
    [products],
  )

  const addProduct = useCallback(
    (p: Product) => {
      const inCart = lines.find((l) => l.productId === p.id)?.qty ?? 0
      if (p.trackStock && inCart + 1 > p.stock) {
        toast(p.stock === 0 ? t('{name} is out of stock', { name: p.name }) : t('Only {n} of {name} in stock', { n: p.stock, name: p.name }), 'error')
        return
      }
      setLines((prev) => {
        const existing = prev.find((l) => l.productId === p.id)
        if (existing) return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
        return [...prev, { productId: p.id, name: p.name, price: p.price, cost: p.cost, qty: 1 }]
      })
    },
    [lines, toast, t],
  )

  const setQty = (productId: string, qty: number) => {
    const p = stockOf(productId)
    let next = Math.max(1, Math.floor(qty) || 1)
    if (p?.trackStock && next > p.stock) {
      next = p.stock
      toast(t('Only {n} of {name} in stock', { n: p.stock, name: p.name }), 'error')
    }
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, qty: next } : l)))
  }

  const removeLine = (productId: string) => setLines((prev) => prev.filter((l) => l.productId !== productId))

  const clearCart = () => {
    setLines([])
    setDiscountInput('')
    setDiscountMode('amount')
  }

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const q = query.trim().toLowerCase()
    if (!q) return
    const exact = (products ?? []).find((p) => p.sku.toLowerCase() === q)
    const target = exact ?? (visible.length === 1 ? visible[0] : undefined)
    if (target) {
      addProduct(target)
      setQuery('')
    } else {
      toast(visible.length === 0 ? t('No product found') : t('Several products match, tap one'), 'error')
    }
  }

  const holdSale = () => {
    if (!lines.length) return
    actions.holdSale(lines, parseFloat(discountInput) || 0, discountMode)
    clearCart()
    setCartOpen(false)
    toast(t('Sale put on hold'))
  }

  const resumeHeld = (h: HeldSale) => {
    setLines(h.lines)
    setDiscountInput(h.discount ? String(h.discount) : '')
    setDiscountMode(h.discountMode)
    actions.deleteHeld(h.id)
    setHeldOpen(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'F4' && lines.length && !payOpen && !receipt) {
        e.preventDefault()
        setPayOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lines.length, payOpen, receipt])

  const cart = (
    <CartPanel
      lines={lines}
      totals={totals}
      money={m}
      discountInput={discountInput}
      discountMode={discountMode}
      onDiscountInput={setDiscountInput}
      onDiscountMode={setDiscountMode}
      onQty={setQty}
      onRemove={removeLine}
      onClear={clearCart}
      onHold={holdSale}
      onPay={() => setPayOpen(true)}
      taxRate={settings.taxRate}
      taxInclusive={settings.taxInclusive}
      currency={settings.currency}
    />
  )

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-3 border-b border-line bg-panel px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
              />
              <Input
                ref={searchRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder={t('Search by name, or scan a barcode')}
                aria-label={t('Search products')}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setHeldOpen(true)} aria-label={t('Held sales')} className="relative">
              <Pause size={18} weight="bold" />
              <span className="hidden sm:inline">{t('Held')}</span>
              {!!heldSales?.length && (
                <span className="num grid min-w-5 place-items-center rounded-lg bg-accent px-1 text-xs text-accent-ink">
                  {heldSales.length}
                </span>
              )}
            </Button>
          </div>
          {categories.length > 2 && (
            <div className="scroll-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`min-h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors ${
                    category === c ? 'bg-ink text-surface' : 'bg-raised text-muted hover:text-ink'
                  }`}
                >
                  {c === 'All' ? t('All') : c}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
          {products.length === 0 ? (
            <EmptyState
              icon={<Cube size={24} />}
              title={t('No products yet')}
              body={t('Add your items to start selling. You can also load sample products to try the system first.')}
              action={
                <>
                  <Link
                    to="/products"
                    className="inline-flex min-h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                  >
                    {t('Add products')}
                  </Link>
                  <Button
                    onClick={() => {
                      actions.addProducts(sampleProducts)
                      toast(t('Sample products added'))
                    }}
                  >
                    {t('Load samples')}
                  </Button>
                </>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<MagnifyingGlass size={24} />}
              title={t('Nothing matches')}
              body={t('Check the spelling, or pick another category.')}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visible.map((p) => {
                const inCart = lines.find((l) => l.productId === p.id)?.qty ?? 0
                const out = p.trackStock && p.stock <= 0
                const low = p.trackStock && p.stock > 0 && p.stock <= p.lowStock
                return (
                  <button
                    key={p.id}
                    disabled={out}
                    onClick={() => addProduct(p)}
                    className={`relative flex min-h-24 flex-col justify-between gap-2 rounded-lg border bg-panel p-3 text-left transition-[transform,border-color] duration-100 active:scale-[0.98] disabled:opacity-45 ${
                      inCart ? 'border-accent' : 'border-line hover:border-faint'
                    }`}
                  >
                    <span className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</span>
                    <span className="flex items-end justify-between gap-2">
                      <span className="num text-sm font-semibold">{m(p.price)}</span>
                      {out ? (
                        <Badge tone="bad">{t('Out')}</Badge>
                      ) : low ? (
                        <Badge tone="warn">{t('{n} left', { n: p.stock })}</Badge>
                      ) : null}
                    </span>
                    {inCart > 0 && (
                      <span className="num absolute -right-1.5 -top-1.5 grid min-w-6 place-items-center rounded-lg bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-ink">
                        {inCart}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          onClick={() => setCartOpen(true)}
          className="flex min-h-14 items-center justify-between gap-3 border-t border-line bg-accent px-4 text-accent-ink lg:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <ShoppingCartSimple size={20} weight="bold" />
            {itemCount === 0 ? t('Cart is empty') : t(itemCount === 1 ? '{n} item' : '{n} items', { n: itemCount })}
          </span>
          <span className="num text-sm font-semibold">{m(totals.total)}</span>
        </button>
      </section>

      <aside className="hidden w-[380px] shrink-0 flex-col border-l border-line bg-panel lg:flex">{cart}</aside>

      {cartOpen && (
        <div className="anim-fade fixed inset-0 z-40 flex flex-col justify-end lg:hidden">
          <div className="absolute inset-0" style={{ background: 'var(--scrim)' }} onClick={() => setCartOpen(false)} />
          <div className="anim-rise relative flex max-h-[88dvh] min-h-[50dvh] flex-col rounded-t-lg border border-line bg-panel">
            {cart}
          </div>
        </div>
      )}

      {payOpen && (
        <PaymentModal
          total={totals.total}
          currency={settings.currency}
          onClose={() => setPayOpen(false)}
          onPay={async (method, tendered) => {
            const sale = actions.createSale({ lines, totals, method, tendered }, products)
            setPayOpen(false)
            setCartOpen(false)
            clearCart()
            setReceipt(sale)
          }}
        />
      )}

      {receipt && (
        <Modal
          title={t('Sale complete')}
          onClose={() => setReceipt(null)}
          width="max-w-sm"
          footer={
            <>
              <Button onClick={() => window.print()}>
                <Printer size={18} weight="bold" />
                {t('Print receipt')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setReceipt(null)
                  searchRef.current?.focus()
                }}
              >
                {t('New sale')}
              </Button>
            </>
          }
        >
          {receipt.method === 'cash' && receipt.change > 0 && (
            <div className="mb-4 rounded-lg bg-accent-soft px-4 py-3 text-accent-soft-ink">
              <div className="text-xs font-medium">{t('Change to give')}</div>
              <div className="num text-2xl font-semibold tracking-tight">{m(receipt.change)}</div>
            </div>
          )}
          <div className="flex justify-center overflow-x-auto">
            <div className="overflow-hidden rounded-lg border border-line">
              <Receipt sale={receipt} settings={settings} />
            </div>
          </div>
        </Modal>
      )}

      {heldOpen && (
        <Modal title={t('Held sales')} onClose={() => setHeldOpen(false)}>
          {!heldSales?.length ? (
            <EmptyState
              icon={<Pause size={24} />}
              title={t('No held sales')}
              body={t('Hold a sale when a customer steps away, then resume it here.')}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {heldSales.map((h) => {
                const ht = calcTotals(h.lines, h.discount, h.discountMode, settings.taxRate, settings.taxInclusive)
                return (
                  <li key={h.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {t('{n} items', { n: h.lines.reduce((s, l) => s + l.qty, 0) })}, {m(ht.total)}
                      </div>
                      <div className="truncate text-xs text-faint">
                        {timeOnly(h.createdAt)}: {h.lines.map((l) => l.name).join(', ')}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="primary"
                        disabled={lines.length > 0}
                        onClick={() => resumeHeld(h)}
                        title={lines.length ? t('Hold or clear the current sale first') : undefined}
                      >
                        <Play size={16} weight="fill" />
                        {t('Resume')}
                      </Button>
                      <Button variant="ghost" aria-label={t('Delete held sale')} onClick={() => actions.deleteHeld(h.id)}>
                        <Trash size={18} />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {lines.length > 0 && !!heldSales?.length && (
            <p className="mt-3 text-xs text-faint">{t('Hold or clear the current sale before resuming another.')}</p>
          )}
        </Modal>
      )}
    </div>
  )
}

interface CartProps {
  lines: SaleLine[]
  totals: ReturnType<typeof calcTotals>
  money: (n: number) => string
  discountInput: string
  discountMode: DiscountMode
  onDiscountInput: (v: string) => void
  onDiscountMode: (m: DiscountMode) => void
  onQty: (productId: string, qty: number) => void
  onRemove: (productId: string) => void
  onClear: () => void
  onHold: () => void
  onPay: () => void
  taxRate: number
  taxInclusive: boolean
  currency: string
}

function CartPanel(p: CartProps) {
  const t = useT()
  const empty = p.lines.length === 0
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold tracking-tight">{t('Current sale')}</h2>
        <Button variant="ghost" className="min-h-9 px-2" disabled={empty} onClick={p.onClear}>
          {t('Clear')}
        </Button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <EmptyState
            icon={<ShoppingCartSimple size={24} />}
            title={t('Cart is empty')}
            body={t('Tap a product or scan a barcode to add it.')}
          />
        ) : (
          <ul className="divide-y divide-line">
            {p.lines.map((l) => (
              <li key={l.productId} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{l.name}</div>
                  <div className="num text-xs text-faint">
                    {t('{price} each', { price: p.money(l.price) })}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    aria-label={t('Decrease quantity')}
                    onClick={() => (l.qty > 1 ? p.onQty(l.productId, l.qty - 1) : p.onRemove(l.productId))}
                    className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-ink active:scale-95"
                  >
                    {l.qty > 1 ? <Minus size={16} weight="bold" /> : <Trash size={16} />}
                  </button>
                  <input
                    aria-label={t('Quantity of {name}', { name: l.name })}
                    inputMode="numeric"
                    value={l.qty}
                    onChange={(e) => p.onQty(l.productId, parseInt(e.target.value, 10))}
                    onFocus={(e) => e.target.select()}
                    className="num h-9 w-11 rounded-lg border border-transparent bg-transparent text-center text-sm font-medium focus:border-accent focus:outline-none"
                  />
                  <button
                    aria-label={t('Increase quantity')}
                    onClick={() => p.onQty(l.productId, l.qty + 1)}
                    className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-ink active:scale-95"
                  >
                    <Plus size={16} weight="bold" />
                  </button>
                </div>
                <div className="num w-24 text-right text-sm font-semibold">{p.money(l.price * l.qty)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-line px-4 py-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label={t('Discount')}>
              <div className="flex gap-2">
                <Input
                  inputMode="decimal"
                  value={p.discountInput}
                  onChange={(e) => p.onDiscountInput(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  disabled={empty}
                />
                <div className="flex shrink-0 overflow-hidden rounded-lg border border-line">
                  {(['amount', 'percent'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => p.onDiscountMode(mode)}
                      className={`min-w-10 px-2 text-sm font-medium ${
                        p.discountMode === mode ? 'bg-ink text-surface' : 'bg-panel text-muted'
                      }`}
                      aria-pressed={p.discountMode === mode}
                    >
                      {mode === 'amount' ? p.currency : '%'}
                    </button>
                  ))}
                </div>
              </div>
            </Field>
          </div>
        </div>

        <dl className="num flex flex-col gap-1 text-sm">
          <div className="flex justify-between text-muted">
            <dt>{t('Subtotal')}</dt>
            <dd>{p.money(p.totals.subtotal)}</dd>
          </div>
          {p.totals.discount > 0 && (
            <div className="flex justify-between text-muted">
              <dt>{t('Discount')}</dt>
              <dd>-{p.money(p.totals.discount)}</dd>
            </div>
          )}
          {p.taxRate > 0 && (
            <div className="flex justify-between text-muted">
              <dt>{t(p.taxInclusive ? 'Tax {rate}% (included)' : 'Tax {rate}%', { rate: p.taxRate })}</dt>
              <dd>{p.money(p.totals.tax)}</dd>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3">
            <dt className="text-base font-semibold">{t('Total')}</dt>
            <dd className="text-2xl font-semibold tracking-tight">{p.money(p.totals.total)}</dd>
          </div>
        </dl>

        <div className="flex gap-2">
          <Button disabled={empty} onClick={p.onHold} aria-label={t('Hold sale')}>
            <Pause size={18} weight="bold" />
            {t('Hold')}
          </Button>
          <Button variant="primary" className="min-h-12 flex-1 text-base" disabled={empty} onClick={p.onPay}>
            {t('Charge {amount}', { amount: p.money(p.totals.total) })}
          </Button>
        </div>
      </div>
    </div>
  )
}

const methods: { id: PaymentMethod; label: string; icon: typeof Money }[] = [
  { id: 'cash', label: 'Cash', icon: Money },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'transfer', label: 'Transfer', icon: Bank },
]

function PaymentModal({
  total,
  currency,
  onClose,
  onPay,
}: {
  total: number
  currency: string
  onClose: () => void
  onPay: (method: PaymentMethod, tendered: number) => Promise<void>
}) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [tendered, setTendered] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const t = useT()
  const m = (n: number) => money(n, currency)

  const given = parseFloat(tendered) || 0
  const change = Math.max(given - total, 0)
  const short = method === 'cash' && given < total
  const quick = useMemo(() => {
    const steps = [100, 500, 1000, 5000]
    const set = new Set<number>([total])
    for (const s of steps) set.add(Math.ceil(total / s) * s)
    return [...set].sort((a, b) => a - b).slice(0, 4)
  }, [total])

  const submit = async () => {
    if (busy) return
    if (short) {
      setError(t('Cash given is less than the total of {total}', { total: m(total) }))
      return
    }
    setBusy(true)
    try {
      await onPay(method, method === 'cash' ? given : total)
    } catch (e) {
      setError(e instanceof AppError ? t(e.key, e.vars) : t('Could not complete the sale'))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('Take payment')}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" className="min-w-40" disabled={busy || short} onClick={submit}>
            {t('Complete sale')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5" onKeyDown={(e) => e.key === 'Enter' && submit()}>
        <div className="rounded-lg bg-raised px-4 py-3">
          <div className="text-xs font-medium text-muted">{t('Amount due')}</div>
          <div className="num text-3xl font-semibold tracking-tight">{m(total)}</div>
        </div>

        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('Payment method')}>
          {methods.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="radio"
              aria-checked={method === id}
              onClick={() => {
                setMethod(id)
                setError('')
              }}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border text-sm font-medium transition-colors ${
                method === id ? 'border-accent bg-accent-soft text-accent-soft-ink' : 'border-line text-muted hover:text-ink'
              }`}
            >
              <Icon size={22} weight="bold" />
              {t(label)}
            </button>
          ))}
        </div>

        {method === 'cash' && (
          <div className="flex flex-col gap-3">
            <Field label={t('Cash given')} error={error}>
              <Input
                autoFocus
                inputMode="decimal"
                value={tendered}
                onChange={(e) => {
                  setTendered(e.target.value.replace(/[^0-9.]/g, ''))
                  setError('')
                }}
                placeholder={total.toFixed(2)}
                className="num text-lg"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => (
                <button
                  key={q}
                  onClick={() => setTendered(String(q))}
                  className="num min-h-10 rounded-lg border border-line px-3 text-sm font-medium text-muted hover:text-ink active:scale-[0.98]"
                >
                  {q === total ? t('Exact') : q.toLocaleString('en-US')}
                </button>
              ))}
            </div>
            <div className="flex items-baseline justify-between rounded-lg border border-line px-4 py-3">
              <span className="text-sm font-medium text-muted">{t('Change')}</span>
              <span className="num text-xl font-semibold">{m(change)}</span>
            </div>
          </div>
        )}

        {method !== 'cash' && error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
