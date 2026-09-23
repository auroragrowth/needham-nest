# Nightly P&L sales sync (23 Sep 2026)

Agent 9, item 1 of "still to build". The P&L's sales must come from the till, and the till is
always right about sales. `pl_sales_daily` was backfilled by hand; this keeps it current, and
re-reads the last seven days so a late void or refund is picked up.

- [ ] Till: `GET /api/hub/report/pl-sales-daily?from=&to=` reads `v_pl_sales_daily` (pounds,
      London days, completed orders only) behind the existing read token. Read-only, like the
      rest of that endpoint
- [ ] Café app: `src/lib/finance/pl-sales.ts` reads that feed and upserts `pl_sales_daily` on
      (day, order_type, payment_type); a combination that has disappeared from a day (all of it
      voided) is deleted, so a stale row can't linger
- [ ] Café app: `/api/cron/pl-sales` behind `CRON_SECRET`, default last 7 days, `?from=&to=` to
      backfill; `vercel.json` cron at 01:30 UTC (the brief's `30 1 * * *`)
- [ ] Verify: call the till feed with the read token; run the sync against the live database and
      check every day in `v_pl_summary` still ties to the till, August £16,167.92 included

# Receipts to find (18 Sep 2026)

Paul: a by-supplier, by-location list of bank payments with no invoice, "like Amazon", to upload
against. Owner only. (First said May Richardson's transfers are wages; corrected: some are expense
claims. Wages are recognised by reference instead — see tasks/lessons.md.)

- [x] Migration: `bank_transactions.no_receipt_reason/by/at`; `bank_payee_rules` (payee → reason).
      The May Richardson seed row was deleted after Paul's correction
- [x] `/owner/receipts-to-find`: unmatched debits grouped by payee then location, biggest first,
      month filter. Left out: pay references (W15, Week 20, Wages, Pay advance, date ranges), payee
      rules, Monzo Transfers/Wages, ATM
- [x] Per payment: "Upload receipt" → `/invoices?for=<bank line>`, the upload is matched to that
      line whatever name the receipt carries (Amazon marketplace sellers); "No receipt needed"
- [x] Per payee: "Never needs a receipt"
- [x] Links from the owner dashboard and Invoice reconciliation
- [x] Verify: tsc, lint, clean build; SQL of the same rules: 262 of 364 unmatched payments, £17,749

# One upload for invoices and receipts (18 Sep 2026)

Paul: "why do we have invoices and receipts? Surely we need one source." One button, `/invoices`,
feeds both the till (costing, later) and the café's expenses (bank reconciliation, now).

## Till edge function `invoice-capture` (backwards compatible)
- [x] `upload` takes optional `state=extracting` when the caller reads it straight away
- [x] `GET a=waiting`: captured / failed / extracting older than 15 min, with a short signed URL
- [x] `POST a=claim {id}`: captured|failed|stale → extracting, only if nobody else has it
- [x] `POST a=result {id, state, invoice_no, invoice_date, total_gross, total_net, reviewed_by}`

## Café app
- [x] `src/lib/invoices/ingest.ts`: one file → café bucket → Claude read → expense (same dedupe as
      before: duplicate / extra page / fill-in / conflict), then settle the race when pages of one
      invoice land in parallel lanes. Extraction failure → no expense, till keeps it waiting
- [x] `/api/invoices/upload`: till (extracting) → ingest → till result (confirmed with totals, or failed)
- [x] Catch-up: `readWaitingInvoices()` — cron every 15 min, plus an owner button on reconciliation.
      Picks up the 5 already captured
- [x] Page: "Invoice or receipt", row says what was read, "Your recent uploads"
- [x] Retire: `/staff/receipts` and `/owner/invoices-upload` redirect to `/invoices`; "Snap a
      receipt" tile, ReceiptUploadForm and `uploadAndExtractInvoices` go
- [x] RUNBOOK

## Verify
- [x] Deploy the till function (Paul pasted it in the dashboard: version 5)
- [x] tsc, eslint on touched files, clean-worktree build
- [x] Edge function: bootstrap unchanged; waiting lists the 5 with working signed URLs; claim/result refuse bad input; wrong key refused
- [ ] After deploy: the 5 waiting invoices become expenses and the count drops

# Invoice capture at the back door (18 Sep 2026)

Brief: `~/Desktop/invoice-capture-brief.md`. Capture only — no extraction, no review, no costing.

## Code
- [x] `src/lib/invoice-capture/client.ts`: bootstrap + upload against the till's `invoice-capture` edge function, key in an `x-capture-key` header; `capturePendingCount()` returns null rather than throwing so a dead till can't take the dashboard down
- [x] `src/app/api/invoices/upload/route.ts`: the browser's only way in. `captured_by` comes from the session, not the request body
- [x] `src/app/invoices/`: supplier picker, drag-drop, camera, three uploads at a time, failures left in the list for the next press of Upload
- [x] Waiting count on the page footer and on the owner dashboard's Finance grid
- [x] Tile on the staff hub, or the page is unreachable from inside the app
- [x] It is *the* upload button: big "Upload invoices" button beside Goods In on the tablet; the owner's "Bulk invoices" card and the receipts page's bulk link now go to `/invoices`. `/owner/invoices-upload` still exists, reached only from Invoice reconciliation's "+ Upload more"

## Config
- [x] `TILL_CAPTURE_KEY` in `.env.local.example` — its own variable, not `TILL_READ_TOKEN`, so it can be rotated without stopping the stock sync
- [ ] Set `TILL_CAPTURE_KEY` in Vercel (and rotate `app_settings.invoice_capture_key` first — see Review)

## Docs
- [x] `docs/RUNBOOK.md` — row in the map

## Verify
- [x] `npx tsc --noEmit`, eslint on the new files, `npm run build` — clean; the one `owner/page.tsx` lint error is pre-existing (`Date.now` at line 18)
- [x] Whole chain against a local stub of the edge function: key absent from the served HTML, `captured_by` arrives as the session name, supplier optional, empty file 400, bad key surfaces the till's message at both the page and the route
- [x] Confirm the live function accepts the header form (18 Sep: 7 suppliers, 0 pending)
- [ ] Owner dashboard card — can't render locally (no service-role key in `.env.local`, by design), so it is covered by types and build only

## Review

Three things worth recording:

- **The key in the standalone page is spent.** `614487663ffc` sits in plain text in
  `invoice-capture.html`, so it is in the history of every browser that ever opened that page.
  Rotate `app_settings.invoice_capture_key` and set the new value as `TILL_CAPTURE_KEY`.
- **A staff session lasts 30 minutes, a batch at the back door can outlive it.** The proxy then
  redirects to `/login`, which `fetch` follows and which answers 200 with a page — which would
  have been counted as a saved invoice. The client checks `response.redirected` and says so.
- **Brand as usual meant the app's tokens**, not the brief's hexes and Playfair/Lora. The gold is
  identical; forest and cream differ by a hair. A page that reads as part of the staff app beat a
  page that matches a standalone one.

Deliberately left alone: `/owner/invoices-upload` still takes supplier invoices into the café's
own Supabase with Claude extraction and bank reconciliation. Two pipelines for the same paperwork
now exist; which one wins is a decision for the finance agent, not this page. Vercel caps a
function request body at 4.5 MB and iPhone photos run 3–6 MB, so the occasional full-res shot will
bounce. Fixed: photos over 2.5 MB are shrunk in the browser to 2400px JPEG before sending.
Failure reasons now show on the row, not only as a hover title a tablet can't reach.

# One simple stock page (17 Sep 2026)

Plan: `~/.claude/plans/prancy-singing-quasar.md`

- [x] `/stock` page: Overall (totals, where it is, search, managers add/edit items) · Café · Kitchen · Storage (locations → stock take, move, add stock; managers manage locations)
- [x] `saveLocationCounts` + pure `parseCounts` (10 tests pass); back-address check on move/add/adjust; location can't be removed while it holds stock
- [x] `parseItem` only updates fields sent, so edits never blank par levels / cost prices
- [x] Removed: par alerts, order pad, deliveries, suppliers, item pages, overview, location setup, old stock count (+ actions, below-par helper); old addresses redirect
- [x] One Stock entry on the tablet hub, manager home and owner dashboard
- [x] Paul's first stock take entered for Storage fridge / freezer / dry room (25 items); the rest waiting on his answers
- [ ] build, commit, push, deployment READY, redirects on live
- [ ] Paul or May tries the page

# Stock control for May (17 Sep 2026)

Plan: `~/.claude/plans/prancy-singing-quasar.md`

- [x] `requireStockControl()` (owner, manager, staff with manager_access) + `stock/(control)` layout
- [x] Moved items, overview, alerts, locations setup, suppliers, deliveries, order pad from /owner to /stock (git mv); in-page owner checks swapped for the gate; role-aware back links
- [x] Actions gated with `requireStockControl`, redirects/revalidates repathed
- [x] Owner dashboard links repathed; manager home gains the Stock cards + below-par banner (shared `belowParItems()`)
- [x] Old /owner addresses redirect (next.config.ts)
- [ ] build, commit, push, deployment READY, old addresses 307 on live
- [ ] May signs in and tries it

# Makro invoice upload fix (17 Sep 2026)

Plan: `~/.claude/plans/prancy-singing-quasar.md` (the parked 16 Sep plan)

- [x] `src/lib/invoices/dedupe.ts`: one expense per supplier invoice number (duplicate / attach page / fill in / insert, flagged)
- [x] `uploadAndExtractInvoices`: parallel store + read, then sequential decisions so pages in one batch see each other; notice counts
- [x] Extraction prompt: totals are on the last page; a page with no total returns null
- [x] 13 decision tests pass, including a replay of the real #0128281 photo uploads
- [x] Live cleanup: 14 Makro rows → 5 (£1,363.58), page photos attached, #0546067 corrected, bank match kept
- [ ] tsc / lint / build, commit, push, deployment READY
- [ ] Paul uploads the 21 PDFs from ~/Downloads/Makro invoices to upload/
- [ ] Check every new row against the parsed PDF figures; correct misreads with audit notes

# Break reminders (17 Sep 2026)

Plan: `~/.claude/plans/prancy-singing-quasar.md`

- [x] `src/lib/breaks/status.ts` (one rule) + `on-shift.ts`; clock page uses the shared under-18 check
- [x] PIN screen strip (counts only, `/api/breaks/due-count`, public) and logged-in `BreakBanner` on hub + clock
- [x] `clockOut` asks when past the legal point without enough break; taken → recorded, missed → no deduction, note, push
- [x] Migration `break_alerts` (`time_logs.break_alerted_at`, `nesty_breaks_due()`), cron `/api/cron/breaks`, Nesty `breaks-due`
- [x] 18 rule tests pass (thresholds, under-18, part breaks, mid-break clock-out, 18th birthday)
- [ ] tsc / lint / build, commit, push, deployment READY, public count endpoint checked
- [ ] Paul or May: try it on the tablet (I can't enter a PIN)
- [ ] Nesty side to the Desktop avatar session

# Long-shift alerts (17 Sep 2026)

Plan: `~/.claude/plans/prancy-singing-quasar.md`

- [x] Migration `long_shift_alerts`: `time_logs.long_shift_alerted_at`, `nesty_long_shifts()`, missing-clock-outs 12h → 10h
- [x] `src/lib/alerts/long-shifts.ts` + `/api/cron/long-shifts` (every 15 min, `?test=1`), Pushover via fetch
- [x] Nesty report `long-shifts` and action `time-log-clock-out`
- [x] SQL recorded in `supabase/`; runbook section
- [x] Time helpers and alert messages tested (BST, GMT, both clock-change days)
- [ ] tsc / lint / build, commit, push, deployment READY
- [ ] Paul: Pushover app + `PUSHOVER_APP_TOKEN` / `PUSHOVER_USER_KEY` in Vercel, then `?test=1`
- [ ] Nesty side handed to the Desktop avatar session (hub-desktop)

---

# Closing list: waste recording + Pepsi post-mix pump

Plan: `~/.claude/plans/prancy-singing-quasar.md`

## Schema
- [x] Migration `add_cleaning_task_detail_and_link` — `detail`, `link_href`, `link_label` on `cleaning_tasks`, with an internal-only check constraint on `link_href`

## Code
- [x] `src/lib/checklist/actions.ts` — parse + validate the three fields, include in create/update
- [x] `src/app/admin/checklist/new/page.tsx` — three new form fields
- [x] `src/app/admin/checklist/[id]/page.tsx` — select + three new form fields
- [x] `src/app/staff/checklist/page.tsx` — render `detail`; new `TaskCard` with a separate link + tick for linked tasks

## Data (live DB)
- [x] Updated the existing waste task (close, 50) — renamed to "Record any waste on the system", reason guidance, links to `/staff/wastage`
- [x] Inserted "Wash the post-mix drip tray" (close, 32, Front of House)
- [x] Inserted "Take the nozzle off the Pepsi gun and soak it overnight" (close, 34, Front of House)

## Docs
- [x] `docs/RUNBOOK.md` — guidance and link documented in the Checklists section

## Verify
- [x] `npx tsc --noEmit`, `npm run lint`, `npm run build` — build passes; the 17 lint problems are all pre-existing, none in the files touched here
- [x] Constraint rejects `https://evil.example` and `//evil.example`; close list reads back in the right order
- [ ] Push to main, poll Vercel, check live `/staff/checklist`

## Review

The gap was that `cleaning_tasks` could only hold a name and an area, so a task could neither
explain itself nor send anyone anywhere. Three nullable columns closed it, and both requests
then became data rather than code.

Two decisions worth recording:

- **Linked tasks don't auto-tick.** Recording wastage doesn't tick the waste task, because on
  a night with nothing wasted staff must still be able to confirm they checked.
- **Links are constrained to internal paths** in both the server action and the database. An
  owner or manager account should never be able to point the staff tablet at an external site.

Deliberately left alone: `detail` is not shown on `/manager/compliance` or in the EHO print
pack at `/owner/compliance/pack`, and the pre-existing `completeTask()` staleness (it doesn't
revalidate `/manager` or the compliance pack, both of which read `cleaning_log`).
