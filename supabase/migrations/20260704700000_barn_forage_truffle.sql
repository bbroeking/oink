-- ═══════════════════════════════════════════════════════════════════════════
-- BARN FORAGE — a Golden Truffle can surface while visiting a friend's Barn
-- (Season 2 / The Great Hunger, P2). HELD FOR REVIEW: push only on Brian's
-- explicit "go" (see CLAUDE.md — DB pushes are never autonomous).
--
-- WHY: the Great Hungerer has hoarded the world's truffles, but a few still
-- lie buried in friends' Barns. Rooting around a friend's Barn (a visit) now
-- has a small chance to turn one up — a cozy Connect moment that feeds the war
-- economy without opening a farmable faucet:
--   • Only while the `world_boss` layer is live (app_config, per-user override
--     wins — same effective-flag semantics as feature_flags(), so Brian's test
--     account can exercise it before the global flip).
--   • ~15% chance, rolled ONCE per fresh visit (the arrival tap).
--   • HARD-CAPPED at ONE find per forager per UTC day (ledger-enforced).
--   • Minted the ONE audited war-only way — mint_truffles() (20260704100000),
--     reason 'barn_forage', no war attached (war_id NULL). Cap-aware and never
--     lossy, exactly like every other Golden Truffle source.
--
-- This CARRIES public.tickle_at_barn VERBATIM from its latest definition
-- (20260691000000_barn_three_to_seven_taps.sql) — the ONLY changes are: three
-- new DECLARE vars, the forage roll block, and one extra payload field
-- ('golden_truffle_found'). barn_visit_status is UNCHANGED and not re-declared.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id       uuid := auth.uid();
	host_reward     constant int := 1;
	visitor_reward  constant int := 1;
	pair_cooldown   constant interval := '24 hours'; -- per-friend (pairwise) lock
	visit_window    constant interval := '3 hours';  -- rolling budget window
	visit_budget    constant int := 3;               -- distinct barns per window
	v_start         timestamptz;
	v_cap           int;
	taps_this_visit int;
	taps_left       int;
	distinct_recent int;
	window_oldest   timestamptz;
	visitor_name    text;
	-- CARRY DIFF: barn-forage Golden Truffle find (Season 2 / world_boss).
	v_world_boss    boolean := false;
	v_forage_today  int := 0;
	v_truffle_found boolean := false;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_target = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'error', 'self');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'no_target');
	END IF;

	-- Friends-only: the authoritative gate against minting to/from strangers.
	IF NOT public.are_friends(caller_id, p_target) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'not_friends');
	END IF;

	-- Most recent visit to THIS friend.
	SELECT visit_started_at, visit_cap
	INTO v_start, v_cap
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target
	ORDER BY created_at DESC
	LIMIT 1;

	IF v_start IS NOT NULL AND v_start > now() - pair_cooldown THEN
		-- Visited this friend within 24h. Spend the live visit's cap if taps
		-- remain in this session; once the cap is hit the friend stays locked
		-- until v_start + 24h (re-entry is gated client-side, so leaving
		-- forfeits any unused taps).
		SELECT count(*) INTO taps_this_visit
		FROM public.barn_visits
		WHERE visitor_id = caller_id AND target_id = p_target
		  AND visit_started_at = v_start;
		IF taps_this_visit >= v_cap THEN
			RETURN jsonb_build_object(
				'ok', false, 'error', 'cooldown',
				'next_at', v_start + pair_cooldown
			);
		END IF;
	ELSE
		-- Opening a FRESH visit to this friend (not visited in the last 24h).
		-- Enforce the 3-distinct-barns-per-3h budget FIRST. Each fresh visit is
		-- a distinct target (a target visited within 24h can't be re-opened),
		-- so count(DISTINCT target_id) in the window == fresh visits this window.
		SELECT count(DISTINCT target_id), min(visit_started_at)
		INTO distinct_recent, window_oldest
		FROM public.barn_visits
		WHERE visitor_id = caller_id
		  AND visit_started_at > now() - visit_window;
		IF COALESCE(distinct_recent, 0) >= visit_budget THEN
			-- Budget spent — reuse the 'cooldown' refusal so the existing client
			-- shows the countdown until the oldest visit ages out of the window.
			RETURN jsonb_build_object(
				'ok', false, 'error', 'cooldown',
				'reason_detail', 'budget',
				'budget', visit_budget,
				'next_at', window_oldest + visit_window
			);
		END IF;
		v_start := now();
		v_cap := 3 + floor(random() * 5)::int; -- 3..7 inclusive
		taps_this_visit := 0;
	END IF;

	-- The tickle lands on the host's LEADERBOARD (counter + tickles_earned).
	UPDATE public.profiles
	SET counter = counter + host_reward,
	    tickles_earned = tickles_earned + host_reward
	WHERE id = p_target;

	-- The visitor earns the same: real snouts (counter) + leaderboard (tickles_earned).
	UPDATE public.profiles
	SET counter = counter + visitor_reward,
	    tickles_earned = tickles_earned + visitor_reward
	WHERE id = caller_id;

	-- Both pigs get happier (yours full, theirs 25%, both window-capped).
	PERFORM public.apply_happiness(caller_id, 1.0);
	PERFORM public.apply_happiness(p_target, 0.25);

	INSERT INTO public.barn_visits (visitor_id, target_id, tickles, visit_started_at, visit_cap)
	VALUES (caller_id, p_target, host_reward, v_start, v_cap);

	-- First tap of the visit: generosity + notify (once per visit).
	IF taps_this_visit = 0 THEN
		PERFORM public.shift_alignment(caller_id, 1);
		SELECT username INTO visitor_name FROM public.profiles WHERE id = caller_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			p_target, 'barn_visit', 'Someone visited your Barn!',
			COALESCE(visitor_name, 'A friend') || ' came by and tickled your pig!',
			'{}'::jsonb
		);

		-- CARRY DIFF: Great Hunger barn forage. On the arrival tap of a fresh
		-- visit, rooting around a friend's Barn can turn up a lone Golden
		-- Truffle the Hungerer missed. Gated on the effective world_boss flag
		-- (per-user override wins over the global, matching feature_flags()),
		-- ~15% chance, and hard-capped at ONE find per forager per UTC day via
		-- the war_truffles ledger (reason 'barn_forage'). Minted the audited
		-- war-only way; a maxed pouch (mint returns 0) simply isn't a "find".
		SELECT COALESCE(
			(SELECT (feature_overrides ->> 'world_boss')::boolean
			   FROM public.profiles WHERE id = caller_id),
			(SELECT enabled FROM public.app_config WHERE key = 'world_boss'),
			false
		) INTO v_world_boss;
		IF v_world_boss THEN
			SELECT count(*) INTO v_forage_today
			FROM public.war_truffles
			WHERE user_id = caller_id
			  AND reason = 'barn_forage'
			  AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date;
			IF v_forage_today = 0 AND random() < 0.15 THEN
				IF public.mint_truffles(caller_id, 1, 'barn_forage', NULL) > 0 THEN
					v_truffle_found := true;
				END IF;
			END IF;
		END IF;
	END IF;

	PERFORM public.grant_season_xp(caller_id, 5);

	taps_left := GREATEST(0, v_cap - (taps_this_visit + 1));

	RETURN jsonb_build_object(
		'ok', true,
		'tickles', host_reward,
		'visitor_tickles', visitor_reward,
		'taps_left', taps_left,
		'tap_cap', v_cap,
		-- Pairwise cooldown committed from the visit start; the client uses it
		-- to show the per-friend countdown on the cap-hitting tap.
		'next_at', v_start + pair_cooldown,
		-- Season 2: true when this arrival tap uncovered a Golden Truffle.
		'golden_truffle_found', v_truffle_found
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.tickle_at_barn(uuid) TO authenticated;
