import Link from 'next/link'
import { createStaff } from '../actions'

export default async function NewStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner/staff"
        className="text-sm text-brand-amber hover:underline"
      >
        ← All people
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Add person
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Creates a PIN-only account. Staff use the PIN on the tablet to
        clock in / log temps. Managers use the PIN to access the back-office.
      </p>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <form
        action={createStaff}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-brand-forest"
          >
            Name
            <span className="ml-1 text-brand-amber">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="off"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="role"
            className="block text-sm font-medium text-brand-forest"
          >
            Role
            <span className="ml-1 text-brand-amber">*</span>
          </label>
          <select
            id="role"
            name="role"
            defaultValue="staff"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            <option value="staff">Staff — tablet clock-in / temps / etc.</option>
            <option value="manager">
              Manager — back-office access (no clock in/out)
            </option>
          </select>
        </div>

        <div>
          <label
            htmlFor="pin"
            className="block text-sm font-medium text-brand-forest"
          >
            4-digit PIN
            <span className="ml-1 text-brand-amber">*</span>
          </label>
          <input
            id="pin"
            name="pin"
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            required
            autoComplete="off"
            className="mt-1 w-32 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-center font-mono text-xl tracking-[0.4em] text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
          <p className="mt-1 text-xs text-brand-slate">
            Must be unique among active staff.
          </p>
        </div>

        <div>
          <label
            htmlFor="date_of_birth"
            className="block text-sm font-medium text-brand-forest"
          >
            Date of birth
          </label>
          <input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
          <p className="mt-1 text-xs text-brand-slate">
            Needed for statutory break checks — under-18s get stricter rules.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            Create
          </button>
          <Link
            href="/owner/staff"
            className="rounded-lg border border-brand-sage/60 px-4 py-2 text-sm font-medium text-brand-forest hover:bg-brand-sage/10"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  )
}
