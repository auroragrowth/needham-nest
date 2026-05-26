import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { saveSettings } from './actions'

export default async function OwnerOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <main className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Company settings
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        VAT tracking is off in v1 — flip{' '}
        <code className="rounded bg-brand-sage/20 px-1 py-0.5 text-xs text-brand-forest">
          settings.vat_enabled
        </code>{' '}
        in the database when you cross the £90k threshold.
      </p>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <form
        action={saveSettings}
        className="mt-6 space-y-8 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <Section title="Company">
          <Field
            label="Company name"
            name="company_name"
            defaultValue={settings?.company_name ?? ''}
            required
          />
          <Field
            label="Companies House number"
            name="company_number"
            defaultValue={settings?.company_number ?? ''}
            placeholder="e.g. 12345678"
          />
          <Field
            label="Registered address"
            name="company_address"
            defaultValue={settings?.company_address ?? ''}
            textarea
          />
        </Section>

        <Section title="Banking">
          <Field
            label="Bank name"
            name="bank_name"
            defaultValue={settings?.bank_name ?? ''}
            placeholder="Monzo Business"
          />
          <Field
            label="Account number / reference"
            name="bank_account"
            defaultValue={settings?.bank_account ?? ''}
          />
        </Section>

        <Section title="Tax &amp; invoicing">
          <Field
            label="Corporation tax rate (%)"
            name="ct_rate"
            type="number"
            step="0.01"
            defaultValue={String(settings?.ct_rate ?? 19)}
          />
          <Field
            label="Invoice prefix"
            name="invoice_prefix"
            defaultValue={settings?.invoice_prefix ?? 'INV-'}
          />
          <Field
            label="Next invoice number"
            name="invoice_next_number"
            type="number"
            min="1"
            defaultValue={String(settings?.invoice_next_number ?? 1)}
          />
        </Section>

        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-5 py-2.5 text-sm font-medium text-brand-cream transition-colors hover:bg-brand-olive"
        >
          Save settings
        </button>
      </form>
    </main>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = 'text',
  step,
  min,
  required,
  textarea,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  type?: string
  step?: string
  min?: string
  required?: boolean
  textarea?: boolean
}) {
  const inputClass =
    'mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30'
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-brand-forest"
      >
        {label}
        {required && <span className="ml-1 text-brand-amber">*</span>}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          rows={3}
          className={inputClass}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          step={step}
          min={min}
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          className={inputClass}
        />
      )}
    </div>
  )
}
