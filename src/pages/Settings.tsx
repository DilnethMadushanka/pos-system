import { DownloadSimple, LockSimple, SignOut, UploadSimple } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { PIN_LENGTH } from '../components/PinScreen'
import { Button, ConfirmDialog, Field, Input, Modal, PageHeader, Select, useToast } from '../components/ui'
import type { Settings } from '../model'
import { AppError } from '../lib/actions'
import { useAccount } from '../lib/account'
import { useActions } from '../lib/data'
import { useAuth } from '../lib/auth'
import { downloadFile } from '../lib/format'
import { useT } from '../lib/i18n'
import { useSettings } from '../lib/useSettings'

export default function SettingsPage() {
  const current = useSettings()
  const toast = useToast()
  const t = useT()
  const { hasPin, lock, removePin } = useAuth()
  const actions = useActions()
  const { user, signOut } = useAccount()
  const [form, setForm] = useState(current)
  const [dirty, setDirty] = useState(false)
  const [taxText, setTaxText] = useState(String(current.taxRate))
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmRemovePin, setConfirmRemovePin] = useState(false)
  const [pinModal, setPinModal] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!dirty) {
      setForm(current)
      setTaxText(String(current.taxRate))
    }
  }, [current, dirty])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setDirty(true)
  }

  const save = async () => {
    // PIN, receipt counter and the other managed fields are written by their own actions.
    const { shopName, address, phone, currency, taxInclusive, receiptFooter, theme, language } = form
    actions.saveSettings({
      shopName,
      address,
      phone,
      currency,
      taxInclusive,
      receiptFooter,
      theme,
      language,
      taxRate: parseFloat(taxText) || 0,
    })
    setDirty(false)
    toast(t('Settings saved'))
  }

  const backup = async () => {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadFile(`kade-pos-backup-${stamp}.json`, await actions.exportBackup(), 'application/json')
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 p-4 md:p-6">
        <PageHeader title={t('Settings')}>
          <Button variant="primary" onClick={save} disabled={!dirty}>
            {t('Save changes')}
          </Button>
        </PageHeader>

        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold tracking-tight">{t('Shop details')}</h2>
          <p className="-mt-2 text-sm text-muted">{t('These appear at the top of every printed receipt.')}</p>
          <Field label={t('Shop name')}>
            <Input value={form.shopName} onChange={(e) => set('shopName', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Address')}>
              <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <Field label={t('Phone')}>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
            </Field>
          </div>
          <Field label={t('Receipt footer')}>
            <Input value={form.receiptFooter} onChange={(e) => set('receiptFooter', e.target.value)} />
          </Field>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold tracking-tight">{t('Money and tax')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Currency symbol')}>
              <Input value={form.currency} onChange={(e) => set('currency', e.target.value)} />
            </Field>
            <Field label={t('Tax rate (%)')} hint={t('Use 0 if you do not charge tax')}>
              <Input
                inputMode="decimal"
                value={taxText}
                onChange={(e) => {
                  setTaxText(e.target.value.replace(/[^0-9.]/g, ''))
                  setDirty(true)
                }}
                className="num"
              />
            </Field>
          </div>
          <label className="flex min-h-10 items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.taxInclusive}
              onChange={(e) => set('taxInclusive', e.target.checked)}
              className="size-5 accent-[var(--accent)]"
            />
            {t('Product prices already include tax')}
          </label>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold tracking-tight">{t('Language and appearance')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Language')}>
              <Select value={form.language} onChange={(e) => set('language', e.target.value as Settings['language'])}>
                <option value="en">English</option>
                <option value="si">සිංහල</option>
              </Select>
            </Field>
            <Field label={t('Theme')}>
              <Select value={form.theme} onChange={(e) => set('theme', e.target.value as Settings['theme'])}>
                <option value="system">{t('Match this device')}</option>
                <option value="light">{t('Light')}</option>
                <option value="dark">{t('Dark')}</option>
              </Select>
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold tracking-tight">{t('PIN lock')}</h2>
          <p className="-mt-2 text-sm leading-relaxed text-muted">
            {t(
              'With a PIN set, cashiers can sell and view sales. Products, Reports and Settings need the owner PIN. The app locks itself after 5 minutes without use.',
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setPinModal(true)}>
              <LockSimple size={18} weight="bold" />
              {hasPin ? t('Change PIN') : t('Set PIN')}
            </Button>
            {hasPin && (
              <>
                <Button onClick={lock}>{t('Lock now')}</Button>
                <Button variant="ghost" className="text-danger" onClick={() => setConfirmRemovePin(true)}>
                  {t('Remove PIN')}
                </Button>
              </>
            )}
          </div>
          {hasPin && <p className="text-xs text-faint">{t('If you forget the PIN, restore a backup made before the PIN was set.')}</p>}
        </section>

        <section className="flex flex-col gap-4 border-t border-line pt-8">
          <h2 className="text-base font-semibold tracking-tight">{t('Account')}</h2>
          <p className="-mt-2 text-sm leading-relaxed text-muted">
            {t('Signed in as {email}. Every device signed in with this account shares the same shop.', {
              email: user.email ?? '',
            })}
          </p>
          <div>
            <Button
              onClick={async () => {
                if (!navigator.onLine) {
                  toast(t('Connect to the internet before signing out, so your latest sales are saved.'), 'error')
                  return
                }
                try {
                  await signOut()
                } catch {
                  toast(t('Could not sign out. Please try again.'), 'error')
                }
              }}
            >
              <SignOut size={18} weight="bold" />
              {t('Sign out')}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-line pt-8">
          <h2 className="text-base font-semibold tracking-tight">{t('Your data')}</h2>
          <p className="-mt-2 text-sm leading-relaxed text-muted">
            {t(
              'Your data is saved to your cloud account and kept on this device for offline use. Download a backup now and then and keep it somewhere safe.',
            )}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) setPendingRestore(await f.text())
              e.target.value = ''
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={backup}>
              <DownloadSimple size={18} weight="bold" />
              {t('Download backup')}
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <UploadSimple size={18} weight="bold" />
              {t('Restore from backup')}
            </Button>
            <Button variant="ghost" className="text-danger" onClick={() => setConfirmClear(true)}>
              {t('Erase all data')}
            </Button>
          </div>
        </section>
      </div>

      {pinModal && <PinSetupModal changing={hasPin} onClose={() => setPinModal(false)} />}

      {confirmRemovePin && (
        <ConfirmDialog
          title={t('Remove PIN')}
          message={t('Anyone using this device will be able to open Products, Reports and Settings.')}
          confirmLabel={t('Remove PIN')}
          danger
          onCancel={() => setConfirmRemovePin(false)}
          onConfirm={async () => {
            await removePin()
            setConfirmRemovePin(false)
            toast(t('PIN removed'))
          }}
        />
      )}

      {pendingRestore && (
        <ConfirmDialog
          title={t('Restore backup')}
          message={t(
            'This replaces all products, sales and settings on this device with the contents of the backup file.',
          )}
          confirmLabel={t('Restore')}
          danger
          onCancel={() => setPendingRestore(null)}
          onConfirm={async () => {
            try {
              await actions.importBackup(pendingRestore)
              setDirty(false)
              toast(t('Backup restored'))
            } catch (e) {
              toast(e instanceof AppError ? t(e.key, e.vars) : t('Could not restore this file'), 'error')
            }
            setPendingRestore(null)
          }}
        />
      )}

      {confirmClear && (
        <ConfirmDialog
          title={t('Erase all data')}
          message={t(
            'This deletes every product, sale and setting on this device. Download a backup first if you might need it.',
          )}
          confirmLabel={t('Erase everything')}
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={async () => {
            try {
              await actions.clearAllData()
              setDirty(false)
              toast(t('All data erased'))
            } catch (e) {
              toast(e instanceof AppError ? t(e.key, e.vars) : t('Could not erase the data'), 'error')
            }
            setConfirmClear(false)
          }}
        />
      )}
    </div>
  )
}

function PinSetupModal({ changing, onClose }: { changing: boolean; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const { setPin } = useAuth()
  const [pin, setPinValue] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')

  const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH)

  const save = async () => {
    if (pin.length !== PIN_LENGTH) return setError(t('The PIN must be {n} digits.', { n: PIN_LENGTH }))
    if (pin !== again) return setError(t('The two PINs do not match.'))
    await setPin(pin)
    toast(t('PIN saved'))
    onClose()
  }

  return (
    <Modal
      title={changing ? t('Change PIN') : t('Set PIN')}
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" onClick={save}>
            {t('Save PIN')}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label={t('New PIN')} hint={t('{n} digits', { n: PIN_LENGTH })}>
          <Input
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => {
              setPinValue(digits(e.target.value))
              setError('')
            }}
            className="num tracking-[0.4em]"
          />
        </Field>
        <Field label={t('Repeat the PIN')} error={error}>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={again}
            onChange={(e) => {
              setAgain(digits(e.target.value))
              setError('')
            }}
            className="num tracking-[0.4em]"
          />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
