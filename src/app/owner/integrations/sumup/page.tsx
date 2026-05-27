import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { disconnectSumUp, manualSync } from '@/lib/sumup/actions'

export default async function SumUpIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const { data: conn } = await admin
    .from('sumup_connections')
    .select('merchant_code, connected_at, last_sync_at, last_sync_error, expires_at, scope')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: recentImports } = await admin
    .from('till_imports')
    .select('id, date, gross, fees, net, transaction_count, payment_mix')
    .eq('source', 'sumup')
    .order('date', { ascending: false })
    .limit(10)

  const envConfigured =
    !!process.env.SUMUP_CLIENT_ID && !!process.env.SUMUP_CLIENT_SECRET

  return (
    <main className="mx-auto max-w-3xl">
      <Link
        href="/owner"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        SumUp integration
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Pulls payouts and item-level transactions from your SumUp till. Each
        sale becomes a takings entry and triggers recipe-driven stock
        depletion.
      </p>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}
      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      {!envConfigured && (
        <section className="mt-6 rounded-xl border border-brand-amber/50 bg-brand-amber/10 p-5">
          <h2 className="text-sm font-semibold text-brand-forest">
            Set up the SumUp app first
          </h2>
          <ol className="mt-2 ml-5 list-decimal space-y-1 text-sm text-brand-forest">
            <li>
              Go to{' '}
              <a
                href="https://developer.sumup.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-amber hover:underline"
              >
                developer.sumup.com
              </a>
              , sign in with your SumUp Business account
            </li>
            <li>
              <strong>My Apps → Create OAuth Client</strong> (confidential /
              server-side)
            </li>
            <li>
              Redirect URI:{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">
                https://needham-nest.vercel.app/api/sumup/callback
              </code>
            </li>
            <li>
              Tick scopes: <code>transactions.history</code>,{' '}
              <code>payouts</code>, <code>user.profile_readonly</code>
            </li>
            <li>
              Copy the Client ID + Client Secret into Vercel env vars:{' '}
              <code>SUMUP_CLIENT_ID</code> and <code>SUMUP_CLIENT_SECRET</code>
            </li>
            <li>Redeploy on Vercel — then come back here to connect</li>
          </ol>
        </section>
      )}

      {envConfigured && !conn && (
        <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Not connected
          </h2>
          <p className="mt-2 text-sm text-brand-slate">
            Click below to connect. You&apos;ll be sent to SumUp to authorise,
            then bounced back here.
          </p>
          <a
            href="/api/sumup/connect"
            className="mt-4 inline-block rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            Connect SumUp
          </a>
        </section>
      )}

      {conn && (
        <>
          <section className="mt-6 rounded-xl border border-brand-teal/40 bg-brand-teal/10 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              Connected
            </h2>
            <p className="mt-2 text-sm text-brand-forest">
              {conn.merchant_code && (
                <>
                  Merchant <strong>{conn.merchant_code}</strong> ·{' '}
                </>
              )}
              Authorised{' '}
              {new Date(conn.connected_at).toLocaleString([], {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <p className="mt-1 text-xs text-brand-slate">
              {conn.last_sync_at
                ? `Last sync ${new Date(conn.last_sync_at).toLocaleString([], {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Never synced'}
              {conn.last_sync_error && (
                <span className="ml-2 text-brand-amber">
                  · last error: {conn.last_sync_error}
                </span>
              )}
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <form action={manualSync} className="flex items-end gap-2">
                <div>
                  <label className="block text-xs font-medium text-brand-forest">
                    Days back
                  </label>
                  <input
                    name="days_back"
                    type="number"
                    min="1"
                    max="30"
                    defaultValue={1}
                    className="mt-1 w-20 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
                >
                  Sync now
                </button>
              </form>
              <form action={disconnectSumUp}>
                <button
                  type="submit"
                  className="rounded-lg border border-brand-amber/60 bg-brand-amber/10 px-3 py-2 text-sm font-medium text-brand-forest hover:bg-brand-amber/20"
                >
                  Disconnect
                </button>
              </form>
            </div>
          </section>

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Recent imports
          </h2>
          <div className="mt-2 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Transactions</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Fees</th>
                  <th className="px-4 py-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {(recentImports ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-brand-sage/30">
                    <td className="px-4 py-3 text-brand-forest">
                      {new Date(r.date).toLocaleDateString([], {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.transaction_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-brand-forest">
                      £{Number(r.gross ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-brand-slate">
                      £{Number(r.fees ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-brand-teal-deep">
                      £{Number(r.net ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {(recentImports?.length ?? 0) === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-brand-slate"
                    >
                      No imports yet. Hit Sync now to pull recent data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  )
}
