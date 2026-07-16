-- Lock down push sending: only the server may send.
--
-- send_push_to_user and dev_send_push were EXECUTE-granted to authenticated
-- (20260520050000) — meaning ANY signed-in player who found the RPC could
-- push arbitrary title/body text to ANY other player's device. No client
-- code has ever called either function; the grants served nobody.
--
-- Revoking is safe for every legitimate caller: tickle_trades_push_notify,
-- the dig-off push paths, and the cron sweeps are all SECURITY DEFINER
-- functions owned by the migration role, so their inner calls execute with
-- the owner's privileges and never consult these grants. Manual test sends
-- (dev_send_push) remain available from the SQL console, which runs as
-- postgres.
--
-- Numbered 20260741100000 to sort after the applied hotfix 20260741000000
-- and before the staged 20260742000000_join_requests (which ships with the
-- 1.3 knock-UI binary).

REVOKE ALL ON FUNCTION public.send_push_to_user(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dev_send_push(uuid, text, text) FROM PUBLIC, anon, authenticated;
