'use client'

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="cursor-pointer rounded-lg bg-brand-forest px-3 py-1.5 text-sm font-medium text-brand-cream hover:bg-brand-olive print:hidden"
      style={{ minHeight: '44px' }}
    >
      Print
    </button>
  )
}
