import { redirect } from 'next/navigation'

// Receipts and invoices now come in one way: the Invoice button. Kept so old
// bookmarks and the home-screen shortcut still land somewhere useful.
export default function StaffReceiptsPage() {
  redirect('/invoices')
}
