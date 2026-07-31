-- Harden the Sounder recruiting RPC grants after 20260801000000.
--
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. The RPCs
-- already reject unauthenticated callers internally, but the database boundary
-- should deny default/anonymous execution explicitly and expose only the two
-- user-facing actions plus the candidate read to authenticated clients.

REVOKE ALL ON FUNCTION public.invite_to_crew(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_to_crew(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_crew_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_crew_invite(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.sounder_invite_candidates(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sounder_invite_candidates(text, int) TO authenticated;

-- This function is invoked only by the table trigger; clients never call it.
REVOKE ALL ON FUNCTION public.touch_crew_invite_updated_at()
	FROM PUBLIC, anon, authenticated;
