import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { PickMixCalculator } from './Calculator'

export default async function PickMixPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <main className="mx-auto max-w-md p-6">
      <Link
        href="/"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Pick &amp; mix calculator
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Weigh the bag, type the grams, charge the price. £1.50 per 100g.
      </p>

      <div className="mt-6">
        <PickMixCalculator />
      </div>
    </main>
  )
}
