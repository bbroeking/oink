-- Lockdown: only the RevenueCat webhook (service role) can grant
-- entitlements from now on.
--
-- Until now, ANY authenticated user could call dev_set_vip() or
-- grant_season_pass() directly and grant themselves a Slop Club
-- membership / Season Pass for free. The client gates were __DEV__
-- only; the server RPCs were still open. This closes that hole
-- before TestFlight.
--
-- The function bodies STAY, so:
--   - the RevenueCat webhook (service-role) can still call them, and
--   - Supabase Studio / direct SQL can still flip values for dev
--     debugging.
-- Only the `authenticated` role loses EXECUTE.

REVOKE EXECUTE ON FUNCTION public.dev_set_vip(boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_season_pass() FROM authenticated;
