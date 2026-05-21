import { createClient } from '@/lib/supabase/server'

type Status =
  | { kind: 'unconfigured' }
  | { kind: 'connected'; note?: string }
  | { kind: 'error'; message: string }

async function probeSupabase(): Promise<Status> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { kind: 'unconfigured' }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.from('profiles').select('user_id').limit(1)

    if (error?.code === '42P01') {
      return {
        kind: 'connected',
        note: 'profiles table not yet created — expected before Phase 0 SQL',
      }
    }
    if (error) return { kind: 'error', message: error.message }
    return { kind: 'connected' }
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

export default async function Home() {
  const status = await probeSupabase()

  return (
    <main className="mx-auto max-w-2xl p-8 font-sans">
      <h1 className="text-3xl font-semibold tracking-tight">
        Needham Nest Café
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Management system — scaffold ready, Phase 0 next.
      </p>

      <section className="mt-8 rounded-lg border border-zinc-200 p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Supabase connection
        </h2>
        <p className="mt-2">
          {status.kind === 'unconfigured' && (
            <>
              ⏳ <strong>Not configured.</strong> Fill in{' '}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-sm">
                .env.local
              </code>{' '}
              with your Supabase URL and anon key, then restart the dev server.
            </>
          )}
          {status.kind === 'connected' && (
            <>
              ✅ <strong>Connected.</strong>
              {status.note && (
                <span className="text-zinc-600"> ({status.note})</span>
              )}
            </>
          )}
          {status.kind === 'error' && (
            <>
              ❌ <strong>Error:</strong> {status.message}
            </>
          )}
        </p>
      </section>
    </main>
  )
}
