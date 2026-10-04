import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  setDoc,
  updateDoc,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { firestore } from '../firebase'
import type { HeldSale, PaymentMethod, Product, Sale, SaleLine, Settings, Totals } from '../model'

/** An error whose message is an English key plus values, so the UI can translate it. */
export class AppError extends Error {
  key: string
  vars: Record<string, string | number>
  constructor(key: string, vars: Record<string, string | number> = {}) {
    super(key)
    this.key = key
    this.vars = vars
  }
}

export const ERROR_EVENT = 'kade-error'

function reportWriteError(e: unknown) {
  console.error(e)
  window.dispatchEvent(new CustomEvent(ERROR_EVENT, { detail: e instanceof Error ? e.message : String(e) }))
}

/** Writes are not awaited: the local cache updates at once and Firestore syncs when it can. */
const fire = (p: Promise<unknown>) => {
  p.catch(reportWriteError)
}

const CHUNK = 450

function requireOnline() {
  if (!navigator.onLine) throw new AppError('You need to be online to do this.')
}

/** Each device numbers its own receipts, so two tills never produce the same number offline. */
function nextReceiptNo(): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  let device = { code: Math.random().toString(36).slice(2, 4).toUpperCase(), seq: 0 }
  try {
    const stored = JSON.parse(localStorage.getItem('kade-device') ?? 'null')
    if (stored?.code) device = stored
  } catch {
    /* use the fresh code */
  }
  device.seq += 1
  try {
    localStorage.setItem('kade-device', JSON.stringify(device))
  } catch {
    /* receipt numbers stay unique per session at worst */
  }
  return `${stamp}-${device.code}${String(device.seq).padStart(4, '0')}`
}

export interface NewSale {
  lines: SaleLine[]
  totals: Totals
  method: PaymentMethod
  tendered: number
}

type Raw = Record<string, unknown>

export function createActions(shopId: string) {
  const col = (name: string) => collection(firestore, 'shops', shopId, name)
  const settingsRef = doc(firestore, 'shops', shopId, 'meta', 'settings')

  async function commitAll(ops: ((b: WriteBatch) => void)[]) {
    for (let i = 0; i < ops.length; i += CHUNK) {
      const b = writeBatch(firestore)
      ops.slice(i, i + CHUNK).forEach((op) => op(b))
      await b.commit()
    }
  }

  async function clearAllData() {
    requireOnline()
    const ops: ((b: WriteBatch) => void)[] = []
    for (const name of ['products', 'sales', 'held']) {
      const snap = await getDocs(col(name))
      snap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)))
    }
    ops.push((b) => b.delete(settingsRef))
    await commitAll(ops)
  }

  return {
    saveSettings(patch: Partial<Settings>) {
      fire(setDoc(settingsRef, patch, { merge: true }))
    },

    saveProduct(data: Omit<Product, 'id'>, id?: string) {
      if (id) fire(updateDoc(doc(col('products'), id), { ...data }))
      else fire(setDoc(doc(col('products')), data))
    },

    deleteProduct(id: string) {
      fire(deleteDoc(doc(col('products'), id)))
    },

    addProducts(items: Omit<Product, 'id'>[]) {
      for (let i = 0; i < items.length; i += CHUNK) {
        const b = writeBatch(firestore)
        items.slice(i, i + CHUNK).forEach((item) => b.set(doc(col('products')), item))
        fire(b.commit())
      }
    },

    updateProducts(updates: { id: string; data: Partial<Omit<Product, 'id'>> }[]) {
      for (let i = 0; i < updates.length; i += CHUNK) {
        const b = writeBatch(firestore)
        updates.slice(i, i + CHUNK).forEach((u) => b.update(doc(col('products'), u.id), { ...u.data }))
        fire(b.commit())
      }
    },

    createSale(input: NewSale, products: Product[]): Sale {
      for (const line of input.lines) {
        const p = products.find((x) => x.id === line.productId)
        if (!p) throw new AppError('{name} no longer exists', { name: line.name })
        if (p.trackStock && p.stock < line.qty) {
          throw new AppError('Only {n} of {name} in stock', { n: p.stock, name: p.name })
        }
      }
      const ref = doc(col('sales'))
      const data: Omit<Sale, 'id'> = {
        receiptNo: nextReceiptNo(),
        createdAt: Date.now(),
        lines: input.lines,
        ...input.totals,
        method: input.method,
        tendered: input.method === 'cash' ? input.tendered : input.totals.total,
        change:
          input.method === 'cash' ? Math.round(Math.max(input.tendered - input.totals.total, 0) * 100) / 100 : 0,
        status: 'paid',
      }
      const b = writeBatch(firestore)
      b.set(ref, data)
      for (const line of input.lines) {
        const p = products.find((x) => x.id === line.productId)
        // increment() merges correctly when two tills sell the same item at the same time.
        if (p?.trackStock) b.update(doc(col('products'), p.id), { stock: increment(-line.qty) })
      }
      fire(b.commit())
      return { id: ref.id, ...data }
    },

    voidSale(sale: Sale, products: Product[]) {
      if (sale.status === 'void') return
      const b = writeBatch(firestore)
      b.update(doc(col('sales'), sale.id), { status: 'void', voidedAt: Date.now() })
      for (const line of sale.lines) {
        const p = products.find((x) => x.id === line.productId)
        if (p?.trackStock) b.update(doc(col('products'), p.id), { stock: increment(line.qty) })
      }
      fire(b.commit())
    },

    holdSale(lines: SaleLine[], discount: number, discountMode: HeldSale['discountMode']) {
      fire(setDoc(doc(col('held')), { createdAt: Date.now(), lines, discount, discountMode }))
    },

    deleteHeld(id: string) {
      fire(deleteDoc(doc(col('held'), id)))
    },

    async exportBackup(): Promise<string> {
      const read = async (name: string) => (await getDocs(col(name))).docs.map((d) => ({ id: d.id, ...d.data() }))
      const [products, sales, held] = await Promise.all([read('products'), read('sales'), read('held')])
      const settings = (await getDocs(collection(firestore, 'shops', shopId, 'meta'))).docs.find(
        (d) => d.id === 'settings',
      )
      return JSON.stringify({
        app: 'kade-pos',
        version: 2,
        exportedAt: Date.now(),
        products,
        sales,
        held,
        settings: settings?.data() ?? {},
      })
    },

    async importBackup(text: string) {
      const data = JSON.parse(text)
      if (data?.app !== 'kade-pos') throw new AppError('This file is not a Kade POS backup')
      requireOnline()
      await clearAllData()

      const strip = ({ id, ...rest }: Raw) => ({ id: String(id), rest })
      const fixLines = (lines: unknown) =>
        ((lines as Raw[]) ?? []).map((l) => ({ ...l, productId: String(l.productId) }))
      const ops: ((b: WriteBatch) => void)[] = []

      for (const p of (data.products ?? []) as Raw[]) {
        const { id, rest } = strip(p)
        ops.push((b) => b.set(doc(col('products'), id), rest))
      }
      for (const s of (data.sales ?? []) as Raw[]) {
        const { id, rest } = strip(s)
        ops.push((b) => b.set(doc(col('sales'), id), { ...rest, lines: fixLines(rest.lines) }))
      }
      for (const h of (data.held ?? []) as Raw[]) {
        const { id, rest } = strip(h)
        ops.push((b) => b.set(doc(col('held'), id), { ...rest, lines: fixLines(rest.lines) }))
      }
      // Version 1 backups stored settings as [{ key, value }] rows.
      const rawSettings: Raw = Array.isArray(data.settings)
        ? Object.fromEntries((data.settings as { key: string; value: unknown }[]).map((r) => [r.key, r.value]))
        : (data.settings ?? {})
      delete rawSettings.nextReceipt
      ops.push((b) => b.set(settingsRef, rawSettings))
      await commitAll(ops)
    },

    clearAllData,
  }
}

export type Actions = ReturnType<typeof createActions>
