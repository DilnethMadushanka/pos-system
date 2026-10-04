import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { OwnerGate } from './components/PinScreen'
import { ToastProvider } from './components/ui'
import { AuthProvider } from './lib/auth'
import { SettingsProvider } from './lib/useSettings'
import Products from './pages/Products'
import Reports from './pages/Reports'
import Sales from './pages/Sales'
import Sell from './pages/Sell'
import SettingsPage from './pages/Settings'

const owner = (page: React.ReactNode) => <OwnerGate>{page}</OwnerGate>

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <ToastProvider>
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
        </ToastProvider>
      </AuthProvider>
    </SettingsProvider>
  )
}
