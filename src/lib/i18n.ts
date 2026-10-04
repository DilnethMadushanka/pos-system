import { useCallback } from 'react'
import { si } from './si'
import { useSettings } from './useSettings'

export type Vars = Record<string, string | number>
export type T = (key: string, vars?: Vars) => string

/** English text is the key. Sinhala is looked up from the dictionary, English is the fallback. */
export function useT(): T {
  const { language } = useSettings()
  return useCallback(
    (key, vars) => {
      let out = language === 'si' ? (si[key] ?? key) : key
      if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
      return out
    },
    [language],
  )
}
