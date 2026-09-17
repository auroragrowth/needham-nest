# Running Needham Nest through Claude Code

This is the file to point Claude at when you want something done to the café app or its
data. The left-hand column of each table is roughly what you'd type — plain English is
fine, you don't need the exact wording.

It's also Claude's instruction sheet: the **Ground rules** below are what Claude follows
when touching live data, so you don't have to repeat them every time.

---

## Ground rules (Claude follows these without being asked)

1. **Time is UK local** (Europe/London) — BST in summer, GMT in winter. Every time you
   say "8.30" it's written as 08:30 UK local, never UTC.
2. **"Today" comes from the database**, via `now() at time zone 'Europe/London'` — not
   from anything else, which can be wrong.
3. **Every manual data change gets an audit note.** Timesheet edits record the old value,
   the new one, and who asked, in the row's `notes`. So a corrected shift never looks like
   a clean clock-in later.
4. **Check payroll coverage before editing pay data.** If a payslip or payroll run already
   covers the period, Claude says so before changing hours rather than silently making a
   payslip wrong.
5. **Hours are never invented.** If a clock-out is missing, Claude uses the rota end, or
   asks — it doesn't guess a plausible time.
6. **Ambiguity gets one short question**, not a guess. ("Clock Taylor in 10–2" when she
   already has 07:33–16:30 logged → which did you mean?)
7. **Destructive things are confirmed first**: deleting rows, deactivating people,
   retroactive rate changes, anything that rewrites history.

---

## The map

| Thing | Where |
|---|---|
| Live app | https://needham-nest.vercel.app |
| Code | Next.js App Router, `src/app/...` + server actions in `src/lib/*/actions.ts` |
| Database | Supabase project `ocjdwtbvdqedpeheiwfc` (eu-central-1) |
| Deploy | Push to `main` → Vercel builds production automatically |
| Staff tablet | `/staff/*` — PIN login, clock, temps, checklist, stock, wastage |
| Manager | `/manager/*` — rota, timesheets, compliance, cash, staffing cost |
| Owner (you) | `/owner/*` — people, payslips, expenses, P&L, menu |
| Stock | `/stock` — one page for what we've got and where: Overall · Café · Kitchen · Storage. Everyone signed in counts, moves and adds stock; you and managers (May) edit items and locations. Old stock addresses redirect here |
| Checklist admin | `/admin/checklist` |

**How Claude reaches the data:** the Supabase connector, as you. The service-role key is
only set in Vercel, not in `.env.local`, so local scripts can't write to the live
database — all data work goes through the connector.

### Tables that matter day to day

| Table | Holds |
|---|---|
| `profiles` | Everyone. Role, PIN hash, rate, rota/payroll flags, contact + bank details |
| `time_logs` | Clocked shifts — `clock_in`, `clock_out`, breaks, rate snapshot, notes |
| `rota_shifts` | Planned shifts by date, published or draft |
| `cleaning_tasks` / `cleaning_log` | Checklist items (open/mid/close/daily) and today's ticks |
| `temperature_logs` / `appliances` | Fridge + freezer checks |
| `staff_feedback` | Anonymous staff feedback (only you can read it — RLS) |
| `payslips` / `payroll_runs` / `wage_payments` | Pay |
| `leave_requests` / `staff_availability` | Holiday, sickness, when people can work |
| `expenses` / `bank_transactions` / `takings` | Money in and out |

---

## People

| Say this | What happens |
|---|---|
| "Add Natasha Gadsden as staff and do the joining details" | Claude asks for rate, start date, rota/payroll setup and a PIN (offering PINs it has checked are free), then creates the profile with the standard tablet permissions. The rest — DOB, address, emergency contact, NI, bank — she fills in herself on first login |
| "Take Ewan, Freya and Tess off the rota" | Sets `on_rota = false`. They keep their accounts and can still clock in; they just stop appearing in the rota planner, shift picker and availability screen. Reversible |
| "Natasha's left" | Deactivates the account (`active = false`) so the PIN stops working. Claude confirms first, and keeps history intact for payroll |
| "Change Corey to £10.85 from next week" | Updates the profile rate. Past shifts keep the rate snapshotted on them, so old pay doesn't move |
| "Give May a new PIN" | Sets a fresh 4-digit PIN, checked unique, hashed the same way the app does |
| "What's Luke's address / emergency contact / phone?" | Reads it straight out |
| "Who hasn't finished onboarding?" | Lists anyone with no `onboarding_completed_at` — they're stuck at the form until they do |

New starters can't reach the tablet until they complete `/me/onboarding`, which is what
collects DOB (needed for the under-18 break rules), address, emergency contact, uniform
size, NI number, tax code and bank details.

## Timesheets and clocking

**This is the one area with no screen in the app.** There's no UI for editing a time log,
so forgotten clock-outs and wrong times can only be fixed here.

| Say this | What happens |
|---|---|
| "Clock May in at 8.30" | Creates today's shift at 08:30 with her rate snapshotted |
| "Clock Taylor out" | Closes her open shift — at her rota end time, or now, whichever you mean (Claude will say which it used) |
| "Tash clocked out at 16.34 today" | Corrects the clock-out and reports the new hours and pay |
| "Taylor worked 10–2 today, not all day" | Rewrites both ends of the shift |
| "Anyone still clocked in?" | Finds open shifts — worth asking most evenings, it's the commonest mess |
| "Fix last week's forgotten clock-outs" | Finds runaway shifts and offers the rota end for each |
| "What are my staffing costs today?" | Actual clocked hours net of breaks × the rate on each shift. Same basis as `/owner/staff-costs/week` |

A runaway clock-out is the classic one: someone forgets, and the shift runs on for days
until the next person taps clock-out. It inflates hours enormously (one was 52 hours), so
it's worth catching before payroll.

### Long-shift alerts

Runaways have gone all the way through payroll before (Taylor and Deacon, summer 2026), so
the app now tells you as soon as **any shift passes 10 hours** of clock time (breaks not
deducted — a genuine long day alerts too, once).

- **Your phone, via Pushover.** A cron (`/api/cron/long-shifts`) checks every 15 minutes
  and pushes one alert per shift, e.g. *"Taylor Cutting has been clocked in 10h 04m (since
  07:29). Rota ended 16:30."* Needs `PUSHOVER_APP_TOKEN` and `PUSHOVER_USER_KEY` in Vercel.
  To check the setup, call the cron with `?test=1` and the `CRON_SECRET` bearer token — it
  sends a test push and touches nothing.
- **Nesty.** Reads the `long-shifts` report, shows a Mac notification, and puts up a card
  offering to clock the person out at their rota end. Nothing changes until you click
  Apply; the action (`time-log-clock-out`) refuses if the shift changed since the card was
  made, and adds the usual audit note. No rota that day → Nesty asks you for the time.
- **Or just ask:** "Anyone over 10 hours?" runs the same report.

### Breaks

The rules (Working Time Regulations, also used for rota checks in `src/lib/rota/compliance.ts`):
**adults 20 minutes for a shift over 6 hours; under-18s 30 minutes over 4½ hours** (age from
date of birth). Shift length is clock time since clocking in. The app stores total break
minutes, so two short breaks count towards the one — strictly the law means one
uninterrupted break, so tell staff to take it in one go.

| Who | Sees what, when |
|---|---|
| The person clocking in | Straight after clock-in, *"You're on until 16:30 today, so you need a 20-minute break. Take it before 13:32 — the tablet will remind you from 12:32."* Uses their published rota end today; with no rota it gives the rule and the time |
| Anyone at the tablet | PIN screen strip from an hour before a break is due: *"1 person on shift is due a break soon — enter your PIN to check"*. Red once overdue. **Counts only** — `/login` is public on the internet, so no names there |
| The person on shift | After their PIN, a banner on the hub and clock page with a **Go on break** button. From 5h (under-18s 3h 30m), urgent past 6h (4h 30m) |
| Clocking out past the legal point without enough break | The clock-out asks *"Did you take your break today?"* — **Yes, forgot to tap** records the minutes they give (deducted, because taken); **No, didn't get one** records nothing, keeps them paid, notes it on the timesheet with their reason, and pushes to you |
| You | Pushover when an open shift passes the legal point without enough break (`/api/cron/breaks`, every 15 min, once per shift), and when someone clocks out saying they missed it. Nesty reads the `breaks-due` report |

**Never auto-deduct a break that wasn't taken.** That's working time unpaid — likely an
unlawful deduction and a minimum wage risk — and it doesn't fix the missed break. You *can*
require staff to take breaks and set when; for under-18s you must make sure they do.

| Say this | What happens |
|---|---|
| "Who's due a break?" | Runs `breaks-due` |
| "Who missed breaks last week?" | Timesheets with no or short breaks past the legal point, plus the reasons given at clock-out |

## Stock

**One page, one record:** `/stock`. Every quantity lives in `stock_placements` (item ×
location × count). Nothing else stores stock, and every change is logged in
`stock_location_moves`.

| Tab | Shows |
|---|---|
| **Overall** | Every item's total across all locations, by category. Tap an item to see where it is (tap a place to go straight there). Search at the top |
| **Café · Kitchen · Storage** | The area's fridges, freezers and shelves. Tap one for its **stock take** (a box per item, prefilled — change what's different, Save), **Move stock from here**, and **Add new stock here** (a delivery or shopping) |

- **Everyone signed in** can count, move and add stock (tablet: the purple 📦 Stock tile).
- **You and managers** also add/edit/remove items (name, category, what it's counted in) and
  add/remove locations. A location can't be removed while it still has stock in it.
- Removed on 17 Sep 2026 at Paul's request, to keep it simple: **par alerts, order pad,
  deliveries, suppliers, cost prices on screen**, and the old all-items stock count. The
  data columns (`par_level`, `cost_price`) and tables stay, for when stock links up with the
  till.

| Say this | What happens |
|---|---|
| "Here's the stock take for the storage freezer: 6 veg chilli, 4 choc cookies…" | Matched to items and entered as counts at that location, logged as your stock take; anything that doesn't match an item is asked about, not guessed |
| "Where's the oat milk?" | Totals and locations from `stock_placements` |
| "Add Pulled pork (bag) as a frozen item" | Creates the item |

### Waste

Staff log waste at `/staff/wastage` (tablet Waste tile, or the closing list's waste job).
**Every entry needs** the quantity, the **date and time it was wasted** (UK time,
prefilled with now, not in the future, at most 7 days back), a **reason** (Out of date,
Damaged, Dropped, Customer return, Spillage, Mistake, Other) and, in words, **why**. It's
stored in `stock_movements` (`wasted_at` = when wasted, `created_at` = when logged, `notes`
= why). Managers see it at `/manager/wastage`, and the compliance pack prints it.

**Waste check before clocking out (everyone, mandatory, no override):** nobody can clock
out until they've confirmed the waste from their own shift, at the top of the waste page:
"Confirm my waste is all logged", or "I wasted nothing this shift". It's stored per shift in
`waste_confirmations`. When the person confirming is the last one on shift, it also ticks the
closing list's waste job, which can't be ticked any other way. The waste page has a search
box, since there are about 150 items.

| Say this | What happens |
|---|---|
| "What was wasted this week and why?" | `stock_movements` with a reason, by `wasted_at`, with the why |
| "Who confirmed their waste today?" | `waste_confirmations` joined to `time_logs` |

## Rota

| Say this | What happens |
|---|---|
| "Put Tash on 7.30–4.30 Mon to Wed" | Creates the shifts |
| "Who's on this Saturday?" | Lists the day's shifts |
| "Publish next week's rota" | Flips the week to published so staff see it |
| "Does anyone have a shift clashing with booked leave?" | Cross-checks `rota_shifts` against `leave_requests` |

## Checklists

Tasks live in four buckets: **open**, **mid**, **close**, **daily**. You can edit them at
`/admin/checklist`, or just ask.

| Say this | What happens |
|---|---|
| "Add 'Descale the coffee machine' to the closing list" | New task in the close bucket |
| "Drop 'Put on music' from opening" | Deactivates it — history stays |
| "What didn't get ticked off last night?" | Lists closing tasks with no tick for that day |
| "Put the method on the Pepsi nozzle task" | Sets the task's **guidance** line |
| "Make the waste task link to the waste form" | Sets the task's **link** |

A task can carry two optional extras beyond its name and area:

- **Guidance** — a line shown underneath on the tablet, so the method travels with the job
  rather than living in someone's head. The Pepsi gun nozzle task uses it to say *never
  boiling water — it perishes the rubber seals*.
- **A link** to a page in the app, which turns the task into a card with a button. The
  closing waste task links to `/staff/wastage`, so recording waste is one tap from the
  list. Links must stay inside the app (a single leading `/`); the database rejects
  anything else.

Linked tasks are ticked separately from following the link. The exception is the waste
job: it ticks itself when today's waste is confirmed on the waste page (see Stock → Waste).

**The closing rule** (`src/lib/checklist/closing.ts`): the opening list starts with
**Clock in** and the closing list ends with **Sign out**, both derived from the real time
log so neither can be faked. Whoever is last on shift can't sign out until the closing
list is done — anyone finishing mid-day with colleagues still in clocks out freely. They
can override with a typed reason, which lands on their timesheet along with exactly which
jobs were left. **Waste is the one thing with no override, and it applies to everyone:**
each person confirms their own shift's waste (or that there was none) before clocking out.

To change what's enforced (e.g. to include the daily fridge temps), say so — it's a small
change in that file.

## Staff feedback

Anonymous, and RLS locks reading to your account only — Ben and May can't see it through
the app.

| Say this | What happens |
|---|---|
| "Read me the staff feedback" | Pulls the responses out and summarises them |
| "Any new feedback this week?" | Counts and reads the recent ones |

No identity is captured, deliberately. Nothing Claude does should add one.

## Money

| Say this | What happens |
|---|---|
| "Staffing cost for this week, by person" | Per-person, per-day grid with the week total |
| "Generate payslips for week ending 13 Sept" | Runs the payslip build for the period |
| "What did we spend with [supplier] last month?" | Reads expenses |
| "Is anything unreconciled in the bank feed?" | Checks `bank_transactions` against expenses |

Staffing cost = actual timesheets, not the planned rota. Salaried people are spread at
`annual_salary / 365` per day whether they clock or not; your own draw is excluded.

### Uploading receipts and invoices

Owner → Invoices → Upload (staff: Receipts) takes PDFs or photos, reads each with Claude,
and makes **one expense per supplier invoice number**:

- **A multi-page invoice photographed page by page** becomes one expense: the page with the
  total makes the row and the other pages are attached to it, in whatever order they arrive.
- **The same invoice uploaded twice** is skipped (same invoice number and total).
- **A receipt whose total couldn't be read** is still saved, with *"⚠ Total not read — check
  the receipt and enter the amount"* in its notes — never silently as £0.00.
- **Two receipts with the same invoice number but different totals** both stay, flagged
  *"⚠ … check both"*. Nothing guesses which is right.
- The upload notice counts all of it: *"Uploaded 21 receipts, 2 pages added to existing
  receipts, 1 duplicate skipped, 1 needs checking."*

Receipts with no invoice number (till slips) fall back to the old check: same vendor and
total within 3 days of an already-reconciled receipt. One limit: a page with no total
uploaded again in a later batch gets attached a second time — harmless to the money.

Makro trades under Booker: the "Booker-Invoice-…" PDFs are Makro Ipswich till invoices.

## Changing the app itself

| Say this | What happens |
|---|---|
| "Add X to the staff hub" | Claude writes it, builds to check it compiles, then commits and pushes |
| "Deploy" | Commit + push to `main`; Vercel builds production |
| "Why is [page] wrong?" | Reads the code and the data, then fixes the cause |

Worth knowing: this repo runs **Next.js 16**, which differs from what Claude may assume,
so it reads `node_modules/next/dist/docs/` before writing code (see `AGENTS.md`). There's
no Vercel CLI installed locally, so Claude can't watch the build — check the dashboard, or
ask it to poll the live URL.

---

## Constraints worth knowing

- **One open shift per person** — the database blocks a second clock-in, so nobody can be
  clocked in twice.
- **PINs must be unique** among active people, and are stored hashed. Claude can check
  whether a PIN is free without revealing anyone's.
- **Staff can't read the feedback table**, can't see other people's pay, and the tablet
  only exposes what their permissions allow.
- **Deactivating someone keeps their history** — never delete a person to remove them.
- **Past pay is stable**: each shift stores the rate at the time, so changing someone's
  rate today doesn't rewrite last month.

## Handy things to ask on a regular basis

- "Anyone still clocked in?" — end of day
- "What didn't get ticked off on the closing list?" — morning after
- "Staffing cost for yesterday / this week" — Mondays
- "Any fridge temps missed this week?" — before an EHO visit
- "Has everyone finished onboarding?" — after a new starter
- "Read me the new staff feedback"
