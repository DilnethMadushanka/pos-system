import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useActions } from './data'
import { useSettings } from './useSettings'

const IDLE_MS = 5 * 60 * 1000
const MAX_TRIES = 5
const COOLDOWN_MS = 30_000
const TRIES_KEY = 'kade-pin-tries'

async function hashPin(pin: string, salt: string) {
  const input = `${salt}:${pin}`
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Non-secure context fallback (plain http on a LAN address): weaker, but still not plain text.
  let h = 2166136261
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619)
  return `fnv-${(h >>> 0).toString(16)}`
}

interface TryState {
  fails: number
  until: number
}

function readTries(): TryState {
  try {
    return JSON.parse(localStorage.getItem(TRIES_KEY) ?? '') as TryState
  } catch {
    return { fails: 0, until: 0 }
  }
}

function writeTries(s: TryState) {
  try {
    localStorage.setItem(TRIES_KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable, the in-memory state still applies */
  }
}

export type UnlockResult = 'ok' | 'wrong' | { cooldown: number }

interface AuthValue {
  hasPin: boolean
  /** True when no PIN is set, or the owner has entered it. False means cashier mode. */
  unlocked: boolean
  unlock: (pin: string) => Promise<UnlockResult>
  lock: () => void
  setPin: (pin: string) => Promise<void>
  removePin: () => Promise<void>
}

const Ctx = createContext<AuthValue>({
  hasPin: false,
  unlocked: true,
  unlock: async () => 'ok',
  lock: () => {},
  setPin: async () => {},
  removePin: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const { pinHash, pinSalt } = useSettings()
  const actions = useActions()
  const hasPin = pinHash !== ''
  const [owner, setOwner] = useState(false)
  const idle = useRef<number | undefined>(undefined)

  const lock = useCallback(() => setOwner(false), [])

  const unlock = useCallback(
    async (pin: string): Promise<UnlockResult> => {
      const tries = readTries()
      const now = Date.now()
      if (tries.until > now) return { cooldown: Math.ceil((tries.until - now) / 1000) }
      if ((await hashPin(pin, pinSalt)) === pinHash) {
        writeTries({ fails: 0, until: 0 })
        setOwner(true)
        return 'ok'
      }
      const fails = tries.fails + 1
      if (fails >= MAX_TRIES) {
        writeTries({ fails: 0, until: now + COOLDOWN_MS })
        return { cooldown: COOLDOWN_MS / 1000 }
      }
      writeTries({ fails, until: 0 })
      return 'wrong'
    },
    [pinHash, pinSalt],
  )

  const setPin = useCallback(async (pin: string) => {
    const salt = crypto.randomUUID?.() ?? String(Math.random()).slice(2)
    actions.saveSettings({ pinSalt: salt, pinHash: await hashPin(pin, salt) })
    setOwner(true)
  }, [actions])

  const removePin = useCallback(async () => {
    actions.saveSettings({ pinSalt: '', pinHash: '' })
    setOwner(false)
  }, [actions])

  const unlocked = !hasPin || owner

  useEffect(() => {
    if (!hasPin || !owner) return
    const reset = () => {
      window.clearTimeout(idle.current)
      idle.current = window.setTimeout(lock, IDLE_MS)
    }
    reset()
    const events = ['pointerdown', 'keydown'] as const
    events.forEach((e) => window.addEventListener(e, reset))
    return () => {
      window.clearTimeout(idle.current)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [hasPin, owner, lock])

  const value = useMemo(
    () => ({ hasPin, unlocked, unlock, lock, setPin, removePin }),
    [hasPin, unlocked, unlock, lock, setPin, removePin],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}
