# Needham Nest Café — Management System v1 Brief

A scoped v1 brief for the operations and back-office platform for Needham Nest Café.

> **Status:** Scope locked 2026-05-20. Supersedes the unscoped CAFE_BRIEF.md.
> **Codebase:** Fresh build. Aurora Events Hire's bookkeeping app ([SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)) is referenced for architectural patterns only — no shared code, no fork, separate everything.
> **Estimated build:** 4.5–6.5 months solo.

---

## 1. Decisions register

The open questions are resolved as follows. All downstream scope flows from this table.

| # | Question | Decision | Architectural impact |
|---|---|---|---|
| 1 | Business structure | Limited company (Needham Nest Café Ltd, separate entity from Aurora) | Build DL, CT estimate, Companies House details from scratch |
| 2 | VAT registration | Below £90k threshold; not registering | No VAT UI in v1. Schema carries `vat_enabled` flag for future switch-on. |
| 3 | Multi-site ambitions | Single site, no expansion plans | No `site_id` anywhere; simpler RLS |
| 4 | Staff at peak | 5–8 | Simple weekly rota; no shift-swap marketplace |
| 5 | Menu complexity | Coffee-led with small fresh-food offer | Recipes for drinks; food mostly sold as-is |
| 6 | Wifi reliability | Solid | No offline-first / service worker |
| 7 | Till provider | SumUp | Build SumUp API ingestion |
| 8 | SumUp setup | SumUp POS app (item-level sales) | Recipe-driven stock depletion works end-to-end |
| 9 | POS hardware | iPad already bought | iPad runs SumUp POS; second tablet (~£100–150) at pass for our app |
| 10 | Business banking | Monzo Business | Build Monzo CSV parser fresh (same approach as Aurora's) |
| 11 | Customer-facing scope | Operations + back office only | Drop loyalty / online ordering / reservations / marketing in v1 |
| 12 | Existing software | Fresh start | No migration / data import work |
| 13 | Codebase lineage | Fresh build, Aurora as architectural reference only | New repo, new Supabase project, new Vercel project. No upstream coupling. |

---

## 2. Vision

A single platform that runs Needham Nest end-to-end at the operational and financial level:

- **Owner** sees the financial picture in real time — P&L, cash flow, tax pot, GP margins.
- **Manager** runs daily operations — rotas, ordering, stock, staff hours, compliance.
- **Staff** clock in/out, log temps, count stock, record wastage — on the pass tablet, with minimal friction.
- **EHO inspector** can be shown a printable compliance pack at a moment's notice.

The system replaces or reduces the need for: paper temperature charts, spreadsheet rotas, paper allergen sheets, paper stock counts, and a separate bookkeeping package.

What it does **not** replace: HMRC payroll (PAYE/NI/RTI) and pension auto-enrolment — pair with BrightPay or Xero Payroll for those.

---

## 3. Devices & topology

- **iPad on counter** — runs the SumUp POS app for orders and payments. Not our app.
- **Pass tablet (Android, ~£100–150)** — runs our app's Staff layout: clock in/out, temperature log, stock count, wastage, daily checklist. Wall-mounted at the kitchen pass.
- **Owner / manager laptop or desktop** — full back-office in any modern browser.
- All devices on solid on-site wifi; server-rendered Next.js, no offline-first complexity.

---

## 4. User personas & access levels

### 4.1 Owner (1 user)
Sees everything: financials, gross wages, P&L, GP, stock costs, tax pot.
Sets prices, hourly rates, supplier accounts. Pays staff (externally via payroll), sees corporation tax position.

### 4.2 Manager (1–2 users)
Sees operational view: today's sales, labour cost %, stock alerts, compliance gaps.
Can edit menu items, place orders, approve timesheets, manage rota.
**Cannot** see: corporation tax, director's loan, company-level settings.

### 4.3 Staff (up to ~8 users)
Mobile-first restricted layout on the pass tablet. Big tap targets, minimal text entry.
Sees: clock in/out, temperature log, stock count, wastage, daily checklist.
**Cannot** see: cost prices, P&L, anyone else's hours, financial data.

### 4.4 EHO inspector (no login)
One-click "Generate compliance pack" → PDF with temperature logs (date range), cleaning completion, training certs not expired, pest control visits, allergen sheet, current FHRS rating.

---

## 5. Feature inventory (v1)

### 5.1 Sales (via SumUp POS)
- Nightly ingestion of SumUp item-level transactions + payouts via SumUp API
- Sales feed creates takings entries and triggers recipe-driven stock depletion
- Payment mix tracking (cash / card)
- End-of-day cash count vs expected from till

### 5.2 Menu & recipes
- Menu items: name, category, sell price, cost price, GP%, allergens, photo, description, active flag
- Modifiers: extra shot, oat milk, takeaway, etc., each with price + cost
- Recipes: each drink linked to ingredient stock items with quantities
- Allergen matrix per menu item — Natasha's Law compliance for PPDS items (wrapped sandwiches, traybakes, etc.)
- Printable allergen sheet generator (PDF per shift)

### 5.3 Stock & ordering
- Stock items: SKU, supplier, unit, cost price, par level, reorder threshold, allergens
- Stock counts: staff-facing screen, items pre-filled by category, variance to theoretical
- Stock movements: deliveries in, sales out (auto from POS via recipes), wastage out
- Suppliers: name, contact, delivery days, account number, minimum order, payment terms
- Order pads: auto-generated from below-par items, sent to supplier as PDF/email
- Delivery / GRN: confirm what arrived vs ordered, attach invoice PDF, auto-creates expense + payee
- Wastage log: staff record with reason (out of date / damaged / dropped / customer return / spillage / mistake); cost reported to manager

### 5.4 Staff management
- Staff profiles: name, role, hourly rate, contact, emergency contact, right-to-work ref, start date, active flag
- Time logs: mobile clock in/out screen, big-button design, optional photo at clock-in
- Rota: simple weekly grid; manager fills slots; staff see their schedule; conflicts flagged
- Holiday tracking: entitlement, requests, remaining balance
- Sick leave log
- Training records: Level 2 Food Hygiene, allergen awareness, first aid, fire safety; expiry dates with renewal alerts
- Wages (gross): generated from time logs at end of week → creates an expense entry. **Does not replace payroll software.**
- Tips / tronc: pool tips per shift, distribute by hours worked, surface as wage top-up

### 5.5 Compliance / EHO
- Fridge / freezer / hot-hold temperature logs — appliances list with target ranges, mobile quick-log, out-of-range entries require a corrective-action note
- Cleaning schedule / daily checklist — pre-defined tasks per shift (open / mid / close), staff tick off, manager sees completion %
- HACCP plan documents — stored doc + critical control points linked to temperature logs as evidence
- Pest control log — visit dates, inspector, findings, actions
- Food hygiene rating — current FHRS score, last inspection date, last report
- Supplier traceability — for any food item, trace back to delivery / supplier / batch
- Risk assessments — fire, slips/trips, manual handling, COSHH — stored docs with review dates
- Accident book — digital log of incidents; RIDDOR-reportable flagged for HSE notification

### 5.6 Financial / bookkeeping (built cafe-first)
- Expenses with cafe-specific categories: food_purchases / drink_purchases / cleaning / rent_utilities / repairs_maintenance / insurance / staff / equipment / marketing / other
- Takings by source (cash, card; "online" source unused in v1)
- End-of-day cash up — counted notes & coins vs expected from till
- Petty cash management — float, top-ups, withdrawals
- Bank reconciliation — Monzo CSV upload (built fresh; same parser approach as Aurora)
- Invoices — for occasional B2B catering / functions
- Director's loan (in / out tracking, outstanding balance)
- Corporation tax estimate (configurable rate, applied to net profit per period)
- Tax pot — money set aside for CT
- "Export all" CSV — full per-table backup, every table downloadable

### 5.7 Reporting
- Daily sales report — total, by category, by hour, payment mix
- Labour cost report — wages as % of sales (target 25–35%)
- Food cost report — COGS as % of sales (target 25–35%)
- GP report by category and item
- Wastage report — value of waste per period, by reason
- Compliance report — temperature compliance %, missed checks, training expiry
- P&L by month / quarter / year
- Cash flow — main account + tax pot
- Hour-by-hour sales heatmap (data from SumUp item-level feed)
- Menu engineering report — popularity vs GP% (stars / dogs / puzzles / plough-horses)

---

## 6. Compliance & legal

Cafe owner / accountant should validate with local authorities and a solicitor.

### 6.1 Food safety
- FHRS score 0–5, displayed publicly
- HACCP plan documented
- Temperatures: fridges ≤ 5°C, freezers ≤ -18°C, hot holding ≥ 63°C. Records ≥ 1 month, ideally longer.
- Natasha's Law for PPDS items — full ingredient label with allergens emphasised
- Food traceability — one step forward, one step back
- Staff Level 2 Food Hygiene minimum, refresh every 3 years recommended

### 6.2 Employment
- Right-to-work checks; records kept 2 years post-employment
- Working Time Regulations — 48 hr/week max with opt-out, breaks, holiday entitlement
- National Minimum / Living Wage by age bracket
- PAYE / NI / RTI — **out of scope for this app**; use BrightPay / Xero Payroll
- Pensions auto-enrolment — **out of scope for this app**; use Smart / NEST / Aviva

### 6.3 Health & safety
- Risk assessments — fire, manual handling, slips/trips, COSHH
- Accident book; RIDDOR-reportable to HSE
- Fire safety order written assessment + evacuation plan
- First aider + kit + accident book

### 6.4 Financial
- Companies House annual confirmation + accounts
- HMRC corporation tax (CT600)
- **VAT not currently applicable.** Schema is flagged for future enable; revisit if approaching £90k turnover.

### 6.5 Premises
- Trade waste contract (domestic bins not allowed for commercial waste)
- Public liability insurance £5m+
- Employer's liability insurance £5m+ (mandatory)

---

## 7. Tech stack

- **Next.js 15** App Router (server components + server actions)
- **TypeScript**
- **Supabase** (Postgres + Auth + Storage + RLS)
- **Tailwind CSS**
- **Lucide React** icons
- **Vercel** hosting
- **SumUp API** — pull till sales nightly (item-level transactions + payouts)
- **Resend** — transactional email (supplier orders, invoice sends)
- **PDFKit / React-PDF** — compliance pack, supplier order pads, allergen sheets
- **Recharts** — sales / GP / labour dashboards

Patterns lifted from Aurora as reference (not code): server-first Next.js with minimal `use client`, role-aware RLS, period picker component, "Export all" CSV pattern, Monzo CSV parser approach.

---

## 8. Data model (full schema, designed cafe-first)

### Enums

```sql
create type user_role        as enum ('owner', 'manager', 'staff');
create type expense_category as enum (
  'food_purchases', 'drink_purchases', 'cleaning', 'rent_utilities',
  'repairs_maintenance', 'insurance', 'staff', 'equipment', 'marketing', 'other'
);
create type takings_source   as enum ('cash', 'card', 'sumup', 'bank_transfer', 'other');
create type invoice_status   as enum ('draft', 'sent', 'paid', 'overdue');
create type loan_direction   as enum ('in', 'out');
create type pot_kind         as enum ('tax');  -- VAT and mileage pots not in v1
```

### Auth / people

```sql
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role user_role not null default 'staff',
  hourly_rate numeric(8,2),
  phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  right_to_work_ref text,
  start_date date,
  active boolean default true
);
```

### Contacts

```sql
create table customers ( id uuid pk, name text, email text, address text, city text, postcode text, notes text );
create table payees    ( id uuid pk, name text, category expense_category, notes text );
create table suppliers ( id uuid pk, name text, contact_name text, email text, phone text, delivery_days text[], account_number text, payment_terms text, minimum_order numeric );
```

### Financial core

```sql
create table expenses        ( id uuid pk, date date, category expense_category, vendor text, amount numeric, payment_method text, reference text, receipt_path text, vat_rate numeric );
create table takings         ( id uuid pk, date date, source takings_source, amount numeric, description text, reference text );
create table invoices        ( id uuid pk, invoice_number text, date date, due_date date, customer_snapshot jsonb, items jsonb, vat_rate numeric, status invoice_status );
create table director_loans  ( id uuid pk, date date, direction loan_direction, amount numeric, description text, reference text );
create table pot_allocations ( id uuid pk, pot pot_kind, date date, amount numeric, note text );
create table settings        ( user_id uuid pk, company_name text, company_number text, company_address text, bank_name text, bank_account text, vat_enabled boolean default false, vat_number text, ct_rate numeric default 19, invoice_prefix text default 'INV-', invoice_next_number int default 1 );
```

### Time, wages, tips

```sql
create table time_logs     ( id uuid pk, user_id uuid, clock_in tstz, clock_out tstz, hourly_rate numeric, notes text );
create table wage_payments ( id uuid pk, staff_user_id uuid, period_start date, period_end date, hours numeric, gross numeric, paid_at date, paid_via text, reference text );
create table tip_pools     ( id uuid pk, date date, total_collected numeric, distribution jsonb );
```

### Cash management

```sql
create table cash_counts    ( id uuid pk, user_id uuid, date date, counted numeric, expected numeric, difference numeric, notes text );
create table cash_movements ( id uuid pk, user_id uuid, date date, direction text, amount numeric, reason text, reference text );
```

### Menu & recipes

```sql
create table menu_items ( id uuid pk, name text, category text, sell_price numeric, cost_price numeric, recipe jsonb, allergens text[], photo_path text, description text, active boolean );
create table modifiers  ( id uuid pk, name text, price numeric, cost numeric, applies_to text[] );
```

### Stock

```sql
create table stock_items      ( id uuid pk, sku text, name text, category text, unit text, par_level numeric, reorder_at numeric, cost_price numeric, sell_price numeric, supplier_id uuid, allergens text[], active boolean );
create table stock_counts     ( id uuid pk, stock_item_id uuid, user_id uuid, date date, on_hand numeric, notes text );
create table stock_movements  ( id uuid pk, stock_item_id uuid, user_id uuid, date date, direction text, quantity numeric, unit_cost numeric, reason text, reference text );
create table purchase_orders  ( id uuid pk, supplier_id uuid, date date, status text, items jsonb, total numeric, notes text );
```

### Compliance / EHO

```sql
create table appliances          ( id uuid pk, name text, kind text, target_min numeric, target_max numeric, location text, active boolean );
create table temperature_logs    ( id uuid pk, appliance_id uuid, user_id uuid, recorded_at tstz, temperature numeric, in_range boolean, notes text, photo_path text );
create table cleaning_tasks      ( id uuid pk, name text, frequency text, area text );
create table cleaning_log        ( id uuid pk, task_id uuid, user_id uuid, completed_at tstz, notes text );
create table training_records    ( id uuid pk, user_id uuid, type text, certificate_ref text, issued_at date, expires_at date, document_path text );
create table risk_assessments    ( id uuid pk, title text, document_path text, reviewed_at date, next_review_at date );
create table accident_log        ( id uuid pk, occurred_at tstz, person text, description text, action_taken text, riddor_reportable boolean, reported_at tstz );
create table pest_control_visits ( id uuid pk, date date, company text, inspector text, findings text, actions text, document_path text );
```

### Sales ingestion (SumUp)

```sql
create table till_imports ( id uuid pk, source text, date date, gross numeric, fees numeric, net numeric, payment_mix jsonb, raw_payload jsonb, imported_at tstz );
```

### Storage buckets

- `receipts` (private) — expense receipt uploads, accessed via signed URLs
- `compliance-docs` (private) — HACCP, risk assessment, training certificate PDFs
- `menu-photos` (public) — menu item images

### VAT readiness

VAT is **off in v1**. The schema is built so it can be switched on without a rebuild:
- `settings.vat_enabled` boolean — master switch
- `expenses.vat_rate`, `invoices.vat_rate` — null when off, numeric (0 / 5 / 20) when on
- Adding `pot_kind` `'vat'` is a one-line enum extension
- Adding MTD bridge integration is a v2 task; the schema supports it without migration

### RLS overview

| Table | Owner | Manager | Staff |
|---|---|---|---|
| profiles | RW all | R all, U own | R own, U own |
| time_logs | RW all | R all, U all | RW own |
| wage_payments | RW all | R all | R own |
| cash_counts | RW all | RW all | I + R own |
| stock_items | RW all (incl. cost) | RW all (incl. cost) | R (no cost) |
| stock_counts | R all | R all | I + R own |
| stock_movements | RW all | RW all | I waste/delivery only |
| menu_items | RW all (incl. cost) | RW all (incl. cost) | R (no cost) |
| appliances | RW all | RW all | R |
| temperature_logs | R all | R all | I + R own |
| expenses / invoices / takings / DL / tax pot | RW all | RW (some restrictions) | none |
| settings | RW all | none | none |

---

## 9. UX considerations

### 9.1 Staff layout (pass tablet, mobile-first)
- Massive tap targets, minimal text input, almost everything a button press
- 6 main screens: **Clock in/out · Temperature log · Stock count · Wastage · Checklist · Help**
- Auto-locks after 30 min idle; manager PIN to unlock for management actions
- Clock-in target: < 5 seconds from app-open to logged

### 9.2 Manager layout (desktop / laptop)
- Dashboard widgets: today's sales, labour cost %, food cost %, compliance %, stock alerts
- Left nav: Sales / Stock / Staff / Menu / Compliance / Reports

### 9.3 Owner layout (desktop / laptop)
- Manager layout + Financial section (P&L, Tax pot, Director's loan, Bank reconciliation)
- "View as manager" / "View as staff" toggle for testing

### 9.4 EHO printout
- Single-click "Generate compliance pack" button
- PDF output: temperature log table for date range, cleaning completion, training certs not expired, pest control visits, allergen sheet, current FHRS rating

---

## 10. Integrations

| Integration | Purpose |
|---|---|
| **SumUp API** | Pull till sales nightly (item-level + payouts) |
| **Monzo CSV** (built fresh, same approach as Aurora's parser) | Bank reconciliation |
| **Resend** | Supplier order emails, invoice sends |
| **Companies House API** | Auto-populate company details |
| **PDFKit / React-PDF** | Compliance pack, order pads, allergen sheets |

---

## 11. Phased build plan

### Phase 0 — Foundation (1–2 weeks)
- Fresh Next.js + Supabase + Vercel project
- `user_role` enum + `profiles` table
- Role-aware RLS policies, scaffolded for all v1 tables
- Three layouts (owner / manager / staff) + nav gating
- Login + profile setup flow
- `settings` table + onboarding form (company details, bank, CT rate)

### Phase 1 — Operations MVP (4–6 weeks)
- Time logs: clock in/out screen + manager timesheet view
- Temperature logs: appliances + log screen + manager compliance dashboard
- Stock items + stock counts + wastage log (just the tables and screens; recipe-driven flow lands in Phase 3)
- Cash counts (end-of-day cash up)
- Daily checklist
- EHO compliance pack PDF (with the data that exists at this point)

### Phase 2 — Financial core (3–4 weeks)
- Expenses with cafe categories, receipt upload, payees auto-create
- Manual takings entry (precedes SumUp ingestion)
- Invoices for occasional B2B catering / functions
- Director's loan in/out tracking
- Tax pot + corporation tax estimate
- Monzo CSV upload + bank reconciliation
- Basic P&L by period

### Phase 3 — Sales & Stock (4–6 weeks)
- SumUp API integration: daily payout + item-level transaction import → feeds `takings` and `till_imports`
- Menu items + recipes (drinks with full recipes, food mostly as-is)
- Recipe-driven stock depletion (flat white sold → beans + milk + cup reduced)
- Suppliers + delivery / GRN flow
- Order pad generation
- Allergen matrix + printable allergen sheet

### Phase 4 — Staff & Compliance (3–4 weeks)
- Rota / scheduling (simple weekly grid)
- Holiday + sick leave
- Training records with expiry alerts
- Risk assessments + accident log + pest control
- Wage payments generated from time logs
- Tips pool distribution

### Phase 5 — Reporting (2–3 weeks)
- Daily / weekly / monthly sales reports
- Labour cost % and food cost % dashboards
- Wastage cost analysis
- GP / menu engineering report
- Hour-by-hour sales heatmap

**Total: 17–25 weeks (~4.5–6.5 months solo).**

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Scope creep — adding loyalty / online ordering before v1 ships | Lock v1 feature list. v2 candidates go to the parking lot (§14). |
| SumUp API rate limits or outages mid-service | Cache last-known good payouts; manual sales-entry fallback in Phase 2 already exists. |
| Staff resist the system as "more work" | Clock-in < 5 sec. Make staff screens demonstrably faster than paper. |
| Compliance gaps from missed ticks | Push notifications + dashboard red flags for missed temp logs / overdue training. |
| Crossing £90k VAT threshold mid-year | `settings.vat_enabled` flag + `vat_rate` columns ready; VAT UI ships as a fast-follow without migration. |
| PAYE confusion — owner thinks wages feature replaces payroll | Onboarding makes clear: gross-pay tracking only, PAYE/NI/RTI is BrightPay/Xero. |
| Owner can't get data out if system fails | "Export all" CSV from day 1, per-table backup downloadable. |
| Building fresh = no battle-tested accounting code | Phase 2 takes the careful path: write tests for cash up, bank rec, DL, CT estimate from the start. |

---

## 13. Out of scope for v1

To keep v1 buildable and shippable:

- ❌ Online ordering / click & collect / Stripe
- ❌ Table reservations
- ❌ Loyalty stamps / customer database / email marketing / newsletter
- ❌ Gift cards
- ❌ Proper PAYE / RTI submissions (use BrightPay / Xero Payroll)
- ❌ Pension auto-enrolment admin (use Smart / NEST / Aviva)
- ❌ Full kitchen display system (KDS)
- ❌ Multi-site
- ❌ Multi-currency / multi-language UI
- ❌ Offline-first staff screens
- ❌ Food delivery integration (Deliveroo / Uber Eats / Just Eat)
- ❌ Music licensing admin (PRS / PPL)
- ❌ VAT tracking UI (schema-ready, UI deferred)
- ❌ MTD VAT submission
- ❌ Receipt OCR
- ❌ Open Banking sync (Monzo CSV is fine for v1)
- ❌ Mileage tracking
- ❌ Quotes (cafes don't quote)

---

## 14. v2+ parking lot

Once v1 is stable, rough priority order:

1. **Loyalty stamps** — low-friction; email + stamps counter
2. **VAT tracking UI** — flip `settings.vat_enabled`, build input/output VAT screens, MTD bridge
3. **Open Banking sync** — replace Monzo CSV upload (TrueLayer / GoCardless)
4. **Email signup / newsletter** integration (Mailchimp or Brevo)
5. **Online ordering / click & collect** — Stripe + public-facing routes
6. **Table reservations**
7. **Receipt OCR** — auto-extract vendor / amount from photos
8. **Kitchen display system** — if the food offer grows
9. **Customer reviews collection** — Google review prompts on receipts
10. **Multi-site** — if a second location ever appears (significant refactor: `site_id` everywhere)

---

## 15. Glossary

- **EHO** — Environmental Health Officer; local authority inspector.
- **HACCP** — Hazard Analysis and Critical Control Points; mandatory food safety framework.
- **PPDS** — Prepacked for Direct Sale; food made on-site, packaged, then sold (e.g. wrapped sandwiches). Subject to Natasha's Law full-ingredient labelling.
- **RIDDOR** — Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013.
- **GP%** — Gross Profit %. Target 65–75% on drinks, 50–65% on food.
- **GRN** — Goods Received Note.
- **Tronc** — Pooled tips, distributed among staff. Specific UK tax treatment.
- **FHRS** — Food Hygiene Rating Scheme; 0–5 score displayed in window after EHO inspection.
- **MTD** — Making Tax Digital; HMRC requirement to file VAT returns via API. Not applicable while below £90k threshold.
- **RLS** — Row-Level Security; Supabase / Postgres feature for per-role data access policies.

---

_Brief locked 2026-05-20. Built fresh; patterns informed by [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) (Aurora reference only)._
