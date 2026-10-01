'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { pageSection, SECTIONS } from '@/lib/sections'

/**
 * The coloured bar under the header on every tablet page: which section you're
 * in, which page, and the way home. Pages outside the three sections get none.
 */
export function SectionBar() {
  const here = pageSection(usePathname() ?? '')
  if (!here) return null
  const s = SECTIONS[here.section]
  return (
    <nav className={`flex items-center gap-3 px-6 py-2 text-sm ${s.bar}`}>
      <Link
        href="/"
        className="rounded-md border border-white px-2 py-0.5 font-medium hover:bg-white hover:text-brand-forest"
      >
        ← Home
      </Link>
      <span className="font-semibold uppercase tracking-[0.15em]">{s.label}</span>
      <span aria-hidden>›</span>
      <span className="truncate">{here.name}</span>
    </nav>
  )
}
