-- TILL project (sirmwnwllnarqdaqpzhy), applied 18 Sep 2026 as migration
-- invoices_read_started_at. Lets the café app claim a captured invoice for
-- reading; see supabase/till/invoice-capture/index.ts.
alter table public.invoices add column if not exists read_started_at timestamptz;
comment on column public.invoices.read_started_at is 'When a reader (the café app) claimed this invoice for reading. A read older than 15 minutes that never reported back is treated as dead and the invoice is waiting again.';
