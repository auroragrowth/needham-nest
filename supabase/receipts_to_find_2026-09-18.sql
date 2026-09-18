-- Receipts to find (18 Sep 2026): mark bank payments that will never have a
-- receipt, one at a time or for every payment to a payee.

alter table public.bank_transactions
  add column if not exists no_receipt_reason text,
  add column if not exists no_receipt_by text,
  add column if not exists no_receipt_at timestamptz;

comment on column public.bank_transactions.no_receipt_reason is
  'Set when this payment will never have a receipt or invoice (wages, transfer, fee…). Keeps it off Receipts to find.';

create table if not exists public.bank_payee_rules (
  payee text primary key,            -- lower(trim(bank payee name)), as Monzo names it
  reason text not null,              -- wages, transfer, no receipt needed…
  created_by text,
  created_at timestamptz not null default now()
);
comment on table public.bank_payee_rules is
  'Bank payees whose payments never need a receipt: kept off Receipts to find. Service role only.';
alter table public.bank_payee_rules enable row level security;

-- Applied with a 'may richardson' = wages seed row, deleted the same day: her
-- transfers are mostly weekly pay but some are expense claims, which need
-- receipts. Wages are now recognised by reference (src/lib/bank/receipts-to-find.ts).
