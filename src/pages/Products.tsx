import {
  DownloadSimple,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  UploadSimple,
  Cube,
} from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  useToast,
} from '../components/ui'
import { db, loadSampleProducts, type Product } from '../db'
import { csvEscape, downloadFile, money, parseCsv } from '../lib/format'
import { useT } from '../lib/i18n'
import { useSettings } from '../lib/useSettings'

type Draft = {
  id?: number
  name: string
  sku: string
  category: string
  price: string
  cost: string
  stock: string
  lowStock: string
  trackStock: boolean
}

const blank: Draft = {
  name: '',
  sku: '',
  category: '',
  price: '',
  cost: '',
  stock: '0',
  lowStock: '5',
  trackStock: true,
}

const toDraft = (p: Product): Draft => ({
  id: p.id,
  name: p.name,
  sku: p.sku,
  category: p.category,
  price: String(p.price),
  cost: String(p.cost),
  stock: String(p.stock),
  lowStock: String(p.lowStock),
  trackStock: p.trackStock,
})

export default function Products() {
  const settings = useSettings()
  const toast = useToast()
  const t = useT()
  const products = useLiveQuery(() => db.products.orderBy('name').toArray(), [])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [lowOnly, setLowOnly] = useState(false)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const m = (n: number) => money(n, settings.currency)

  const categories = useMemo(
    () => [...new Set((products ?? []).map((p) => p.category).filter(Boolean))].sort(),
    [products],
  )

  const isLow = (p: Product) => p.trackStock && p.stock <= p.lowStock

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (products ?? []).filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        (!lowOnly || isLow(p)) &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    )
  }, [products, query, category, lowOnly])

  const lowCount = (products ?? []).filter(isLow).length

  const exportCsv = () => {
    const rows = [
      ['name', 'sku', 'category', 'price', 'cost', 'stock'],
      ...(products ?? []).map((p) => [p.name, p.sku, p.category, p.price, p.cost, p.stock]),
    ]
    downloadFile('products.csv', rows.map((r) => r.map(csvEscape).join(',')).join('\n'), 'text/csv')
  }

  const importCsv = async (file: File) => {
    try {
      const rows = parseCsv(await file.text())
      if (rows.length && Number.isNaN(parseFloat(rows[0][3]))) rows.shift()
      const existing = await db.products.toArray()
      let added = 0
      let updated = 0
      for (const [name, sku = '', category = '', price = '0', cost = '0', stock = '0'] of rows) {
        if (!name?.trim()) continue
        const data = {
          name: name.trim(),
          sku: sku.trim(),
          category: category.trim(),
          price: parseFloat(price) || 0,
          cost: parseFloat(cost) || 0,
          stock: parseInt(stock, 10) || 0,
        }
        const match = data.sku ? existing.find((p) => p.sku === data.sku) : undefined
        if (match) {
          await db.products.update(match.id, data)
          updated++
        } else {
          await db.products.add({ ...data, lowStock: 5, trackStock: true } as Product)
          added++
        }
      }
      toast(t('Imported {added} new, updated {updated}', { added, updated }))
    } catch {
      toast(t('Could not read that file'), 'error')
    }
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-6">
        <PageHeader title={t('Products')}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importCsv(f)
              e.target.value = ''
            }}
          />
          <Button onClick={() => fileRef.current?.click()}>
            <UploadSimple size={18} weight="bold" />
            {t('Import')}
          </Button>
          <Button onClick={exportCsv} disabled={!products?.length}>
            <DownloadSimple size={18} weight="bold" />
            {t('Export')}
          </Button>
          <Button variant="primary" onClick={() => setEditing(blank)}>
            <Plus size={18} weight="bold" />
            {t('Add product')}
          </Button>
        </PageHeader>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-52 flex-1">
            <MagnifyingGlass
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search name or barcode')}
              aria-label={t('Search products')}
              className="pl-10"
            />
          </div>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label={t('Category')}
            className="w-auto min-w-40"
          >
            <option value="All">{t('All')}</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Button
            onClick={() => setLowOnly((v) => !v)}
            aria-pressed={lowOnly}
            className={lowOnly ? 'border-accent text-accent-soft-ink' : ''}
          >
            {t('Low stock')}{lowCount > 0 ? ` (${lowCount})` : ''}
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-panel">
          {products === undefined ? (
            <div className="flex flex-col gap-px">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse bg-raised" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon={<Cube size={24} />}
              title={t('Your product list is empty')}
              body={t('Add items one by one, import a CSV file (name, sku, category, price, cost, stock), or load sample products.')}
              action={
                <>
                  <Button variant="primary" onClick={() => setEditing(blank)}>
                    {t('Add product')}
                  </Button>
                  <Button
                    onClick={async () => {
                      await loadSampleProducts()
                      toast(t('Sample products added'))
                    }}
                  >
                    {t('Load samples')}
                  </Button>
                </>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState icon={<MagnifyingGlass size={24} />} title={t('Nothing matches')} body={t('Try a different search or filter.')} />
          ) : (
            <>
              <div className="hidden grid-cols-[1fr_130px_110px_110px_110px_88px] gap-4 border-b border-line bg-raised px-4 py-2 text-xs font-medium text-muted md:grid">
                <span>{t('Product')}</span>
                <span>{t('Category')}</span>
                <span className="text-right">{t('Price')}</span>
                <span className="text-right">{t('Cost')}</span>
                <span className="text-right">{t('Stock')}</span>
                <span />
              </div>
              <ul className="divide-y divide-line">
                {visible.map((p) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[1fr_130px_110px_110px_110px_88px]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="num truncate text-xs text-faint">{p.sku || t('No barcode')}</div>
                    </div>
                    <div className="hidden truncate text-sm text-muted md:block">{p.category || '-'}</div>
                    <div className="num text-right text-sm font-medium">{m(p.price)}</div>
                    <div className="num hidden text-right text-sm text-muted md:block">{m(p.cost)}</div>
                    <div className="num flex items-center justify-end gap-2 text-sm">
                      {!p.trackStock ? (
                        <span className="text-faint">{t('Not tracked')}</span>
                      ) : p.stock <= 0 ? (
                        <Badge tone="bad">{t('Out')}</Badge>
                      ) : isLow(p) ? (
                        <Badge tone="warn">{p.stock}</Badge>
                      ) : (
                        <span>{p.stock}</span>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-end gap-1 md:col-span-1">
                      <button
                        aria-label={t('Edit {name}', { name: p.name })}
                        onClick={() => setEditing(toDraft(p))}
                        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
                      >
                        <PencilSimple size={18} />
                      </button>
                      <button
                        aria-label={t('Delete {name}', { name: p.name })}
                        onClick={() => setDeleting(p)}
                        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger-soft-ink"
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {editing && <ProductForm draft={editing} categories={categories} onClose={() => setEditing(null)} />}

      {deleting && (
        <ConfirmDialog
          title={t('Delete product')}
          message={t('Delete "{name}"? Past sales keep their receipts, but the item will no longer be available to sell.', { name: deleting.name })}
          confirmLabel={t('Delete')}
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await db.products.delete(deleting.id)
            setDeleting(null)
            toast(t('Product deleted'))
          }}
        />
      )}
    </div>
  )
}

function ProductForm({
  draft,
  categories,
  onClose,
}: {
  draft: Draft
  categories: string[]
  onClose: () => void
}) {
  const toast = useToast()
  const t = useT()
  const [d, setD] = useState(draft)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }))

  const save = async () => {
    const err: Record<string, string> = {}
    if (!d.name.trim()) err.name = t('Enter a product name')
    const price = parseFloat(d.price)
    if (Number.isNaN(price) || price < 0) err.price = t('Enter a selling price')
    if (d.sku.trim()) {
      const clash = await db.products.where('sku').equals(d.sku.trim()).first()
      if (clash && clash.id !== d.id) err.sku = t('Already used by "{name}"', { name: clash.name })
    }
    setErrors(err)
    if (Object.keys(err).length) return

    const data = {
      name: d.name.trim(),
      sku: d.sku.trim(),
      category: d.category.trim(),
      price,
      cost: parseFloat(d.cost) || 0,
      stock: parseInt(d.stock, 10) || 0,
      lowStock: parseInt(d.lowStock, 10) || 0,
      trackStock: d.trackStock,
    }
    if (d.id) await db.products.update(d.id, data)
    else await db.products.add(data as Product)
    toast(t(d.id ? 'Product updated' : 'Product added'))
    onClose()
  }

  const num = (k: 'price' | 'cost' | 'stock' | 'lowStock', int = false) => ({
    inputMode: (int ? 'numeric' : 'decimal') as 'numeric' | 'decimal',
    value: d[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(k, e.target.value.replace(int ? /[^0-9]/g : /[^0-9.]/g, '')),
  })

  return (
    <Modal
      title={t(d.id ? 'Edit product' : 'Add product')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" onClick={save}>
            {t('Save product')}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="col-span-2">
          <Field label={t('Name')} error={errors.name}>
            <Input autoFocus value={d.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
        </div>
        <Field label={t('Barcode')} hint={t('Scan it here, or leave empty')} error={errors.sku}>
          <Input value={d.sku} onChange={(e) => set('sku', e.target.value)} className="num" />
        </Field>
        <Field label={t('Category')}>
          <Input value={d.category} onChange={(e) => set('category', e.target.value)} list="category-list" />
          <datalist id="category-list">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label={t('Selling price')} error={errors.price}>
          <Input {...num('price')} className="num" />
        </Field>
        <Field label={t('Cost price')} hint={t('Used for profit reports')}>
          <Input {...num('cost')} className="num" />
        </Field>
        <div className="col-span-2">
          <label className="flex min-h-10 items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={d.trackStock}
              onChange={(e) => set('trackStock', e.target.checked)}
              className="size-5 accent-[var(--accent)]"
            />
            {t('Track stock for this product')}
          </label>
        </div>
        {d.trackStock && (
          <>
            <Field label={t('In stock')}>
              <Input {...num('stock', true)} className="num" />
            </Field>
            <Field label={t('Low stock alert at')}>
              <Input {...num('lowStock', true)} className="num" />
            </Field>
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
