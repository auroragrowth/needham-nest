import Image from 'next/image'
import Link from 'next/link'
import { signInWithEmail } from '@/lib/auth/actions'

export default async function EmailLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const params = await searchParams

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-8">
      <div className="flex flex-col items-center">
        <Image
          src="/logo.png"
          alt="Needham Nest Café"
          width={120}
          height={120}
          priority
          className="rounded-full"
        />
      </div>

      <div className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-forest">
          Sign in with email
        </h2>
        <p className="mt-1 text-xs text-brand-slate">
          Owner recovery only. Daily login uses your PIN.
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

        <form action={signInWithEmail} className="mt-6 space-y-4">
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            Sign in
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-brand-slate">
        <Link
          href="/login"
          className="font-medium text-brand-amber hover:underline"
        >
          ← Back to PIN sign-in
        </Link>
      </p>
    </main>
  )
}

function Field({
  label,
  name,
  type,
  autoComplete,
}: {
  label: string
  name: string
  type: string
  autoComplete: string
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-brand-forest"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
      />
    </div>
  )
}
