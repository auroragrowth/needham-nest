-- Security fixes applied to the live database on 16 Sep 2026, with Paul's
-- approval. Recorded here so the repo matches the database. Already applied as
-- migrations close_public_access_to_payroll_and_cooked_meats and
-- close_self_signup_escalation_and_blanket_grants.
--
-- Also required, outside SQL: Supabase dashboard -> Authentication -> Sign In /
-- Providers -> turn off "Allow new users to sign up". With sign-ups on and email
-- auto-confirm, anyone could create a login, which handle_new_user turns into a
-- staff profile.

-- Payroll and cooked meats were readable and writable with the public anon key.
drop policy if exists payslips_owner_all on public.payslips;
drop policy if exists payroll_runs_admin_all on public.payroll_runs;
drop policy if exists cooked_meat_checks_admin_all on public.cooked_meat_checks;
revoke all on public.payslips, public.payroll_runs, public.cooked_meat_checks from anon, authenticated;
revoke all on public.feedback_outstanding from anon, authenticated;

-- Staff and managers could update their own profile row, role included, so a
-- self-signed-up account could make itself owner. Profiles are edited through
-- the service-role admin client only.
drop policy if exists profiles_staff_update_own on public.profiles;
drop policy if exists profiles_manager_update_own on public.profiles;

-- anon and authenticated had full privileges on every table, leaving RLS as the
-- only barrier. Only the two browser inserts the app and website really make stay.
revoke all on all tables in schema public from anon, authenticated;
grant insert on public.staff_feedback to anon;
grant insert on public.event_bookings to anon;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

-- Unused SECURITY DEFINER functions callable with the public key.
revoke execute on function public.mark_feedback_submitted(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_alerts() from public, anon;
