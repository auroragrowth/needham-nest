import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function PayslipsIndexPage() {
  const admin = createAdminClient()

  const { data: staff } = await admin
    .from('profiles')
    .select(
      'id, name, role, employment_type, hourly_rate, annual_salary',
    )
    .eq('active', true)
    .order('name')

  // Default to month-to-date for the per-staff payslip link.
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  return (
    <main className="mx-auto max-w-3xl">
      <Link href="/owner" className="text-sm text-brand-amber hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Payslips
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Tap a person to see every shift they&apos;ve clocked in a date
        range, with gross pay totals. Use it as the source for your payroll
        software — actual PAYE deductions still go through HMRC.
      </p>
      <Link
        href="/owner/payslips/week"
        className="mt-4 inline-block rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
      >
        Whole-team weekly printout →
      </Link>

      <ul className="mt-6 space-y-2">
        {(staff ?? []).map((s) => {
          const typeLabel =
            s.employment_type === 'paye'
              ? `PAYE · £${Number(s.annual_salary ?? 0).toFixed(0)}/yr`
              : s.employment_type === 'casual'
                ? `Hourly · £${Number(s.hourly_rate ?? 0).toFixed(2)}/h`
                : s.employment_type === 'owner_draw'
                  ? 'Owner draw (no payroll)'
                  : 'Not set'
          return (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-brand-sage/40 bg-white p-4"
            >
              <div>
                <p className="text-base font-semibold text-brand-forest">
                  {s.name}
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-brand-slate">
                    {s.role}
                  </span>
                </p>
                <p className="text-xs text-brand-slate">{typeLabel}</p>
              </div>
              <Link
                href={`/owner/payslips/${s.id}?from=${monthStart}&to=${today}`}
                className="rounded-lg bg-brand-forest px-3 py-1.5 text-sm font-medium text-brand-cream hover:bg-brand-olive"
              >
                Open →
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
