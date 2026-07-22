-- Spec 17 — tickle_breakdown(p_user): the board's number becomes a glass box.
--
-- A read-only receipt that decomposes any player's SEASON `tickles_earned` into
-- its real ledger sources. Self and others render identically — the total is
-- already public on the board, so there is no privacy line to cross. This is
-- the same decomposition the coopatroopa69 founder audit did by hand (SKILL.md
-- decision log, 2026-07-17): played taps vs granted lumps, every lane labeled.
--
-- Migration AUTHORED ONLY — never `db push` autonomously.
--
-- The lanes (all read off ledgers that already credit profiles.tickles_earned):
--   home_taps  — RESIDUAL: total minus every ledgered lane, floored at 0. The
--                balancing item; a home tap mints +1 tickles_earned
--                (update_profile_and_item_count), and this absorbs any legacy
--                remainder (incl. a pre-push trough clawback — spec 15).
--   visit_taps — COUNT(barn_visits) as visitor; each visit credits the visitor
--                +1 tickles_earned (visitor_reward const 1, 20260691).
--   dig_finds  — COUNT(truffle_digs) as digger × 5, the dig_truffle golden-strike
--                credit (20260706200000: +5 tickles_earned per golden barn find).
--                Approximate (only ~20% of digs strike gold); the residual
--                absorbs the drift.
--   pass_tiers — SUM of tickle-type season-pass tier rewards claimed this season
--                (reward_type IN ('tickles','tickle'); reward_value 'amount'|'tickles').
--   trades     — SUM(amount × 2) over the caller's FULFILLED asks. NOTE: a
--                fulfilled ask pays the REQUESTER amount×2 (fulfill_tickle_trade,
--                20260562), so this lane keys on requester_id — see the deviation
--                note at the query below.
--   lucky      — COUNT(daily_lucky_claims) × 5; each lucky win credits +5
--                tickles_earned (20260506).
--   NO trough lane — the Trough tickle reward is retired + clawed back (spec 15);
--                any residual lands silently in home_taps, never as a source.

CREATE OR REPLACE FUNCTION public.tickle_breakdown(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	v_boundary timestamptz;
	v_total    bigint;
	v_visit    bigint;
	v_dig      bigint;
	v_pass     bigint;
	v_trades   bigint;
	v_lucky    bigint;
	v_home     bigint;
BEGIN
	-- Season boundary = the active season's start (NOT a hard-coded timestamp).
	-- active_season() (20260709) returns a NULL composite when nothing is active,
	-- which surfaces as v_boundary = NULL here.
	SELECT starts_at INTO v_boundary FROM public.active_season();

	-- The public season stat we're decomposing.
	SELECT COALESCE(tickles_earned, 0) INTO v_total
		FROM public.profiles WHERE id = p_user;
	v_total := COALESCE(v_total, 0);

	-- No active season → we can't window the lanes; the whole total is residual.
	IF v_boundary IS NULL THEN
		RETURN jsonb_build_object(
			'total', v_total, 'boundary', NULL,
			'home_taps', v_total, 'visit_taps', 0, 'dig_finds', 0,
			'pass_tiers', 0, 'trades', 0, 'lucky', 0);
	END IF;

	-- visit_taps — each barn visit credits the visitor +1 tickles_earned.
	SELECT count(*) INTO v_visit FROM public.barn_visits
		WHERE visitor_id = p_user AND created_at > v_boundary;

	-- dig_finds — barn-forage digs × 5 (the dig_truffle golden-strike credit).
	SELECT count(*) * 5 INTO v_dig FROM public.truffle_digs
		WHERE digger_id = p_user AND dug_at > v_boundary;

	-- pass_tiers — tickle-type season-pass tier rewards claimed this season.
	SELECT COALESCE(SUM(COALESCE(
			(st.reward_value->>'amount')::int,
			(st.reward_value->>'tickles')::int, 0)), 0)
		INTO v_pass
		FROM public.user_tier_claims utc
		JOIN public.season_tiers st
			ON st.season_id = utc.season_id
		   AND st.tier      = utc.tier
		   AND st.track     = utc.track
		WHERE utc.user_id = p_user
		  AND utc.claimed_at > v_boundary
		  AND st.reward_type IN ('tickles', 'tickle');

	-- trades — a fulfilled ask pays amount × 2 to the REQUESTER (the asker), per
	-- fulfill_tickle_trade (20260562). The spec text keys this lane on target_id,
	-- but tickles_earned is credited to requester_id — so decomposing p_user's OWN
	-- tickles_earned requires requester_id here, or the lane would count trades
	-- that never touched p_user's total (and inflate the residual). The label
	-- "trades repaid" is the requester's view: your ask was repaid, amount × 2.
	SELECT COALESCE(SUM(amount * 2), 0) INTO v_trades FROM public.tickle_trades
		WHERE requester_id = p_user AND fulfilled_at > v_boundary;

	-- lucky — each daily-lucky win credits +5 tickles_earned.
	SELECT count(*) * 5 INTO v_lucky FROM public.daily_lucky_claims
		WHERE user_id = p_user AND claimed_at > v_boundary;

	-- home_taps — the balancing residual, floored at 0 so any legacy remainder
	-- (incl. a pre-push trough clawback) lands here silently rather than going
	-- negative. NO trough lane by design.
	v_home := GREATEST(0, v_total - (v_visit + v_dig + v_pass + v_trades + v_lucky));

	RETURN jsonb_build_object(
		'total',      v_total,
		'boundary',   v_boundary,
		'home_taps',  v_home,
		'visit_taps', v_visit,
		'dig_finds',  v_dig,
		'pass_tiers', v_pass,
		'trades',     v_trades,
		'lucky',      v_lucky);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.tickle_breakdown(uuid) TO authenticated;
