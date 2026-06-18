import Link from 'next/link'
import { uploadAndExtractInvoices } from '@/lib/invoices/actions'

export const dynamic = 'force-dynamic'

export default async function InvoicesUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/owner"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Bulk-upload supplier invoices
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Drop in PDFs or iPhone JPG photos of supplier invoices. Each one is
        AI-read for the date, supplier, amount, VAT and invoice number, then
        landed in your expenses ledger. Reconciliation against your bank
        statement runs automatically as soon as the batch lands.
      </p>

      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <form
        action={uploadAndExtractInvoices}
        encType="multipart/form-data"
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div>
          <label
            htmlFor="files"
            className="block text-sm font-medium text-brand-forest"
          >
            Files (PDF / JPG / PNG / HEIC)
          </label>
          <input
            id="files"
            name="files"
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp"
            required
            className="mt-2 block w-full rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-sm text-brand-forest"
            style={{
              touchAction: 'manipulation',
              WebkitAppearance: 'none',
              minHeight: '44px',
            }}
          />
          <p className="mt-2 text-xs text-brand-slate">
            Pick as many as you like. Bigger batches take longer because
            each file is sent to Claude for extraction.
          </p>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-forest px-4 py-3 text-base font-semibold text-brand-cream hover:bg-brand-olive"
          style={{ minHeight: '44px' }}
        >
          Upload &amp; extract
        </button>
      </form>

      <section className="mt-6 rounded-xl border border-brand-teal/30 bg-brand-teal/5 p-4 text-sm text-brand-forest">
        <p className="font-semibold">What happens next</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-brand-slate">
          <li>Each file goes to private storage.</li>
          <li>Claude reads it and pulls out the structured fields.</li>
          <li>An expense row is created — even if the AI fails, so you can fix it.</li>
          <li>
            The auto-matcher hunts your bank_transactions for an exact-amount
            debit with a similar supplier name.
          </li>
          <li>
            Anything left unmatched lands on the reconciliation page flagged
            for review.
          </li>
        </ol>
      </section>
    </main>
  )
}
