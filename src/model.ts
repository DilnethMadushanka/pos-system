export interface Product {
  id: string
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
  productId: string
  name: string
  price: number
  cost: number
  qty: number
}

export type PaymentMethod = 'cash' | 'card' | 'transfer'

export interface Sale {
  id: string
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
  id: string
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

export const sampleProducts: Omit<Product, 'id'>[] = [
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
