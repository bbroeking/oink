-- Final lockdown pass: REVOKE from anon as well as PUBLIC + authenticated.
--
-- Supabase grants EXECUTE to anon directly (separate from the PUBLIC
-- default), so the prior REVOKE FROM PUBLIC missed it. Verified via
-- has_function_privilege('anon', oid, 'EXECUTE') after 20260538 —
-- still true.
--
-- anon access was effectively harmless (the functions check
-- auth.uid() and bail with 'unauthenticated' before doing anything),
-- but a true lockdown closes it.

REVOKE EXECUTE ON FUNCTION public.dev_set_vip(boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_season_pass() FROM anon;
