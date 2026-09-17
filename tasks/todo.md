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
