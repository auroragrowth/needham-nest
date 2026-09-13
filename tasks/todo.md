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
