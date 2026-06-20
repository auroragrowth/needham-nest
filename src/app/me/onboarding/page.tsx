import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { completeOnboarding } from './actions'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select(
      'date_of_birth, phone, email, pronouns, address_line_1, address_line_2, address_city, address_postcode, emergency_contact_name, emergency_contact_phone, medical_conditions, medication, allergies, ni_number, tax_code, bank_sort_code, bank_account_number, onboarding_completed_at',
    )
    .eq('id', session.profileId)
    .maybeSingle()

  // If already onboarded, bounce home — but the gate should have caught
  // this. Belt-and-braces.
  if (profile?.onboarding_completed_at) {
    const home =
      session.role === 'owner'
        ? '/owner'
        : session.role === 'manager'
          ? '/manager'
          : '/staff'
    redirect(home)
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Welcome to The Needham Nest 🌿
      </h1>
      <p className="mt-2 text-sm text-brand-forest/80">
        Hi {session.name}, before you start your first shift we need a few
        details on file for payroll, emergency contact, and food-safety
        compliance. This is a one-off — you won&apos;t see it again.
      </p>

      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <form
        action={completeOnboarding}
        className="mt-6 space-y-6 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        {/* PERSONAL */}
        <Section title="About you">
          <Field
            label="Date of birth"
            name="date_of_birth"
            type="date"
            required
            defaultValue={profile?.date_of_birth ?? ''}
          />
          <Field
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={profile?.phone ?? ''}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            defaultValue={profile?.email ?? ''}
          />
          <Field
            label="Pronouns (optional)"
            name="pronouns"
            placeholder="she / her, they / them"
            defaultValue={profile?.pronouns ?? ''}
          />
        </Section>

        {/* ADDRESS */}
        <Section title="Address">
          <FullField
            label="Line 1"
            name="address_line_1"
            required
            defaultValue={profile?.address_line_1 ?? ''}
          />
          <FullField
            label="Line 2 (optional)"
            name="address_line_2"
            defaultValue={profile?.address_line_2 ?? ''}
          />
          <Field
            label="Town / city"
            name="address_city"
            required
            defaultValue={profile?.address_city ?? ''}
          />
          <Field
            label="Postcode"
            name="address_postcode"
            required
            uppercase
            defaultValue={profile?.address_postcode ?? ''}
          />
        </Section>

        {/* EMERGENCY */}
        <Section
          title="Emergency contact"
          hint="Who do we call if you're unwell at work or there's an incident?"
        >
          <Field
            label="Their name"
            name="emergency_contact_name"
            required
            defaultValue={profile?.emergency_contact_name ?? ''}
          />
          <Field
            label="Their phone"
            name="emergency_contact_phone"
            type="tel"
            required
            defaultValue={profile?.emergency_contact_phone ?? ''}
          />
        </Section>

        {/* HEALTH */}
        <Section
          title="Health & medical"
          hint="Confidential — only the owner sees this. Important for first-aid and food-safety compliance."
        >
          <div className="sm:col-span-2">
            <label
              htmlFor="medical_conditions"
              className="block text-xs font-medium text-brand-forest"
            >
              Medical conditions
            </label>
            <textarea
              id="medical_conditions"
              name="medical_conditions"
              rows={2}
              placeholder="e.g. asthma, epilepsy, diabetes"
              defaultValue={
                profile?.medical_conditions === 'None reported'
                  ? ''
                  : (profile?.medical_conditions ?? '')
              }
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
            />
            <label className="mt-1 flex items-center gap-2 text-xs text-brand-slate">
              <input
                type="checkbox"
                name="no_medical"
                defaultChecked={
                  profile?.medical_conditions === 'None reported'
                }
              />
              I have no medical conditions to declare.
            </label>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="medication"
              className="block text-xs font-medium text-brand-forest"
            >
              Medication
            </label>
            <textarea
              id="medication"
              name="medication"
              rows={2}
              placeholder="e.g. inhaler, EpiPen, daily prescription"
              defaultValue={
                profile?.medication === 'None reported'
                  ? ''
                  : (profile?.medication ?? '')
              }
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
            />
            <label className="mt-1 flex items-center gap-2 text-xs text-brand-slate">
              <input
                type="checkbox"
                name="no_medication"
                defaultChecked={profile?.medication === 'None reported'}
              />
              I take no regular medication.
            </label>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="allergies"
              className="block text-xs font-medium text-brand-forest"
            >
              Allergies (optional)
            </label>
            <textarea
              id="allergies"
              name="allergies"
              rows={2}
              placeholder="Food, drugs, environmental — anything we should know"
              defaultValue={profile?.allergies ?? ''}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
            />
          </div>
        </Section>

        {/* PAYROLL */}
        <Section
          title="Payroll"
          hint="Needed for PAYE and to pay you. Your details are stored encrypted at rest."
        >
          <Field
            label="National Insurance number"
            name="ni_number"
            uppercase
            placeholder="QQ 12 34 56 C"
            defaultValue={profile?.ni_number ?? ''}
          />
          <Field
            label="Tax code (if you have a P45)"
            name="tax_code"
            uppercase
            placeholder="1257L"
            defaultValue={profile?.tax_code ?? ''}
          />
          <Field
            label="Bank sort code"
            name="bank_sort_code"
            placeholder="00-00-00"
            defaultValue={profile?.bank_sort_code ?? ''}
          />
          <Field
            label="Bank account number"
            name="bank_account_number"
            placeholder="12345678"
            defaultValue={profile?.bank_account_number ?? ''}
          />
        </Section>

        <button
          type="submit"
          className="w-full cursor-pointer rounded-lg bg-brand-forest px-4 py-3 text-base font-semibold text-brand-cream hover:bg-brand-olive"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            minHeight: '44px',
          }}
        >
          Finish onboarding & start
        </button>
      </form>
    </main>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        {title}
      </legend>
      {hint && <p className="mt-1 text-xs text-brand-slate">{hint}</p>}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {children}
      </div>
    </fieldset>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
  placeholder,
  uppercase,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  defaultValue?: string
  placeholder?: string
  uppercase?: boolean
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-medium text-brand-forest"
      >
        {label}
        {required && <span className="ml-1 text-brand-amber">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`mt-1 block w-full cursor-pointer rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest ${uppercase ? 'uppercase' : ''}`}
        style={{
          touchAction: 'manipulation',
          WebkitAppearance: 'none',
          minHeight: '44px',
        }}
      />
    </div>
  )
}

function FullField(props: Parameters<typeof Field>[0]) {
  return (
    <div className="sm:col-span-2">
      <Field {...props} />
    </div>
  )
}
