import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { OwnerGate } from './components/PinScreen'
import { ToastProvider } from './components/ui'
import { AccountGate, useAccount } from './lib/account'
import { AuthProvider } from './lib/auth'
import { DataProvider } from './lib/data'
import Products from './pages/Products'
import Reports from './pages/Reports'
import Sales from './pages/Sales'
import Sell from './pages/Sell'
import SettingsPage from './pages/Settings'

const owner = (page: React.ReactNode) => <OwnerGate>{page}</OwnerGate>

function Shop() {
  const { user } = useAccount()
  return (
    // The shop id is the owner's account id, so every device signed in to it shares one shop.
    <DataProvider shopId={user.uid}>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Sell />} />
              <Route path="products" element={owner(<Products />)} />
              <Route path="sales" element={<Sales />} />
              <Route path="reports" element={owner(<Reports />)} />
              <Route path="settings" element={owner(<SettingsPage />)} />
            </Route>
          </Routes>
        </HashRouter>
      </AuthProvider>
    </DataProvider>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AccountGate>
        <Shop />
      </AccountGate>
    </ToastProvider>
  )
}
