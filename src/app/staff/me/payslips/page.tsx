import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function MyPayslipsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  // Payslips are owner-only per Paul's request — staff / manager can't
  // reach this page even if they type the URL manually.
  if (session.role !== 'owner') redirect('/staff')

  const admin = createAdminClient()
  const { data: payslips } = await admin
    .from('payslips')
    .select(
      'id, slip_number, period_from, period_to, pay_date, gross_pay, net_pay, paid_at, paid_method',
    )
    .eq('staff_id', session.profileId)
    .order('pay_date', { ascending: false })

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/staff"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Tablet
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        My payslips
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Every payslip we&apos;ve issued you, newest first. Paid wages run
        Mon → Sun, one week in arrears.
      </p>

      {(payslips?.length ?? 0) === 0 ? (
        <p className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
          No payslips yet. Check back after your first full week.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {(payslips ?? []).map((ps) => (
            <li
              key={ps.id}
              className={`rounded-xl border p-4 ${
                ps.paid_at
                  ? 'border-brand-teal/40 bg-brand-teal/5'
                  : 'border-brand-amber/60 bg-brand-amber/5'
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-brand-forest">
                  <span className="font-mono text-sm text-brand-teal-deep">
                    {ps.slip_number ?? '—'}
                  </span>{' '}
                  <span className="text-xs text-brand-slate">
                    · {fmtDate(ps.period_from)} – {fmtDate(ps.period_to)}
                  </span>
                </p>
                <p className="font-mono text-lg font-semibold text-brand-forest">
                  £{Number(ps.net_pay).toFixed(2)}
                </p>
              </div>
              <p className="mt-1 text-xs text-brand-slate">
                Pay date {fmtDate(ps.pay_date)} · gross £
                {Number(ps.gross_pay).toFixed(2)}
              </p>
              <p className="mt-1 text-xs">
                {ps.paid_at ? (
                  <span className="font-semibold text-brand-teal-deep">
                    ✓ Paid {fmtDate(ps.paid_at.slice(0, 10))}
                    {ps.paid_method && ` via ${ps.paid_method}`}
                  </span>
                ) : (
                  <span className="font-semibold text-brand-amber">
                    ⏳ Unpaid — expected on {fmtDate(ps.pay_date)}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
