import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateMyProfile, uploadMyPhoto } from './actions'

export const dynamic = 'force-dynamic'

export default async function MyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select(
      'name, phone, email, pronouns, address_line_1, address_line_2, address_city, address_postcode, emergency_contact_name, emergency_contact_phone, medical_conditions, medication, allergies, ni_number, tax_code, bank_sort_code, bank_account_number, uniform_size, photo_path, date_of_birth',
    )
    .eq('id', session.profileId)
    .maybeSingle()

  let photoUrl: string | null = null
  if (profile?.photo_path) {
    const { data: signed } = await admin.storage
      .from('staff-photos')
      .createSignedUrl(profile.photo_path, 60 * 60)
    photoUrl = signed?.signedUrl ?? null
  }

  const home =
    session.role === 'owner'
      ? '/owner'
      : session.role === 'manager'
        ? '/manager'
        : session.role === 'payroll'
          ? '/payroll'
          : '/staff'

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href={home} className="text-sm text-brand-amber hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        My profile
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Hi {profile?.name ?? session.name}. Update anything that&apos;s
        changed — payroll, address, emergency contact, uniform size, photo.
        Date of birth stays fixed; ask Paul if it&apos;s wrong.
      </p>

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

      {/* PHOTO */}
      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Photo
        </h2>
        <div className="mt-3 flex items-center gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Your photo"
              className="h-24 w-24 rounded-full border-2 border-brand-sage/60 object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-brand-sage/60 bg-brand-sage/10 text-3xl text-brand-slate">
              {(profile?.name ?? session.name).charAt(0)}
            </div>
          )}
          <form
            action={uploadMyPhoto}
            encType="multipart/form-data"
            className="flex flex-1 flex-wrap items-end gap-2"
          >
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
              capture="user"
              required
              className="text-sm text-brand-forest"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-forest px-3 py-1.5 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            >
              Upload
            </button>
          </form>
        </div>
      </section>

      <form
        action={updateMyProfile}
        className="mt-6 space-y-6 rounded-xl border border-brand-sage/40 bg-white p-5"
      >
        <Section title="Contact">
          <Field label="Phone" name="phone" type="tel" defaultValue={profile?.phone ?? ''} />
          <Field label="Email" name="email" type="email" defaultValue={profile?.email ?? ''} />
          <Field
            label="Pronouns (optional)"
            name="pronouns"
            placeholder="she / her, they / them"
            defaultValue={profile?.pronouns ?? ''}
          />
        </Section>

        <Section title="Address">
          <FullField
            label="Line 1"
            name="address_line_1"
            defaultValue={profile?.address_line_1 ?? ''}
          />
          <FullField
            label="Line 2 (optional)"
            name="address_line_2"
            defaultValue={profile?.address_line_2 ?? ''}
          />
          <Field
            label="Town / city"
            name="address_city"
            defaultValue={profile?.address_city ?? ''}
          />
          <Field
            label="Postcode"
            name="address_postcode"
            uppercase
            defaultValue={profile?.address_postcode ?? ''}
          />
        </Section>

        <Section title="Uniform">
          <div className="sm:col-span-2">
            <label
              htmlFor="uniform_size"
              className="block text-xs font-medium text-brand-forest"
            >
              Size
            </label>
            <select
              id="uniform_size"
              name="uniform_size"
              defaultValue={profile?.uniform_size ?? ''}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
              style={{ minHeight: '44px' }}
            >
              <option value="">— not set —</option>
              <option value="XS">XS</option>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
              <option value="XXL">XXL</option>
              <option value="XXXL">XXXL</option>
            </select>
          </div>
        </Section>

        <Section title="Emergency contact">
          <Field
            label="Name"
            name="emergency_contact_name"
            defaultValue={profile?.emergency_contact_name ?? ''}
          />
          <Field
            label="Phone"
            name="emergency_contact_phone"
            type="tel"
            defaultValue={profile?.emergency_contact_phone ?? ''}
          />
        </Section>

        <Section title="Health (confidential)">
          <FullTextarea
            label="Medical conditions"
            name="medical_conditions"
            defaultValue={
              profile?.medical_conditions === 'None reported'
                ? ''
                : (profile?.medical_conditions ?? '')
            }
            placeholder="e.g. asthma, epilepsy, diabetes"
          />
          <FullTextarea
            label="Medication"
            name="medication"
            defaultValue={
              profile?.medication === 'None reported'
                ? ''
                : (profile?.medication ?? '')
            }
            placeholder="e.g. inhaler, EpiPen"
          />
          <FullTextarea
            label="Allergies (optional)"
            name="allergies"
            defaultValue={profile?.allergies ?? ''}
          />
        </Section>

        <Section title="Payroll">
          <Field
            label="NI number"
            name="ni_number"
            uppercase
            placeholder="QQ 12 34 56 C"
            defaultValue={profile?.ni_number ?? ''}
          />
          <Field
            label="Tax code"
            name="tax_code"
            uppercase
            placeholder="1257L"
            defaultValue={profile?.tax_code ?? ''}
          />
          <Field
            label="Bank sort code"
            name="bank_sort_code"
            placeholder="00-00-00"
            defaultValue={profile?.bank_sort_code ?? ''}
          />
          <Field
            label="Bank account number"
            name="bank_account_number"
            defaultValue={profile?.bank_account_number ?? ''}
          />
        </Section>

        <button
          type="submit"
          className="w-full cursor-pointer rounded-lg bg-brand-forest px-4 py-3 text-base font-semibold text-brand-cream hover:bg-brand-olive"
          style={{ minHeight: '44px' }}
        >
          Save changes
        </button>
      </form>
    </main>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        {title}
      </legend>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {children}
      </div>
    </fieldset>
  )
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  placeholder,
  uppercase,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  placeholder?: string
  uppercase?: boolean
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
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`mt-1 block w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest ${uppercase ? 'uppercase' : ''}`}
        style={{ minHeight: '44px' }}
      />
    </div>
  )
}

function FullField(props: Parameters<typeof Field>[0]) {
  return (
    <div className="sm:col-span-2">
      <Field {...props} />
    </div>
  )
}

function FullTextarea({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
}) {
  return (
    <div className="sm:col-span-2">
      <label
        htmlFor={name}
        className="block text-xs font-medium text-brand-forest"
      >
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={2}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
      />
    </div>
  )
}
