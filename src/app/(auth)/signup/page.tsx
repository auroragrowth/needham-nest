import Image from 'next/image'
import Link from 'next/link'
import { signup } from '@/lib/auth/actions'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-8">
      <div className="flex flex-col items-center">
        <Image
          src="/logo.png"
          alt="Needham Nest Café"
          width={160}
          height={160}
          priority
          className="rounded-full"
        />
      </div>

      <div className="mt-8 rounded-xl border border-brand-sage/40 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-forest">
          Create account
        </h2>
        <p className="mt-1 text-sm text-brand-slate">
          The first account becomes the café owner. Disable signups in Supabase
          Dashboard → Authentication afterwards.
        </p>

        {params.error && (
          <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
            {params.error}
          </p>
        )}

        <form action={signup} className="mt-6 space-y-4">
          <Field
            label="Your name"
            name="name"
            type="text"
            autoComplete="name"
          />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters."
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-medium text-brand-cream transition-colors hover:bg-brand-olive"
          >
            Create account
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-brand-slate">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-brand-amber hover:underline"
        >
          Sign in
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
  minLength,
  hint,
}: {
  label: string
  name: string
  type: string
  autoComplete: string
  minLength?: number
  hint?: string
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
        minLength={minLength}
        autoComplete={autoComplete}
        className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
      />
      {hint && <p className="mt-1 text-xs text-brand-slate">{hint}</p>}
    </div>
  )
}
