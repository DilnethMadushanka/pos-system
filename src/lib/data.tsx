import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { firestore } from '../firebase'
import { defaultSettings, type HeldSale, type Product, type Sale, type Settings } from '../model'
import { createActions, ERROR_EVENT, type Actions } from './actions'

export const LANG_KEY = 'kade-lang'

export function storedLanguage(): Settings['language'] {
  try {
    return localStorage.getItem(LANG_KEY) === 'si' ? 'si' : 'en'
  } catch {
    return 'en'
  }
}

interface DataValue {
  shopId: string
  products: Product[]
  held: HeldSale[]
  settings: Settings
  actions: Actions
}

const Ctx = createContext<DataValue | null>(null)

function onError(e: Error) {
  console.error(e)
  window.dispatchEvent(new CustomEvent(ERROR_EVENT, { detail: e.message }))
}

export function DataProvider({ shopId, children }: { shopId: string; children: ReactNode }) {
  const [products, setProducts] = useState<Product[] | undefined>()
  const [held, setHeld] = useState<HeldSale[] | undefined>()
  const [settingsDoc, setSettingsDoc] = useState<Partial<Settings> | undefined>()

  useEffect(() => {
    const base = ['shops', shopId] as const
    const offProducts = onSnapshot(
      collection(firestore, ...base, 'products'),
      (snap) =>
        setProducts(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Product)
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      onError,
    )
    const offHeld = onSnapshot(
      query(collection(firestore, ...base, 'held'), orderBy('createdAt', 'desc')),
      (snap) => setHeld(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HeldSale)),
      onError,
    )
    const offSettings = onSnapshot(
      doc(firestore, ...base, 'meta', 'settings'),
      (snap) => setSettingsDoc((snap.data() as Partial<Settings> | undefined) ?? {}),
      onError,
    )
    return () => {
      offProducts()
      offHeld()
      offSettings()
    }
  }, [shopId])

  const settings = useMemo<Settings>(
    () => ({ ...defaultSettings, language: storedLanguage(), ...settingsDoc }),
    [settingsDoc],
  )
  const actions = useMemo(() => createActions(shopId), [shopId])

  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  useEffect(() => {
    document.documentElement.lang = settings.language
    try {
      localStorage.setItem(LANG_KEY, settings.language)
    } catch {
      /* the language still applies for this session */
    }
  }, [settings.language])

  const value = useMemo(
    () => (products && held && settingsDoc ? { shopId, products, held, settings, actions } : null),
    [shopId, products, held, settingsDoc, settings, actions],
  )

  // Wait for the first snapshots so a PIN-locked page never flashes unlocked.
  if (!value) return null
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function useDataValue() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData must be used inside DataProvider')
  return v
}

export const useProducts = () => useDataValue().products
export const useHeld = () => useDataValue().held
export const useActions = () => useDataValue().actions
export const useSettingsValue = () => useDataValue().settings

/** Live sales from a start time (or all sales when `from` is null), newest first. */
export function useSales(from: number | null): Sale[] | undefined {
  const { shopId } = useDataValue()
  const key = `${shopId}:${from}`
  const [state, setState] = useState<{ key: string; data: Sale[] }>()

  useEffect(() => {
    const constraints: QueryConstraint[] = []
    if (from !== null) constraints.push(where('createdAt', '>=', from))
    constraints.push(orderBy('createdAt', 'desc'))
    return onSnapshot(
      query(collection(firestore, 'shops', shopId, 'sales'), ...constraints),
      (snap) => setState({ key, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Sale) }),
      onError,
    )
  }, [shopId, from, key])

  return state?.key === key ? state.data : undefined
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine)
}
