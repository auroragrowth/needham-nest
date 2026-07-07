import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  deletePayrollRun,
  markRunStatus,
} from '@/lib/payroll-runs/actions'

export const dynamic = 'force-dynamic'

function fmtMoney(n: number | string | null | undefined): string {
  if (n == null) return '£0.00'
  return `£${Number(n).toFixed(2)}`
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function PayrollRunDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notice?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  const admin = createAdminClient()
  const { data: run } = await admin
    .from('payroll_runs')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!run) notFound()

  let pdfUrl: string | null = null
  if (run.pdf_path) {
    const { data: signed } = await admin.storage
      .from('payroll-runs')
      .createSignedUrl(run.pdf_path, 60 * 60)
    pdfUrl = signed?.signedUrl ?? null
  }

  const setPaid = markRunStatus.bind(null, id, 'paid')
  const setFiled = markRunStatus.bind(null, id, 'filed')
  const setDraft = markRunStatus.bind(null, id, 'draft')
  const del = deletePayrollRun.bind(null, id)

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/owner/payroll-runs"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Payroll runs
      </Link>
      <header className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            {run.period_label}
          </h1>
          <p className="mt-1 text-xs text-brand-slate">
            {run.run_type} · pay date {fmtDate(run.pay_date)} · {run.headcount}{' '}
            person{run.headcount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {run.status !== 'paid' && (
            <form action={setPaid}>
              <button
                type="submit"
                className="rounded-lg bg-brand-teal-deep px-3 py-1.5 text-sm font-semibold text-brand-cream hover:bg-brand-teal"
              >
                ✓ Mark HMRC paid
              </button>
            </form>
          )}
          {run.status === 'paid' && (
            <form action={setFiled}>
              <button
                type="submit"
                className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
              >
                Undo · reopen
              </button>
            </form>
          )}
          {run.status === 'draft' && (
            <form action={setFiled}>
              <button
                type="submit"
                className="rounded-lg bg-brand-amber px-3 py-1.5 text-sm font-semibold text-brand-forest hover:bg-brand-amber/90"
              >
                Mark filed
              </button>
            </form>
          )}
          {run.status === 'filed' && (
            <form action={setDraft}>
              <button
                type="submit"
                className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
              >
                Back to draft
              </button>
            </form>
          )}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
            >
              👁 PDF
            </a>
          )}
          <form action={del}>
            <button
              type="submit"
              className="rounded-lg border border-brand-amber/60 px-3 py-1.5 text-sm text-brand-amber hover:bg-brand-amber/10"
            >
              🗑
            </button>
          </form>
        </div>
      </header>

      {sp.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {sp.notice}
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <StatBig
          label={
            run.status === 'paid'
              ? 'HMRC (paid)'
              : 'HMRC pot for this run'
          }
          value={fmtMoney(run.hmrc_due)}
          highlight={run.status !== 'paid'}
        />
        <StatBig label="Total net to bank" value={fmtMoney(run.total_net)} />
      </div>

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Breakdown
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-[200px_1fr]">
          <Row label="Total gross" value={fmtMoney(run.total_gross)} />
          <Row label="Tax deducted (PAYE)" value={fmtMoney(run.tax_deducted)} />
          <Row label="Employee NIC" value={fmtMoney(run.employee_nic)} />
          <Row label="Employer NIC" value={fmtMoney(run.employer_nic)} />
          <Row label="Total net" value={fmtMoney(run.total_net)} bold />
          <Row label="HMRC due" value={fmtMoney(run.hmrc_due)} bold />
          <Row label="Total net outlay" value={fmtMoney(run.total_outlay)} />
        </dl>
      </section>

      {run.notes && (
        <section className="mt-4 rounded-xl border border-brand-sage/40 bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Notes
          </h2>
          <p className="mt-2 text-sm whitespace-pre-line">{run.notes}</p>
        </section>
      )}
    </main>
  )
}

function StatBig({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl border-2 p-4 ${highlight ? 'border-brand-amber bg-brand-amber/10' : 'border-brand-sage/40 bg-white'}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold text-brand-forest">{value}</p>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <>
      <dt className="text-brand-slate">{label}</dt>
      <dd
        className={`font-mono ${bold ? 'font-semibold text-brand-forest' : 'text-brand-forest'}`}
      >
        {value}
      </dd>
    </>
  )
}
