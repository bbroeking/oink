-- Security Definer View lint fix for the two trade-aggregate views.
--
-- public.user_trade_given / user_trade_received are plain views over
-- tickle_trades (which HAS RLS). Without security_invoker they run as the
-- view owner, bypassing the caller's RLS — and they're granted SELECT to
-- anon + authenticated by default, so anyone (even anonymous) could read
-- every user's aggregate trade totals via PostgREST.
--
-- They're only ever read by the SECURITY DEFINER functions
-- trade_given_total() / trade_received_total() (owned by a superuser that
-- bypasses RLS), so neither change breaks those functions:
--   1. security_invoker = true → the view honors the caller's RLS (this is
--      the property the linter checks for).
--   2. REVOKE from anon + authenticated → drop the unnecessary API exposure;
--      the views are an internal detail of the *_total functions, not an API
--      surface. The owner keeps its own access, so the functions still work.

ALTER VIEW public.user_trade_given    SET (security_invoker = true);
ALTER VIEW public.user_trade_received SET (security_invoker = true);

REVOKE ALL ON public.user_trade_given    FROM anon, authenticated;
REVOKE ALL ON public.user_trade_received FROM anon, authenticated;
