'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Supplier = { id: string; name: string }

type QueueState = 'waiting' | 'sending' | 'done' | 'failed'

type QueueItem = {
  key: number
  file: File
  supplierId: string | null
  supplierName: string
  state: QueueState
  detail?: string
}

/** Three at a time: enough to keep a phone busy, gentle on a back-door signal. */
const LANES = 3

const STATUS_TEXT: Record<QueueState, string> = {
  waiting: 'waiting',
  sending: 'sending and reading…',
  done: 'saved',
  failed: 'failed — press Upload to try again',
}

type ReadResult = {
  kind: 'new' | 'page' | 'duplicate'
  vendor: string | null
  amount: number | null
  warning: string | null
}

/** What the books now hold for a saved file, in a few words. */
function describeRead(read: ReadResult | null | undefined): string {
  if (!read) return 'Saved — it will be read in the next few minutes'
  const who = read.vendor ?? 'Unknown supplier'
  const money = read.amount ? ` £${read.amount.toFixed(2)}` : ''
  if (read.kind === 'duplicate') return `Already in the books — ${who}${money}`
  if (read.kind === 'page') return `Added as a page of ${who}${money}`
  return `${who}${money}${read.warning ? ' — total needs checking' : ''}`
}

let nextKey = 1

/**
 * Vercel refuses a function request body over 4.5 MB, and a full-resolution
 * phone photo runs 3–6 MB. Shrink big photos to a size that still reads
 * cleanly before they leave the phone. PDFs and anything the browser cannot
 * decode go as they are.
 */
const SHRINK_OVER = 2.5 * 1024 * 1024
const MAX_EDGE = 2400

async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= SHRINK_OVER) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export function Capture({
  suppliers,
  pending,
}: {
  suppliers: Supplier[]
  pending: number
}) {
  const router = useRouter()

  // null with `chosen` true is "Someone else" — an invoice with no supplier yet.
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [chosen, setChosen] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null)
  const [over, setOver] = useState(false)

  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)

  const add = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0 || !chosen) return
      const added: QueueItem[] = Array.from(files).map((file) => ({
        key: nextKey++,
        file,
        supplierId: supplier?.id ?? null,
        supplierName: supplier?.name ?? 'Someone else',
        state: 'waiting',
      }))
      setQueue((q) => [...q, ...added])
      setNote(null)
    },
    [chosen, supplier],
  )

  const left = queue.filter((q) => q.state === 'waiting' || q.state === 'failed').length

  async function upload() {
    if (busy) return
    setBusy(true)
    setNote(null)

    // Snapshot what needs sending, then walk it with a few lanes in parallel.
    // Failures stay in the list so pressing Upload again retries just those.
    const todo = queue.filter((q) => q.state === 'waiting' || q.state === 'failed')
    const mark = (key: number, state: QueueState, detail?: string) =>
      setQueue((q) => q.map((item) => (item.key === key ? { ...item, state, detail } : item)))

    let cursor = 0
    let saved = 0
    let failed = 0
    let signedOut = false

    async function lane() {
      while (cursor < todo.length) {
        const item = todo[cursor++]
        mark(item.key, 'sending')

        const body = new FormData()
        body.append('file', await shrink(item.file))
        if (item.supplierId) {
          body.append('supplier_id', item.supplierId)
          body.append('supplier_name', item.supplierName)
        }

        try {
          const response = await fetch('/api/invoices/upload', { method: 'POST', body })

          // A staff session lasts 30 minutes, so a batch at the back door can
          // outlive it. The proxy then redirects to /login, which fetch follows
          // and which answers 200 with a page — not a saved invoice.
          if (response.redirected && new URL(response.url).pathname.startsWith('/login')) {
            signedOut = true
            failed++
            mark(item.key, 'failed', 'signed out')
            continue
          }

          const data = (await response.json().catch(() => null)) as
            | { error?: string; read?: ReadResult | null }
            | null
          if (!response.ok || !data || data.error) {
            failed++
            mark(item.key, 'failed', data?.error)
          } else {
            saved++
            mark(item.key, 'done', describeRead(data.read))
          }
        } catch {
          failed++
          mark(item.key, 'failed', 'no connection')
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(LANES, todo.length) }, lane))

    setBusy(false)
    setNote({
      text: signedOut
        ? `${saved} saved. You were signed out — sign in again and press Upload to send the rest.`
        : `${saved} saved${failed ? `, ${failed} failed` : ''}`,
      bad: failed > 0,
    })
    // Refreshes the server component, so the waiting count below is the till's.
    router.refresh()
  }

  return (
    <>
      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Who is it from?
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[...suppliers, { id: '', name: 'Someone else' }].map((s) => {
            const isOn = chosen && (s.id ? supplier?.id === s.id : supplier === null)
            return (
              <button
                key={s.id || 'someone-else'}
                type="button"
                aria-pressed={isOn}
                onClick={() => {
                  setSupplier(s.id ? { id: s.id, name: s.name } : null)
                  setChosen(true)
                }}
                className={`rounded-xl border p-4 text-left text-sm transition-colors ${
                  isOn
                    ? 'border-brand-amber bg-brand-amber text-brand-forest font-semibold'
                    : 'border-brand-sage/40 bg-white text-brand-forest hover:border-brand-teal/60 hover:bg-brand-teal/5'
                }`}
                style={{ minHeight: '44px' }}
              >
                {s.name}
              </button>
            )
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Add the invoice or receipt
        </h2>

        <label
          onDragEnter={(e) => {
            e.preventDefault()
            if (chosen) setOver(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (chosen) setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            if (chosen) add(e.dataTransfer.files)
          }}
          className={`mt-3 block rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            chosen
              ? over
                ? 'cursor-pointer border-solid border-brand-amber bg-brand-amber/20'
                : 'cursor-pointer border-brand-amber/60 bg-brand-amber/5 hover:bg-brand-amber/10'
              : 'pointer-events-none border-brand-sage/40 bg-white opacity-50'
          }`}
        >
          <span className="block text-lg font-semibold text-brand-forest">
            Choose files
          </span>
          <span className="mt-2 block text-sm text-brand-slate">
            {chosen
              ? 'Photos or PDFs, as many as you like — or drag them in'
              : 'Pick a supplier first'}
          </span>
          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              add(e.target.files)
              e.target.value = ''
            }}
          />
        </label>

        <div className="mt-3 flex gap-3">
          <button
            type="button"
            disabled={!chosen}
            onClick={() => cameraInput.current?.click()}
            className="flex-1 rounded-lg border border-brand-amber px-4 py-3 text-base font-medium text-brand-forest transition-colors hover:bg-brand-amber/10 disabled:opacity-40 disabled:hover:bg-transparent"
            style={{ minHeight: '44px' }}
          >
            📷 Use the camera
          </button>
          <button
            type="button"
            disabled={busy || left === 0}
            onClick={upload}
            className="flex-1 rounded-lg bg-brand-forest px-4 py-3 text-base font-semibold text-brand-cream transition-colors hover:bg-brand-olive disabled:opacity-40 disabled:hover:bg-brand-forest"
            style={{ minHeight: '44px' }}
          >
            {busy ? 'Uploading…' : left > 0 ? `Upload ${left}` : 'Upload'}
          </button>
        </div>

        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
      </section>

      {queue.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Sent
          </h2>
          <ul className="mt-3 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
            {queue.map((item) => (
              <li
                key={item.key}
                className="flex items-baseline gap-3 border-b border-brand-sage/30 px-4 py-3 text-sm last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-brand-forest">{item.file.name}</span>
                  {item.detail && item.state !== 'sending' && (
                    <span
                      className={`block text-xs ${
                        item.state === 'failed' ? 'text-brand-amber' : 'text-brand-teal-deep'
                      }`}
                    >
                      {item.detail}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-brand-slate">
                  {item.supplierName}
                </span>
                <span
                  className={`shrink-0 text-xs ${
                    item.state === 'done'
                      ? 'font-semibold text-brand-teal-deep'
                      : item.state === 'failed'
                        ? 'font-semibold text-brand-amber'
                        : 'text-brand-slate'
                  }`}
                  title={item.detail}
                >
                  {STATUS_TEXT[item.state]}
                </span>
              </li>
            ))}
          </ul>
          {note && (
            <p
              className={`mt-3 text-sm ${note.bad ? 'text-brand-amber' : 'text-brand-teal-deep'}`}
            >
              {note.text}
            </p>
          )}
        </section>
      )}

      <p className="mt-8 border-t border-brand-sage/40 pt-4 text-sm text-brand-slate">
        {pending === 0
          ? 'Everything uploaded has been read into the books'
          : `${pending} waiting to be read into the books`}
      </p>
    </>
  )
}
