import { ChartBar, Cube, GearSix, LockSimple, LockSimpleOpen, Receipt, Storefront } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { ERROR_EVENT } from '../lib/actions'
import { useAuth } from '../lib/auth'
import { useOnline } from '../lib/data'
import { useT } from '../lib/i18n'
import { useSettings } from '../lib/useSettings'
import { useToast } from './ui'

const nav = [
  { to: '/', label: 'Sell', icon: Storefront, owner: false },
  { to: '/products', label: 'Products', icon: Cube, owner: true },
  { to: '/sales', label: 'Sales', icon: Receipt, owner: false },
  { to: '/reports', label: 'Reports', icon: ChartBar, owner: true },
  { to: '/settings', label: 'Settings', icon: GearSix, owner: true },
]

export default function Layout() {
  const { shopName } = useSettings()
  const { hasPin, unlocked, lock } = useAuth()
  const t = useT()
  const toast = useToast()
  const online = useOnline()

  useEffect(() => {
    const onError = () => toast(t('Could not save to the cloud. Check your connection and try again.'), 'error')
    window.addEventListener(ERROR_EVENT, onError)
    return () => window.removeEventListener(ERROR_EVENT, onError)
  }, [toast, t])

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-panel md:flex">
        <div className="px-5 py-5">
          <div className="truncate text-base font-semibold tracking-tight">{shopName}</div>
          <div className="text-xs text-faint">Kade POS</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {nav.map(({ to, label, icon: Icon, owner }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent-soft text-accent-soft-ink' : 'text-muted hover:bg-raised hover:text-ink'
                }`
              }
            >
              <Icon size={20} weight="bold" />
              <span className="flex-1">{t(label)}</span>
              {owner && hasPin && !unlocked && <LockSimple size={14} weight="bold" className="opacity-60" />}
            </NavLink>
          ))}
        </nav>
        {hasPin && (
          <div className="p-3">
            {unlocked ? (
              <button
                onClick={lock}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-line px-3 text-sm font-medium text-muted hover:text-ink"
              >
                <LockSimple size={20} weight="bold" />
                {t('Lock')}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-faint">
                <LockSimpleOpen size={16} />
                {t('Cashier mode')}
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!online && (
          <div role="status" className="bg-warn-soft px-4 py-2 text-sm text-warn-soft-ink">
            {t('You are offline. Sales are saved on this device and will sync when the connection returns.')}
          </div>
        )}
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      <nav className="grid shrink-0 grid-cols-5 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] md:hidden">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            <Icon size={22} weight="bold" />
            {t(label)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
