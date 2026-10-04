import { useCallback } from 'react'
import { si } from './si'
import { useSettings } from './useSettings'

export type Vars = Record<string, string | number>
export type T = (key: string, vars?: Vars) => string
export type Language = 'en' | 'si'

/** English text is the key. Sinhala is looked up from the dictionary, English is the fallback. */
export function translate(language: Language, key: string, vars?: Vars): string {
  let out = language === 'si' ? (si[key] ?? key) : key
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
  return out
}

export function useT(): T {
  const { language } = useSettings()
  return useCallback((key, vars) => translate(language, key, vars), [language])
}
