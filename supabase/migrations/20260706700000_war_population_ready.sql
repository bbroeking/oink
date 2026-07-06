-- War population flip-trigger metric — precondition for widening the `mud_wars` flag.
-- HELD FOR REVIEW; push only on go.
--
-- WHY: the decision to widen the `mud_wars` UI flag from Brian-only to a bounded
-- cohort (then global) was prose-only — "flip when the population is big enough"
-- with no way to actually READ that. This adds one read-only, admin-gated RPC that
-- reports the real (non-test) crewed population and whether it clears the bar, so
-- the flip is a data call instead of a guess. See
-- docs/wiki/outputs/memos/mudwar-whats-next-2026-07.md (step 6).
--
-- SHAPE: war_population_ready() → jsonb snapshot. Read-only (no writes), so it is
-- safe to run anytime. It is is_test-gated (RAISE 'admin_only') — the project's
-- admin predicate, same as admin_tickle_overview / admin_set_feature_flag.
--
-- SIGNAL: "ready" is sized on CREWED, non-test players — the minimum bar for a
-- crew-vs-crew feature — plus enough crews that clear the scuffle quorum (2 active
-- members) for matchmaking to have partners.
--   • real_players    — all non-test profiles (context denominator).
--   • crewed_players  — non-test players in a (non-bot) crew.
--   • war_ready_crews — non-bot crews with >= QUORUM (2) non-test members.
--   • active_wars     — currently-running scuffles (liveness sanity check).
--   • ready           — crewed_players >= MIN_CREWED AND war_ready_crews >= MIN_READY_CREWS.
--
-- THRESHOLDS are hardcoded defaults (echoed in the payload so a reader sees the
-- bar). QUORUM 2 mirrors resolve_war's quorum floor (20260647) so "war-ready"
-- means what the matchmaker means. Retune by editing this function.

CREATE OR REPLACE FUNCTION public.war_population_ready()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_is_test   boolean;
	c_quorum         int := 2;   -- mirrors resolve_war's quorum floor (20260647)
	min_crewed       int := 20;  -- hardcoded flip bar: crewed non-test players
	min_ready_crews  int := 4;   -- hardcoded flip bar: quorum-clearing crews
	real_players     int;
	crewed_players   int;
	war_ready_crews  int;
	active_wars      int;
BEGIN
	-- Admin-only (is_test), same predicate as admin_tickle_overview.
	SELECT COALESCE(p.is_test, false) INTO caller_is_test
		FROM public.profiles p WHERE p.id = auth.uid();
	IF NOT COALESCE(caller_is_test, false) THEN
		RAISE EXCEPTION 'admin_only';
	END IF;

	SELECT count(*) INTO real_players
		FROM public.profiles p
		WHERE COALESCE(p.is_test, false) = false;

	SELECT count(*) INTO crewed_players
		FROM public.crew_members cm
		JOIN public.profiles p ON p.id = cm.user_id
		JOIN public.crews c     ON c.id = cm.crew_id
		WHERE COALESCE(p.is_test, false) = false
		  AND c.is_bot = false;

	SELECT count(*) INTO war_ready_crews FROM (
		SELECT cm.crew_id
			FROM public.crew_members cm
			JOIN public.profiles p ON p.id = cm.user_id
			JOIN public.crews c     ON c.id = cm.crew_id
			WHERE COALESCE(p.is_test, false) = false
			  AND c.is_bot = false
			GROUP BY cm.crew_id
			HAVING count(*) >= c_quorum
	) q;

	SELECT count(*) INTO active_wars
		FROM public.mud_wars WHERE status = 'active';

	RETURN jsonb_build_object(
		'real_players',    real_players,
		'crewed_players',  crewed_players,
		'war_ready_crews', war_ready_crews,
		'active_wars',     active_wars,
		'thresholds', jsonb_build_object(
			'min_crewed',      min_crewed,
			'min_ready_crews', min_ready_crews,
			'quorum',          c_quorum
		),
		'ready', (crewed_players >= min_crewed AND war_ready_crews >= min_ready_crews)
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.war_population_ready() TO authenticated;
