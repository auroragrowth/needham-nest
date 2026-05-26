import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import {
  deactivateStaff,
  reactivateStaff,
  updateStaffName,
  updateStaffPin,
} from '../actions'

export default async function EditStaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const session = await getSession()
  const admin = createAdminClient()

  const { data: person } = await admin
    .from('profiles')
    .select('id, name, role, active, auth_user_id')
    .eq('id', id)
    .maybeSingle()

  if (!person) notFound()

  const isSelf = session?.profileId === person.id
  const isPinHolder = person.role === 'staff' && !person.auth_user_id

  const updateName = updateStaffName.bind(null, id)
  const updatePin = updateStaffPin.bind(null, id)

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/owner/staff"
        className="text-sm text-brand-amber hover:underline"
      >
        ← All people
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {person.name}
      </h1>
      <div className="mt-1 flex items-center gap-2 text-sm text-brand-slate">
        <span className="capitalize">{person.role}</span>
        <span>·</span>
        <span>{person.active ? 'Active' : 'Inactive'}</span>
        {isSelf && (
          <>
            <span>·</span>
            <span className="text-brand-amber">This is you</span>
          </>
        )}
      </div>

      {sp.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {sp.notice}
        </p>
      )}
      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Name
        </h2>
        <form action={updateName} className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <input
              name="name"
              type="text"
              required
              defaultValue={person.name}
              className="w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            Update
          </button>
        </form>
      </section>

      {isPinHolder && (
        <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Change PIN
          </h2>
          <p className="mt-1 text-xs text-brand-slate">
            Replaces the existing PIN. Must be unique among active staff.
          </p>
          <form action={updatePin} className="mt-3 flex items-end gap-2">
            <div>
              <input
                name="pin"
                type="text"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                required
                autoComplete="off"
                placeholder="••••"
                className="w-32 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-center font-mono text-xl tracking-[0.4em] text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            >
              Set PIN
            </button>
          </form>
        </section>
      )}

      {!isSelf && (
        <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            {person.active ? 'Deactivate' : 'Reactivate'}
          </h2>
          <p className="mt-1 text-sm text-brand-slate">
            {person.active
              ? 'Disables their PIN and removes them from staff pickers. History is preserved.'
              : 'Restores their PIN and access.'}
          </p>
          <form
            action={
              person.active
                ? deactivateStaff.bind(null, id)
                : reactivateStaff.bind(null, id)
            }
            className="mt-3"
          >
            <button
              type="submit"
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                person.active
                  ? 'border border-brand-amber/60 bg-brand-amber/10 text-brand-forest hover:bg-brand-amber/20'
                  : 'bg-brand-teal-deep text-brand-cream hover:bg-brand-teal'
              }`}
            >
              {person.active ? 'Deactivate staff' : 'Reactivate staff'}
            </button>
          </form>
        </section>
      )}
    </main>
  )
}
