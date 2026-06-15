import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { STAFF_FEATURES } from '@/lib/permissions'
import {
  deactivateStaff,
  reactivateStaff,
  updateStaffDetails,
  updateStaffName,
  updateStaffPermissions,
  updateStaffPin,
  updateStaffRole,
} from '../actions'
import { TRAINING_TYPES } from '@/lib/training/constants'
import { COLOUR_OPTIONS, colourForIndex } from '@/lib/colours'
import {
  addTrainingRecord,
  deleteTrainingRecord,
} from '@/lib/training/actions'

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

  const [{ data: person }, { data: training }] = await Promise.all([
    admin
      .from('profiles')
      .select(
        'id, name, role, active, auth_user_id, permissions, phone, emergency_contact_name, emergency_contact_phone, right_to_work_ref, start_date, date_of_birth, hourly_rate, contracted_weekly_hours, colour_index, employment_type, annual_salary',
      )
      .eq('id', id)
      .maybeSingle(),
    admin
      .from('training_records')
      .select('id, type, certificate_ref, issued_at, expires_at, notes')
      .eq('user_id', id)
      .order('expires_at', { ascending: true, nullsFirst: false }),
  ])

  if (!person) notFound()

  const isSelf = session?.profileId === person.id
  // Any PIN-only profile can have its PIN reset here (staff or manager
  // without email). Owner manages their own PIN at /owner/me.
  const isPinHolder = !person.auth_user_id && person.role !== 'owner'

  const updateName = updateStaffName.bind(null, id)
  const updateDetails = updateStaffDetails.bind(null, id)
  const updatePin = updateStaffPin.bind(null, id)
  const updatePerms = updateStaffPermissions.bind(null, id)
  const updateRole = updateStaffRole.bind(null, id)
  const addTraining = addTrainingRecord.bind(null, id)

  const currentPerms = (person.permissions ?? {}) as Record<string, boolean>
  const today = new Date().toISOString().slice(0, 10)
  const trainingTypeLabel: Record<string, string> = Object.fromEntries(
    TRAINING_TYPES.map((t) => [t.value, t.label]),
  )

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

      {person.role !== 'owner' && !isSelf && (
        <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Role
          </h2>
          <form action={updateRole} className="mt-3 flex items-end gap-2">
            <select
              name="role"
              defaultValue={person.role}
              className="rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            >
              <option value="staff">Staff (tablet)</option>
              <option value="manager">Manager (back-office)</option>
            </select>
            <button
              type="submit"
              className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            >
              Update
            </button>
          </form>
          <p className="mt-2 text-xs text-brand-slate">
            Managers don&apos;t see the tablet hub (no clock in/out) but get
            full access to the back-office (rota, timesheets, compliance,
            cash, etc.).
          </p>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Details
        </h2>
        <form action={updateDetails} className="mt-3 grid grid-cols-2 gap-3">
          <Field
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={person.phone ?? ''}
          />
          <Field
            label="Start date"
            name="start_date"
            type="date"
            defaultValue={person.start_date ?? ''}
          />
          <Field
            label="Emergency contact name"
            name="emergency_contact_name"
            defaultValue={person.emergency_contact_name ?? ''}
          />
          <Field
            label="Emergency contact phone"
            name="emergency_contact_phone"
            type="tel"
            defaultValue={person.emergency_contact_phone ?? ''}
          />
          <Field
            label="Right-to-work reference"
            name="right_to_work_ref"
            defaultValue={person.right_to_work_ref ?? ''}
          />
          <Field
            label="Hourly rate (£)"
            name="hourly_rate"
            type="number"
            step="0.01"
            defaultValue={person.hourly_rate?.toString() ?? ''}
          />
          <Field
            label="Contracted hrs / week"
            name="contracted_weekly_hours"
            type="number"
            step="0.5"
            defaultValue={person.contracted_weekly_hours?.toString() ?? ''}
          />
          <Field
            label="Date of birth"
            name="date_of_birth"
            type="date"
            defaultValue={person.date_of_birth ?? ''}
          />
          <div>
            <label
              htmlFor="employment_type"
              className="block text-xs font-medium text-brand-forest"
            >
              Employment type
            </label>
            <select
              id="employment_type"
              name="employment_type"
              defaultValue={person.employment_type ?? ''}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
            >
              <option value="">— not set —</option>
              <option value="paye">PAYE (salaried, costs every day)</option>
              <option value="casual">Casual / hourly</option>
              <option value="self_employed">Self-employed</option>
              <option value="owner_draw">Owner draw (no payroll)</option>
            </select>
          </div>
          <Field
            label="Annual salary (PAYE only)"
            name="annual_salary"
            type="number"
            step="0.01"
            defaultValue={person.annual_salary?.toString() ?? ''}
          />
          <div className="col-span-2">
            <label className="block text-xs font-medium text-brand-forest">
              Rota colour
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <label
                className="flex cursor-pointer items-center gap-1 rounded-md border border-brand-sage/60 bg-white px-2 py-1 text-xs text-brand-forest"
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  minHeight: '36px',
                }}
              >
                <input
                  type="radio"
                  name="colour_index"
                  value=""
                  defaultChecked={person.colour_index == null}
                />
                Auto
              </label>
              {COLOUR_OPTIONS.map((opt) => {
                const c = colourForIndex(opt.index)
                const selected = person.colour_index === opt.index
                return (
                  <label
                    key={opt.index}
                    className="flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs"
                    style={{
                      backgroundColor: c.bg,
                      borderColor: selected ? c.border : 'transparent',
                      borderWidth: selected ? 2 : 1,
                      color: c.text,
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      minHeight: '36px',
                    }}
                  >
                    <input
                      type="radio"
                      name="colour_index"
                      value={opt.index}
                      defaultChecked={selected}
                    />
                    <span
                      aria-hidden
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: c.dot }}
                    />
                    {opt.name}
                  </label>
                )
              })}
            </div>
          </div>
          <div className="col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            >
              Save details
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Training records
        </h2>
        <p className="mt-1 text-xs text-brand-slate">
          Food Hygiene, allergen awareness, first aid, etc. Records with
          expiry dates surface in the EHO compliance pack.
        </p>

        <ul className="mt-3 divide-y divide-brand-sage/30 text-sm">
          {(training ?? []).length === 0 && (
            <li className="py-2 text-brand-slate">No training records yet.</li>
          )}
          {(training ?? []).map((t) => {
            const exp = t.expires_at ? new Date(t.expires_at) : null
            const expired = exp ? exp < new Date() : false
            const soon =
              exp &&
              !expired &&
              exp.getTime() - Date.now() < 60 * 24 * 60 * 60 * 1000
            return (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div>
                  <p className="font-medium text-brand-forest">
                    {trainingTypeLabel[t.type] ?? t.type}
                  </p>
                  <p className="text-xs text-brand-slate">
                    {t.certificate_ref && <>Cert {t.certificate_ref} · </>}
                    {t.issued_at && (
                      <>
                        Issued{' '}
                        {new Date(t.issued_at).toLocaleDateString([], {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                      </>
                    )}
                    {t.expires_at && (
                      <>
                        · Expires{' '}
                        <span
                          className={
                            expired
                              ? 'text-brand-amber'
                              : soon
                                ? 'text-brand-amber'
                                : 'text-brand-teal-deep'
                          }
                        >
                          {new Date(t.expires_at).toLocaleDateString([], {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {expired ? ' (expired)' : soon ? ' (soon)' : ''}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <form
                  action={deleteTrainingRecord.bind(null, id, t.id)}
                  className="ml-3"
                >
                  <button
                    type="submit"
                    className="text-xs text-brand-amber hover:underline"
                  >
                    Remove
                  </button>
                </form>
              </li>
            )
          })}
        </ul>

        <form action={addTraining} className="mt-4 grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label
              htmlFor="type"
              className="block text-xs font-medium text-brand-forest"
            >
              Type
            </label>
            <select
              id="type"
              name="type"
              defaultValue="food_hygiene_l2"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            >
              {TRAINING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Certificate ref"
            name="certificate_ref"
            placeholder="e.g. RSPH-12345"
          />
          <Field label="Issued" name="issued_at" type="date" defaultValue={today} />
          <Field label="Expires" name="expires_at" type="date" />
          <Field label="Notes" name="notes" />
          <div className="col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            >
              Add training
            </button>
          </div>
        </form>
      </section>

      {isPinHolder && (
        <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Reset PIN
          </h2>
          <p className="mt-1 text-xs text-brand-slate">
            Sets a new 4-digit PIN for {person.name}. Must be unique among
            active people. Use this when someone forgets theirs.
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

      {person.role === 'staff' && (
        <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Tablet permissions
          </h2>
          <p className="mt-1 text-xs text-brand-slate">
            Toggle which sections this staff member can use. Unchecked sections
            are hidden from their tablet hub and their actions are rejected.
          </p>
          <form action={updatePerms} className="mt-4 space-y-3">
            {STAFF_FEATURES.map((f) => {
              const enabled = currentPerms[f.key] !== false
              return (
                <label
                  key={f.key}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-brand-sage/40 px-4 py-3 hover:bg-brand-sage/5"
                >
                  <input
                    type="checkbox"
                    name={`perm_${f.key}`}
                    defaultChecked={enabled}
                    className="h-5 w-5 rounded border-brand-sage/60 accent-brand-teal-deep"
                  />
                  <span className="text-sm text-brand-forest">{f.label}</span>
                </label>
              )
            })}
            <button
              type="submit"
              className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            >
              Save permissions
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

function Field({
  label,
  name,
  type = 'text',
  step,
  defaultValue,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  step?: string
  defaultValue?: string
  placeholder?: string
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-medium text-brand-forest"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
      />
    </div>
  )
}
