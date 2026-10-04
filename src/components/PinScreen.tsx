import { Backspace, LockSimple } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'

export const PIN_LENGTH = 4

export function PinDots({ length, error }: { length: number; error?: boolean }) {
  return (
    <div className="flex justify-center gap-3" aria-hidden>
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <span
          key={i}
          className={`size-4 rounded-lg border-2 transition-colors ${
            error ? 'border-danger bg-danger' : i < length ? 'border-accent bg-accent' : 'border-line'
          }`}
        />
      ))}
    </div>
  )
}

/** Numeric keypad that also listens to the physical keyboard. */
export function PinPad({ onComplete, disabled }: { onComplete: (pin: string) => void; disabled?: boolean }) {
  const t = useT()
  const [value, setValue] = useState('')
  const done = useRef(onComplete)
  done.current = onComplete

  const push = useCallback(
    (d: string) => {
      if (disabled) return
      setValue((v) => (v.length < PIN_LENGTH ? v + d : v))
    },
    [disabled],
  )

  useEffect(() => {
    if (value.length === PIN_LENGTH) {
      done.current(value)
      setValue('')
    }
  }, [value])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) push(e.key)
      else if (e.key === 'Backspace') setValue((v) => v.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [push])

  const key =
    'num grid min-h-14 place-items-center rounded-lg border border-line bg-panel text-xl font-medium transition-[transform,background-color] duration-100 hover:bg-raised active:scale-[0.97] disabled:opacity-40'

  return (
    <div className="flex flex-col items-center gap-6">
      <PinDots length={value.length} />
      <div className="grid w-64 grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className={key} disabled={disabled} onClick={() => push(d)}>
            {d}
          </button>
        ))}
        <span />
        <button className={key} disabled={disabled} onClick={() => push('0')}>
          0
        </button>
        <button
          className={key}
          aria-label={t('Delete digit')}
          disabled={disabled}
          onClick={() => setValue((v) => v.slice(0, -1))}
        >
          <Backspace size={22} />
        </button>
      </div>
    </div>
  )
}

/** Shown in place of an owner-only page while the app is in cashier mode. */
export function OwnerGate({ children }: { children: ReactNode }) {
  const { unlocked, unlock } = useAuth()
  const t = useT()
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  if (unlocked) return <>{children}</>

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="anim-rise flex w-full max-w-xs flex-col items-center gap-6 text-center">
        <div className="grid size-12 place-items-center rounded-lg bg-raised text-muted">
          <LockSimple size={24} weight="bold" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{t('Owner PIN')}</h1>
          <p className="text-sm text-muted">{t('Enter the PIN to open this page.')}</p>
        </div>
        <PinPad
          disabled={cooldown > 0}
          onComplete={async (pin) => {
            const r = await unlock(pin)
            if (r === 'ok') return
            if (r === 'wrong') setError(t('Wrong PIN'))
            else {
              setCooldown(r.cooldown)
              setError('')
            }
          }}
        />
        <p role="alert" className="min-h-5 text-sm text-danger">
          {cooldown > 0 ? t('Too many tries. Wait {n} seconds.', { n: cooldown }) : error}
        </p>
      </div>
    </div>
  )
}
