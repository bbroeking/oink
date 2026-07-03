-- Barn visiting: RESTORE the 3–7 tap-per-visit model (reverts 20260682's
-- "one tickle per visit" simplification). Player intent: a visit should be a
-- little tickle SESSION, not a single tap.
--
--   1. Each visit rolls a random cap of 3–7 tickles. You tickle the friend's
--      pig up to that many times in one sitting.
--   2. Leaving FORFEITS any unused taps — re-entry is gated by the pairwise
--      lock below, so you can't bank a visit and dribble it out.
--   3. After the visit (cap hit OR you leave), that friend's Barn is on a 24h
--      PAIRWISE cooldown (once a day per friend).
--   4. Budget: 3 DISTINCT barns per rolling 3h window (count(DISTINCT target)).
--
-- This is the 20260681 logic verbatim. 20260682 added a profiles
-- .barn_visit_window_start column for an anchored budget window; these
-- functions use the rolling-window count instead, so that column is simply
-- left unused (harmless). Both host and visitor keep leaderboard credit
-- (counter + tickles_earned). The budget/cooldown refusals reuse the
-- 'cooldown' error + locked/next_at fields so the existing client shows the
-- countdown with no app change.

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
		'next_at', v_start + pair_cooldown
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.tickle_at_barn(uuid) TO authenticated;

-- barn_visit_status drives the client's arrival lock screen. A friend is locked
-- if (a) you visited them within 24h (pairwise) OR (b) you've already opened 3
-- distinct visits in the trailing 3h (budget). Both report locked + next_at so
-- the client shows the right countdown. Live visits report taps_left + tap_cap
-- so the arrival screen knows how many tickles remain in the session.
CREATE OR REPLACE FUNCTION public.barn_visit_status(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id       uuid := auth.uid();
	pair_cooldown   constant interval := '24 hours';
	visit_window    constant interval := '3 hours';
	visit_budget    constant int := 3;
	v_start         timestamptz;
	v_cap           int;
	taps_this_visit int := 0;
	is_locked       boolean := false;
	v_next_at       timestamptz;
	v_taps_left     int;
	v_tap_cap       int;
	distinct_recent int;
	window_oldest   timestamptz;
	visits_left     int;
	v_vip           boolean;
	v_cap_bank      int;
	v_regen         int;
	v_count         int;
	v_intervals     int;
	v_bal           int;
	v_secs_since    numeric;
	v_next_regen    int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_target = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'error', 'self');
	END IF;

	SELECT visit_started_at, visit_cap
	INTO v_start, v_cap
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target
	ORDER BY created_at DESC
	LIMIT 1;

	-- Budget: distinct barns opened in the trailing 3h window.
	SELECT count(DISTINCT target_id), min(visit_started_at)
	INTO distinct_recent, window_oldest
	FROM public.barn_visits
	WHERE visitor_id = caller_id
	  AND visit_started_at > now() - visit_window;
	visits_left := GREATEST(0, visit_budget - COALESCE(distinct_recent, 0));

	IF v_start IS NOT NULL AND v_start > now() - pair_cooldown THEN
		-- Visited this friend within 24h → locked for the whole pairwise window
		-- (leaving forfeits any unused taps).
		SELECT count(*) INTO taps_this_visit
		FROM public.barn_visits
		WHERE visitor_id = caller_id AND target_id = p_target
		  AND visit_started_at = v_start;
		is_locked := true;
		v_next_at := v_start + pair_cooldown;
		v_taps_left := GREATEST(0, v_cap - taps_this_visit);
		v_tap_cap := v_cap;
	ELSIF COALESCE(distinct_recent, 0) >= visit_budget THEN
		-- Fresh friend, but you've used all 3 barn visits this 3h window →
		-- locked until the oldest ages out.
		is_locked := true;
		v_next_at := window_oldest + visit_window;
	END IF;
	-- else: a fresh visit to this friend is available (cap rolled on first tap).

	-- Visitor's own tickle bank (unchanged from 20260678 / 20260608).
	SELECT COALESCE(is_vip, false) INTO v_vip FROM public.profiles WHERE id = caller_id;
	v_cap_bank := CASE WHEN v_vip THEN 50 ELSE 25 END;
	v_regen := public.regen_secs_for(caller_id);
	SELECT item_count,
	       EXTRACT(EPOCH FROM (now() - last_increment))
	INTO v_count, v_secs_since
	FROM public.user_items WHERE user_id = caller_id;
	v_intervals := GREATEST(0, floor(COALESCE(v_secs_since, 0) / v_regen)::int);
	v_bal := COALESCE(GREATEST(v_count, LEAST(v_cap_bank, v_count + v_intervals)), 0);
	v_next_regen := CASE
		WHEN v_bal >= v_cap_bank THEN NULL
		ELSE GREATEST(1, v_regen - (COALESCE(v_secs_since, 0)::int % v_regen))
	END;

	RETURN jsonb_build_object(
		'ok', true,
		'taps_left', v_taps_left,
		'tap_cap', v_tap_cap,
		'resting', false,        -- no 15-min "resting" state; visited == locked
		'locked', is_locked,
		'next_at', v_next_at,
		'visits_left', visits_left,     -- barns you can still visit this 3h window
		'visit_budget', visit_budget,
		'balance', v_bal,
		'cap', v_cap_bank,
		'next_regen_seconds', v_next_regen,
		'regen_seconds', v_regen
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.barn_visit_status(uuid) TO authenticated;
