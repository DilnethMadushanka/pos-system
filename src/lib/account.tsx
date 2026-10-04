import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { waitForPendingWrites } from 'firebase/firestore'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Field, Input } from '../components/ui'
import { auth, firebaseConfigured, firestore } from '../firebase'
import { LANG_KEY, storedLanguage } from './data'
import { translate, type Language } from './i18n'

interface AccountValue {
  user: User
  /** Resolves once every offline change has reached the cloud, then signs out. */
  signOut: () => Promise<void>
}

const Ctx = createContext<AccountValue | null>(null)

export function useAccount() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAccount must be used inside AccountGate')
  return v
}

export function AccountGate({ children }: { children: ReactNode }) {
  // undefined = still checking the saved session, null = signed out
  const [user, setUser] = useState<User | null | undefined>(firebaseConfigured ? undefined : null)

  useEffect(() => {
    if (!firebaseConfigured) return
    return onAuthStateChanged(auth, setUser)
  }, [])

  const signOut = useCallback(async () => {
    await waitForPendingWrites(firestore)
    await fbSignOut(auth)
  }, [])

  const value = useMemo(() => (user ? { user, signOut } : null), [user, signOut])

  if (!firebaseConfigured) return <SetupNeeded />
  if (user === undefined) return <div className="h-full" />
  if (!value) return <LoginScreen />
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function SetupNeeded() {
  const steps = [
    'Create a project at console.firebase.google.com.',
    'Authentication: turn on the Email/Password sign-in method.',
    'Firestore Database: create a database, then publish the rules from firestore.rules.',
    'Project settings: add a Web app and copy its config.',
    'Copy .env.example to .env, paste the values, and restart the dev server.',
  ]
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Connect Firebase</h1>
        <p className="text-sm leading-relaxed text-muted">
          Kade POS stores shop data in your own Firebase project. It is not configured yet.
        </p>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function authMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Wrong email or password.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead.'
    case 'auth/weak-password':
      return 'Use a password with at least 6 characters.'
    case 'auth/network-request-failed':
      return 'No internet connection. Connect once to sign in.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a few minutes.'
    default:
      return 'Could not sign in. Please try again.'
  }
}

function LoginScreen() {
  const [lang, setLang] = useState<Language>(storedLanguage)
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const pickLanguage = (l: Language) => {
    setLang(l)
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch {
      /* the choice still applies for this visit */
    }
  }

  const submit = async () => {
    if (busy) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'signin') await signInWithEmailAndPassword(auth, email.trim(), password)
      else await createUserWithEmailAndPassword(auth, email.trim(), password)
    } catch (e) {
      setError(t(authMessage((e as { code?: string }).code ?? '')))
      setBusy(false)
    }
  }

  const reset = async () => {
    setError('')
    setNotice('')
    if (!email.trim()) return setError(t('Enter your email first.'))
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setNotice(t('If that email has an account, a reset link is on its way.'))
    } catch (e) {
      setError(t(authMessage((e as { code?: string }).code ?? '')))
    }
  }

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      <div className="anim-rise flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kade POS</h1>
            <p className="mt-1 text-sm text-muted">
              {mode === 'signin' ? t('Sign in to your shop') : t('Create your shop account')}
            </p>
          </div>
          <div className="flex overflow-hidden rounded-lg border border-line">
            {(['en', 'si'] as const).map((l) => (
              <button
                key={l}
                onClick={() => pickLanguage(l)}
                aria-pressed={lang === l}
                className={`min-h-9 px-3 text-sm font-medium ${
                  lang === l ? 'bg-ink text-surface' : 'bg-panel text-muted hover:text-ink'
                }`}
              >
                {l === 'en' ? 'EN' : 'සිං'}
              </button>
            ))}
          </div>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Field label={t('Email')}>
            <Input
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={t('Password')} error={error}>
            <Input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {notice && <p className="text-sm text-accent-soft-ink">{notice}</p>}
          <Button type="submit" variant="primary" className="min-h-11" disabled={busy || !email || !password}>
            {mode === 'signin' ? t('Sign in') : t('Create account')}
          </Button>
        </form>

        <div className="flex flex-col items-start gap-1 text-sm">
          <button
            className="min-h-9 font-medium text-accent-soft-ink hover:underline"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError('')
              setNotice('')
            }}
          >
            {mode === 'signin' ? t('New shop? Create an account') : t('Already have an account? Sign in')}
          </button>
          {mode === 'signin' && (
            <button className="min-h-9 text-muted hover:text-ink hover:underline" onClick={reset}>
              {t('Forgot password?')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
