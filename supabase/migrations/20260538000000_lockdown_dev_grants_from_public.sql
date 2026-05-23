-- Follow-up to 20260537000000_lockdown_dev_grants.sql.
--
-- That migration did `REVOKE EXECUTE ... FROM authenticated`, which
-- Postgres treated as a no-op: every function in Postgres grants
-- EXECUTE to PUBLIC by default, and `authenticated` inherits from
-- PUBLIC. So the actual lockdown is REVOKE FROM PUBLIC.
--
-- Verified with has_function_privilege('authenticated', oid,
-- 'EXECUTE') after applying 20260537 — still returned true.
--
-- This one truly closes the gate: only the service role (the
-- RevenueCat webhook) and Supabase Studio can call.

REVOKE EXECUTE ON FUNCTION public.dev_set_vip(boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_season_pass() FROM PUBLIC;
