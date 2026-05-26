import Link from 'next/link'
import { importMonzoCsv } from '@/lib/bank/actions'

export default async function UploadCsvPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner/bank"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Bank
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Upload Monzo CSV
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Export from Monzo Business → Statements → CSV, then drop the file
        here.
      </p>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <form
        action={importMonzoCsv}
        encType="multipart/form-data"
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div>
          <label
            htmlFor="csv"
            className="block text-sm font-medium text-brand-forest"
          >
            CSV file
          </label>
          <input
            id="csv"
            name="csv"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-1 block w-full text-sm text-brand-forest file:mr-3 file:rounded-md file:border-0 file:bg-brand-forest file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-cream hover:file:bg-brand-olive"
          />
        </div>
        <p className="text-xs text-brand-slate">
          Re-uploading the same CSV is safe — duplicates are ignored.
          Transactions auto-match to existing expenses (for money out) or
          takings (for money in) by exact amount within 2 days.
        </p>
        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Import
        </button>
      </form>
    </main>
  )
}
