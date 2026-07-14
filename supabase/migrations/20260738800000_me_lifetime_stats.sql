-- me_lifetime_stats(): the aggregate counts behind the Me tab's "long story"
-- lifetime dashboard. The scalar lifetime fields (lifetime tickles, snouts,
-- active days, war wins, referrals, joined, membership) already live on the
-- caller's profiles row and are read client-side; this RPC covers only the
-- counts that require touching OTHER tables the client can't (or shouldn't)
-- aggregate itself.
--
-- Returns jsonb of seven counts, all keyed for the caller (auth.uid()):
--   barn_visits_made    — barn_visits.visitor_id = caller (visits I paid to)
--   barn_visits_hosted  — barn_visits.target_id  = caller (visits to my barn)
--   truffles_buried     — truffles.host_id       = caller (treats I set out)
--   friend_mound_digs   — truffle_digs.digger_id = caller (mounds I dug)
--   blessings_sent      — blessings.sender_id    = caller
--   curses_sent         — curses.sender_id       = caller
--   trades_fulfilled    — tickle_trades.requester_id = caller AND fulfilled
--
-- One SELECT of scalar subqueries — cheap, index-friendly (each column has a
-- leading-id index), a single round trip. SECURITY DEFINER so it reads the
-- RLS-guarded social tables (barn_visits/truffles have no client SELECT policy
-- for these shapes); the caller only ever sees THEIR OWN counts because every
-- subquery is pinned to auth.uid().
CREATE OR REPLACE FUNCTION public.me_lifetime_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'barn_visits_made', (
			SELECT count(*) FROM public.barn_visits WHERE visitor_id = caller_id
		),
		'barn_visits_hosted', (
			SELECT count(*) FROM public.barn_visits WHERE target_id = caller_id
		),
		'truffles_buried', (
			SELECT count(*) FROM public.truffles WHERE host_id = caller_id
		),
		'friend_mound_digs', (
			SELECT count(*) FROM public.truffle_digs WHERE digger_id = caller_id
		),
		'blessings_sent', (
			SELECT count(*) FROM public.blessings WHERE sender_id = caller_id
		),
		'curses_sent', (
			SELECT count(*) FROM public.curses WHERE sender_id = caller_id
		),
		'trades_fulfilled', (
			SELECT count(*) FROM public.tickle_trades
			WHERE requester_id = caller_id AND status = 'fulfilled'
		)
	);
END $function$;

GRANT EXECUTE ON FUNCTION public.me_lifetime_stats() TO authenticated;
