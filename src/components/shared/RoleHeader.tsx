import Image from 'next/image'
import { logout } from '@/lib/auth/actions'

type Role = 'owner' | 'manager' | 'staff'

const ROLE_BADGE: Record<Role, string> = {
  owner: 'bg-brand-amber text-brand-forest',
  manager: 'bg-brand-teal-deep text-brand-cream',
  staff: 'bg-brand-sage text-brand-forest',
}

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
}

export function RoleHeader({ role, name }: { role: Role; name: string }) {
  return (
    <header className="flex items-center justify-between bg-brand-forest px-6 py-3 text-brand-cream">
      <div className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="Needham Nest Café"
          width={40}
          height={40}
          className="rounded-full"
        />
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${ROLE_BADGE[role]}`}
        >
          {ROLE_LABEL[role]}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-brand-cream/90">{name}</span>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-brand-cream/80 underline-offset-2 hover:text-brand-amber hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}
