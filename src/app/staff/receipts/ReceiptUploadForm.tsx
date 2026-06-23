'use client'

import { useRef, useState } from 'react'
import { uploadAndExtractInvoices } from '@/lib/invoices/actions'

/**
 * Client wrapper around the upload form that auto-submits as soon as
 * the staff member picks a photo. Previously the two-step (pick then
 * tap Upload) flow was confusing on iPad — staff would take a photo,
 * the camera would close, and they'd assume the upload was done without
 * tapping the second button. Now the act of picking a file is the
 * submit; the page shows a clear 'uploading…' state until the action
 * completes.
 */
export function ReceiptUploadForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [uploading, setUploading] = useState(false)
  const [filename, setFilename] = useState<string | null>(null)

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    setUploading(true)
    // Submit the form natively so it goes through the server action.
    formRef.current?.requestSubmit()
  }

  return (
    <form
      ref={formRef}
      action={uploadAndExtractInvoices}
      encType="multipart/form-data"
      className="mt-6 rounded-2xl border-2 border-brand-amber bg-brand-amber/10 p-6 text-center"
    >
      <input
        id="files"
        name="files"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp"
        capture="environment"
        required
        onChange={onChange}
        disabled={uploading}
        className="hidden"
      />
      <label
        htmlFor="files"
        aria-disabled={uploading}
        className={`block ${uploading ? 'cursor-wait opacity-60' : 'cursor-pointer'} text-brand-forest`}
        style={{ touchAction: 'manipulation' }}
      >
        <span className="text-5xl" aria-hidden>
          {uploading ? '⏳' : '📸'}
        </span>
        <span className="mt-2 block text-lg font-semibold">
          {uploading
            ? 'Uploading and reading the receipt…'
            : 'Tap to snap or pick a receipt'}
        </span>
        <span className="mt-1 block text-xs text-brand-slate">
          {uploading
            ? filename
              ? `Sending "${filename}" — don't close this tab.`
              : 'Hang on, working on it.'
            : 'Camera opens straight away on iPad / iPhone.'}
        </span>
      </label>
    </form>
  )
}
