import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
}

export default async function StaffListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: people } = await supabase
    .from('profiles')
    .select('id, name, role, active, auth_user_id')
    .order('active', { ascending: false })
    .order('role', { ascending: true })
    .order('name', { ascending: true })

  return (
    <main className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            People
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Owner, manager, and staff accounts. Staff use a 4-digit PIN on the
            kiosk tablet (no email login).
          </p>
        </div>
        <Link
          href="/owner/staff/new"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Add staff
        </Link>
      </div>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Auth</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(people ?? []).map((p) => (
              <tr
                key={p.id}
                className={`border-t border-brand-sage/30 ${
                  p.active ? '' : 'text-brand-slate'
                }`}
              >
                <td className="px-4 py-3 font-medium text-brand-forest">
                  {p.name}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                      p.role === 'owner'
                        ? 'bg-brand-amber/20 text-brand-forest'
                        : p.role === 'manager'
                          ? 'bg-brand-teal-deep/15 text-brand-teal-deep'
                          : 'bg-brand-sage/30 text-brand-forest'
                    }`}
                  >
                    {ROLE_LABEL[p.role] ?? p.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {p.auth_user_id ? 'Email login' : 'PIN only'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {p.active ? (
                    <span className="text-brand-teal-deep">Active</span>
                  ) : (
                    <span className="text-brand-slate">Inactive</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/owner/staff/${p.id}`}
                    className="text-sm font-medium text-brand-amber hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {(people?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No staff yet. Click <em>Add staff</em> to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
