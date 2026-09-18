import { redirect } from 'next/navigation'

// Bulk upload is now /invoices: many files at once, read into the books as they
// arrive. Kept so old bookmarks still land somewhere useful.
export default function InvoicesUploadPage() {
  redirect('/invoices')
}
