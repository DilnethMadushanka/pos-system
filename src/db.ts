import Dexie, { type EntityTable } from 'dexie'

export interface Product {
  id: number
  name: string
  sku: string
  category: string
  price: number
  cost: number
  stock: number
  lowStock: number
  trackStock: boolean
}

export interface SaleLine {
  productId: number
  name: string
  price: number
  cost: number
  qty: number
}

export type PaymentMethod = 'cash' | 'card' | 'transfer'

export interface Sale {
  id: number
  receiptNo: string
  createdAt: number
  lines: SaleLine[]
  subtotal: number
  discount: number
  tax: number
  total: number
  method: PaymentMethod
  tendered: number
  change: number
  status: 'paid' | 'void'
  voidedAt?: number
}

export interface HeldSale {
  id: number
  createdAt: number
  lines: SaleLine[]
  discount: number
  discountMode: 'amount' | 'percent'
}

export interface Settings {
  shopName: string
  address: string
  phone: string
  currency: string
  taxRate: number
  taxInclusive: boolean
  receiptFooter: string
  theme: 'system' | 'light' | 'dark'
  language: 'en' | 'si'
  pinHash: string
  pinSalt: string
  nextReceipt: number
}

export const defaultSettings: Settings = {
  shopName: 'My Shop',
  address: '',
  phone: '',
  currency: 'Rs.',
  taxRate: 0,
  taxInclusive: false,
  receiptFooter: 'Thank you. Please come again.',
  theme: 'system',
  language: 'en',
  pinHash: '',
  pinSalt: '',
  nextReceipt: 1,
}

interface SettingRow {
  key: string
  value: unknown
}

class PosDB extends Dexie {
  products!: EntityTable<Product, 'id'>
  sales!: EntityTable<Sale, 'id'>
  held!: EntityTable<HeldSale, 'id'>
  settings!: EntityTable<SettingRow, 'key'>

  constructor() {
    super('kade-pos')
    this.version(1).stores({
      products: '++id, name, sku, category',
      sales: '++id, receiptNo, createdAt, status',
      held: '++id, createdAt',
      settings: 'key',
    })
  }
}

export const db = new PosDB()

export async function loadSettings(): Promise<Settings> {
  const rows = await db.settings.toArray()
  const out: Record<string, unknown> = { ...defaultSettings }
  for (const r of rows) out[r.key] = r.value
  return out as unknown as Settings
}

export async function saveSettings(patch: Partial<Settings>) {
  await db.settings.bulkPut(Object.entries(patch).map(([key, value]) => ({ key, value })))
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface Totals {
  subtotal: number
  discount: number
  tax: number
  total: number
}

export function calcTotals(
  lines: SaleLine[],
  discountInput: number,
  discountMode: 'amount' | 'percent',
  taxRate: number,
  taxInclusive: boolean,
): Totals {
  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0))
  const rawDiscount = discountMode === 'percent' ? (subtotal * discountInput) / 100 : discountInput
  const discount = round2(Math.min(Math.max(rawDiscount, 0), subtotal))
  const net = subtotal - discount
  const rate = taxRate / 100
  if (taxInclusive) {
    const tax = round2(net - net / (1 + rate))
    return { subtotal, discount, tax, total: round2(net) }
  }
  const tax = round2(net * rate)
  return { subtotal, discount, tax, total: round2(net + tax) }
}

export interface NewSale {
  lines: SaleLine[]
  totals: Totals
  method: PaymentMethod
  tendered: number
}

export async function createSale(input: NewSale): Promise<Sale> {
  return db.transaction('rw', db.products, db.sales, db.settings, async () => {
    for (const line of input.lines) {
      const p = await db.products.get(line.productId)
      if (!p) throw new Error(`"${line.name}" no longer exists`)
      if (p.trackStock && p.stock < line.qty) {
        throw new Error(`Only ${p.stock} of "${p.name}" in stock`)
      }
    }
    for (const line of input.lines) {
      const p = await db.products.get(line.productId)
      if (p?.trackStock) await db.products.update(p.id, { stock: p.stock - line.qty })
    }
    const settings = await loadSettings()
    const d = new Date()
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    const receiptNo = `${stamp}-${String(settings.nextReceipt).padStart(4, '0')}`
    await saveSettings({ nextReceipt: settings.nextReceipt + 1 })
    const sale: Omit<Sale, 'id'> = {
      receiptNo,
      createdAt: Date.now(),
      lines: input.lines,
      ...input.totals,
      method: input.method,
      tendered: input.method === 'cash' ? input.tendered : input.totals.total,
      change: input.method === 'cash' ? round2(Math.max(input.tendered - input.totals.total, 0)) : 0,
      status: 'paid',
    }
    const id = await db.sales.add(sale as Sale)
    return { ...sale, id }
  })
}

export async function voidSale(id: number) {
  await db.transaction('rw', db.products, db.sales, async () => {
    const sale = await db.sales.get(id)
    if (!sale || sale.status === 'void') return
    for (const line of sale.lines) {
      const p = await db.products.get(line.productId)
      if (p?.trackStock) await db.products.update(p.id, { stock: p.stock + line.qty })
    }
    await db.sales.update(id, { status: 'void', voidedAt: Date.now() })
  })
}

export async function exportBackup(): Promise<string> {
  const [products, sales, held, settings] = await Promise.all([
    db.products.toArray(),
    db.sales.toArray(),
    db.held.toArray(),
    db.settings.toArray(),
  ])
  return JSON.stringify({ app: 'kade-pos', version: 1, exportedAt: Date.now(), products, sales, held, settings })
}

export async function importBackup(text: string) {
  const data = JSON.parse(text)
  if (data?.app !== 'kade-pos') throw new Error('This file is not a Kade POS backup')
  await db.transaction('rw', db.products, db.sales, db.held, db.settings, async () => {
    await Promise.all([db.products.clear(), db.sales.clear(), db.held.clear(), db.settings.clear()])
    await db.products.bulkAdd(data.products ?? [])
    await db.sales.bulkAdd(data.sales ?? [])
    await db.held.bulkAdd(data.held ?? [])
    await db.settings.bulkAdd(data.settings ?? [])
  })
}

export async function clearAllData() {
  await db.transaction('rw', db.products, db.sales, db.held, db.settings, async () => {
    await Promise.all([db.products.clear(), db.sales.clear(), db.held.clear(), db.settings.clear()])
  })
}

const sample: Omit<Product, 'id'>[] = [
  ['Nadu Rice 1kg', '4790001000011', 'Grocery', 245, 218, 60, 15],
  ['Samba Rice 1kg', '4790001000028', 'Grocery', 265, 236, 45, 15],
  ['Red Dhal 500g', '4790001000035', 'Grocery', 310, 276, 30, 10],
  ['Sugar 1kg', '4790001000042', 'Grocery', 275, 250, 40, 12],
  ['Salt 400g', '4790001000059', 'Grocery', 95, 78, 36, 10],
  ['Coconut Oil 750ml', '4790001000066', 'Grocery', 890, 805, 18, 6],
  ['Tea Leaves 200g', '4790001000073', 'Grocery', 540, 468, 24, 8],
  ['Milk Powder 400g', '4790001000080', 'Dairy', 1090, 1005, 20, 8],
  ['Fresh Milk 1L', '4790001000097', 'Dairy', 420, 372, 14, 6],
  ['Curd Pot 400ml', '4790001000103', 'Dairy', 260, 218, 12, 5],
  ['Cream Crackers 190g', '4790001000110', 'Snacks', 190, 160, 48, 12],
  ['Chocolate Biscuit 100g', '4790001000127', 'Snacks', 150, 122, 5, 10],
  ['Banana Chips 100g', '4790001000134', 'Snacks', 180, 140, 22, 8],
  ['Ginger Beer 1L', '4790001000141', 'Drinks', 340, 290, 30, 10],
  ['Orange Cordial 750ml', '4790001000158', 'Drinks', 695, 610, 16, 6],
  ['Drinking Water 1L', '4790001000165', 'Drinks', 110, 85, 72, 24],
  ['Laundry Soap Bar', '4790001000172', 'Household', 85, 66, 50, 15],
  ['Dish Wash Liquid 500ml', '4790001000189', 'Household', 420, 355, 4, 6],
  ['Toothpaste 120g', '4790001000196', 'Household', 390, 330, 26, 8],
  ['Bath Soap', '4790001000202', 'Household', 135, 105, 40, 12],
].map(([name, sku, category, price, cost, stock, lowStock]) => ({
  name: name as string,
  sku: sku as string,
  category: category as string,
  price: price as number,
  cost: cost as number,
  stock: stock as number,
  lowStock: lowStock as number,
  trackStock: true,
}))

export async function loadSampleProducts() {
  await db.products.bulkAdd(sample as Product[])
}
