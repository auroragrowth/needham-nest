import Image from 'next/image'
import Link from 'next/link'
import { logout } from '@/lib/auth/actions'
import { StockSearch } from '@/components/shared/StockSearch'
import { SectionBar } from '@/components/shared/SectionBar'

type Role = 'owner' | 'manager' | 'staff' | 'payroll'

const ROLE_BADGE: Record<Role, string> = {
  owner: 'bg-brand-amber text-brand-forest',
  manager: 'bg-brand-teal-deep text-brand-cream',
  staff: 'bg-brand-sage text-brand-forest',
  payroll: 'bg-brand-teal text-brand-cream',
}

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
  payroll: 'Payroll',
}

export function RoleHeader({ role, name }: { role: Role; name: string }) {
  return (
    <header className="bg-brand-forest">
      <div className="flex items-center justify-between px-6 py-3 text-brand-cream">
      <Link
        href="/"
        className="flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-brand-olive"
        title="Back to dashboard"
        aria-label="Back to dashboard"
      >
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
        <span className="text-xs text-brand-cream/70">· Dashboard</span>
      </Link>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-brand-cream/90 sm:inline">{name}</span>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-brand-cream/80 underline-offset-2 hover:text-brand-amber hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>
      </div>
      <div className="border-t border-brand-olive/40 px-6 pb-3 pt-2">
        <StockSearch />
      </div>
      <SectionBar />
    </header>
  )
}
