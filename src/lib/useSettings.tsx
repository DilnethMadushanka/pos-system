import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { defaultSettings, loadSettings, type Settings } from '../db'

const Ctx = createContext<Settings>(defaultSettings)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const loaded = useLiveQuery(loadSettings, [])
  const settings = loaded ?? defaultSettings

  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  useEffect(() => {
    document.documentElement.lang = settings.language === 'si' ? 'si' : 'en'
  }, [settings.language])

  // Wait for the stored settings so a PIN-locked page never flashes unlocked.
  if (!loaded) return null

  return <Ctx.Provider value={settings}>{children}</Ctx.Provider>
}

export function useSettings() {
  return useContext(Ctx)
}
