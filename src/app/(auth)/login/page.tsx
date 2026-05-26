import Image from 'next/image'
import Link from 'next/link'
import { signInWithPin } from '@/lib/auth/actions'
import { PinPad } from '@/components/shared/PinPad'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const params = await searchParams

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center p-6 sm:p-8">
      <Image
        src="/logo.png"
        alt="Needham Nest Café"
        width={120}
        height={120}
        priority
        className="rounded-full"
      />

      <h1 className="mt-6 text-lg font-semibold text-brand-forest">
        Enter your PIN
      </h1>

      {params.notice && (
        <p className="mt-3 w-full rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-center text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}
      {params.error && (
        <p className="mt-3 w-full rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-center text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <div className="mt-6">
        <PinPad action={signInWithPin} />
      </div>

      <p className="mt-8 text-xs text-brand-slate">
        Forgot your PIN?{' '}
        <Link
          href="/login/email"
          className="font-medium text-brand-amber hover:underline"
        >
          Sign in with email
        </Link>
      </p>
    </main>
  )
}
