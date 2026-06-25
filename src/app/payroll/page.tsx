import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function lastCompletedSunday(d: Date): { from: string; to: string } {
  const dow = d.getUTCDay() // 0=Sun..6=Sat
  const lastSun = new Date(d)
  lastSun.setUTCDate(d.getUTCDate() - dow)
  const lastMon = new Date(lastSun)
  lastMon.setUTCDate(lastSun.getUTCDate() - 6)
  return { from: isoDate(lastMon), to: isoDate(lastSun) }
}

export default async function PayrollDashboard() {
  const admin = createAdminClient()
  const { count: staffCount } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .eq('payroll_included', true)
    .neq('role', 'owner')
    .neq('role', 'payroll')

  const { count: payslipsThisYear } = await admin
    .from('payslips')
    .select('*', { count: 'exact', head: true })
    .gte('pay_date', `${new Date().getUTCFullYear()}-01-01`)

  const { from, to } = lastCompletedSunday(new Date())

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Payroll
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Read-only access to staff payroll data + the payslip generator.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card
          href="/payroll/staff"
          title="Staff details"
          subtitle={`${staffCount ?? 0} active — NI, tax code, bank, address, rates`}
          cta="Open →"
        />
        <Card
          href={`/payroll/hours?from=${from}&to=${to}`}
          title="Weekly hours"
          subtitle={`Last completed week (Mon ${from} – Sun ${to})`}
          cta="Open →"
        />
        <Card
          href="/payroll/payslips"
          title="Payslips"
          subtitle={`${payslipsThisYear ?? 0} generated this year`}
          cta="Open →"
        />
        <Card
          href={`/payroll/payslips/generate?from=${from}&to=${to}`}
          title="Generate slips"
          subtitle="Pick a person + period, pre-fills from timesheet"
          cta="Open →"
        />
      </div>
    </main>
  )
}

function Card({
  href,
  title,
  subtitle,
  cta,
}: {
  href: string
  title: string
  subtitle: string
  cta: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-brand-sage/40 bg-white p-5 transition-colors hover:border-brand-teal/60 hover:bg-brand-teal/5"
    >
      <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        {title}
      </h3>
      <p className="mt-2 text-brand-forest">{subtitle}</p>
      <p className="mt-3 text-sm font-medium text-brand-amber">{cta}</p>
    </Link>
  )
}
