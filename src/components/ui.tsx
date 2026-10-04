import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { CheckCircle, WarningCircle, X } from '@phosphor-icons/react'
import { useT } from '../lib/i18n'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'bg-raised text-ink border border-line hover:border-faint',
  ghost: 'text-muted hover:bg-raised hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-[transform,background-color,border-color] duration-100 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${className}`}
    />
  )
}

const control =
  'min-h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30'

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input {...props} className={`${control} ${className}`} />
}

export function Select({ className = '', ...props }: ComponentProps<'select'>) {
  return <select {...props} className={`${control} ${className}`} />
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-faint">{hint}</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 'max-w-lg',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  const t = useT()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0" style={{ background: 'var(--scrim)' }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`anim-rise relative flex max-h-[92dvh] w-full flex-col rounded-t-lg border border-line bg-panel sm:rounded-lg ${width}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t('Close')}
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const t = useT()
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {t('Cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted">{message}</p>
    </Modal>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-lg bg-raised text-muted">{icon}</div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="max-w-[44ch] text-sm leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
  children: ReactNode
}) {
  const tones = {
    neutral: 'bg-raised text-muted',
    good: 'bg-accent-soft text-accent-soft-ink',
    warn: 'bg-warn-soft text-warn-soft-ink',
    bad: 'bg-danger-soft text-danger-soft-ink',
  }
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="anim-rise pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-ink px-4 py-3 text-sm text-surface"
          >
            {t.tone === 'ok' ? (
              <CheckCircle size={18} weight="fill" className="text-accent" />
            ) : (
              <WarningCircle size={18} weight="fill" className="text-danger" />
            )}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}
