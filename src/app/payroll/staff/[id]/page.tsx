import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtMoney(n: number | string | null): string {
  if (n == null) return '—'
  return `£${Number(n).toFixed(2)}`
}

export default async function PayrollStaffDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()
  const { data: p } = await admin
    .from('profiles')
    .select(
      'id, name, role, employment_type, hourly_rate, annual_salary, contracted_weekly_hours, ni_number, tax_code, bank_sort_code, bank_account_number, address_line_1, address_line_2, address_city, address_postcode, date_of_birth, start_date, probation_end_date, notice_period_weeks, email, phone, pronouns, emergency_contact_name, emergency_contact_phone, allergies, medical_conditions, medication, paid_in_cash',
    )
    .eq('id', id)
    .maybeSingle()

  if (!p) notFound()

  return (
    <main className="mx-auto max-w-3xl">
      <Link
        href="/payroll/staff"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Staff list
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {p.name}
      </h1>
      <p className="mt-1 text-xs text-brand-slate uppercase tracking-wide">
        {p.role} ·{' '}
        {p.employment_type === 'paye'
          ? `PAYE · ${fmtMoney(p.annual_salary)}/yr`
          : p.employment_type === 'casual'
            ? `Casual · ${fmtMoney(p.hourly_rate)}/h`
            : (p.employment_type ?? 'not set')}
      </p>

      {p.paid_in_cash && (
        <div className="mt-4 rounded-xl border-2 border-brand-amber bg-brand-amber/20 p-4 text-brand-forest">
          <p className="text-lg font-bold">
            💵 PAID IN CASH — DO NOT BACS
          </p>
          <p className="mt-1 text-sm">
            Take the net pay from petty cash. Mark the slip as <em>Cash</em>{' '}
            when paid; don&apos;t enter the bank details into your BACS file.
          </p>
        </div>
      )}

      <Section title="Payroll">
        <Row label="NI number" value={p.ni_number} mono />
        <Row label="Tax code" value={p.tax_code} mono />
        <Row
          label="Hourly rate"
          value={p.hourly_rate ? fmtMoney(p.hourly_rate) : null}
          mono
        />
        <Row
          label="Annual salary"
          value={p.annual_salary ? fmtMoney(p.annual_salary) : null}
          mono
        />
        <Row
          label="Contracted hrs / week"
          value={
            p.contracted_weekly_hours
              ? Number(p.contracted_weekly_hours).toFixed(1)
              : null
          }
          mono
        />
        <Row label="Bank sort code" value={p.bank_sort_code} mono />
        <Row label="Bank account" value={p.bank_account_number} mono />
      </Section>

      <Section title="Identity">
        <Row label="Date of birth" value={fmtDate(p.date_of_birth)} />
        <Row label="Pronouns" value={p.pronouns} />
        <Row label="Phone" value={p.phone} mono />
        <Row label="Email" value={p.email} mono />
      </Section>

      <Section title="Address">
        <Row
          label="Address"
          value={
            [
              p.address_line_1,
              p.address_line_2,
              p.address_city,
              p.address_postcode,
            ]
              .filter(Boolean)
              .join(', ') || null
          }
        />
      </Section>

      <Section title="Employment">
        <Row label="Start date" value={fmtDate(p.start_date)} />
        <Row
          label="Probation ends"
          value={fmtDate(p.probation_end_date)}
        />
        <Row
          label="Notice period"
          value={
            p.notice_period_weeks
              ? `${p.notice_period_weeks} weeks`
              : null
          }
        />
      </Section>

      <Section title="Emergency contact">
        <Row label="Name" value={p.emergency_contact_name} />
        <Row label="Phone" value={p.emergency_contact_phone} mono />
      </Section>

      <Section title="Health">
        <Row label="Allergies" value={p.allergies} />
        <Row label="Medical conditions" value={p.medical_conditions} />
        <Row label="Medication" value={p.medication} />
      </Section>

      <div className="mt-6">
        <Link
          href={`/payroll/payslips/generate?staff=${id}`}
          className="rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-forest hover:bg-brand-amber/90"
        >
          Generate a payslip for {p.name} →
        </Link>
      </div>
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
    <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        {title}
      </h2>
      <dl className="mt-3 grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[200px_1fr]">
        {children}
      </dl>
    </section>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  return (
    <>
      <dt className="text-brand-slate">{label}</dt>
      <dd
        className={`${mono ? 'font-mono text-xs' : 'text-sm'} text-brand-forest`}
      >
        {value || <span className="text-brand-slate">—</span>}
      </dd>
    </>
  )
}
