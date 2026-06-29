-- Barn visiting, SIMPLIFIED for clarity (player feedback: "don't make it
-- confusing"). Replaces the multi-tap / rolling-window model with three rules
-- a player can hold in their head:
--
--   1. A visit = ONE tickle. You visit a friend's Barn, tickle their pig once,
--      and you BOTH get a tickle on the leaderboard.
--   2. You can visit up to 3 different friends per window. All 3 refresh
--      together 3 HOURS AFTER YOUR FIRST visit of the window (not rolling, not
--      after the 3rd — so using only 1 or 2 still refreshes all 3 at first+3h).
--   3. You can visit each friend once a day (24h pairwise cooldown).
--
-- The 3h window is anchored to the first visit via a new
-- profiles.barn_visit_window_start column. No per-visit tap cap, nothing to
-- forfeit. Both host and visitor keep leaderboard credit (counter +
-- tickles_earned). Refusals reuse the 'cooldown' error + locked/next_at status
-- fields so the existing client shows the countdown.

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS barn_visit_window_start timestamptz;

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	host_reward    constant int := 1;
	visitor_reward constant int := 1;
	pair_cooldown  constant interval := '24 hours'; -- per-friend (once a day)
	visit_window   constant interval := '3 hours';  -- budget window
	visit_budget   constant int := 3;               -- visits per window
	last_visit     timestamptz;
	w_start        timestamptz;
	visits_used    int;
	visitor_name   text;
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
	IF NOT public.are_friends(caller_id, p_target) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'not_friends');
	END IF;

	-- (1) Per-friend 24h cooldown: visited this friend within a day?
	SELECT max(visit_started_at) INTO last_visit
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target;
	IF last_visit IS NOT NULL AND last_visit > now() - pair_cooldown THEN
		RETURN jsonb_build_object(
			'ok', false, 'error', 'cooldown',
			'next_at', last_visit + pair_cooldown
		);
	END IF;

	-- (2) Visit budget — 3 per window, window anchored to the FIRST visit.
	SELECT barn_visit_window_start INTO w_start
	FROM public.profiles WHERE id = caller_id FOR UPDATE;

	IF w_start IS NULL OR w_start <= now() - visit_window THEN
		-- No active window → this visit opens a fresh one; all 3 are available
		-- and will refresh at w_start + 3h regardless of how many you use.
		w_start := now();
		UPDATE public.profiles SET barn_visit_window_start = w_start WHERE id = caller_id;
		visits_used := 0;
	ELSE
		SELECT count(*) INTO visits_used
		FROM public.barn_visits
		WHERE visitor_id = caller_id AND visit_started_at >= w_start;
		IF visits_used >= visit_budget THEN
			RETURN jsonb_build_object(
				'ok', false, 'error', 'cooldown',
				'reason_detail', 'budget',
				'next_at', w_start + visit_window
			);
		END IF;
	END IF;

	-- The single tickle lands on BOTH leaderboards (counter + tickles_earned).
	UPDATE public.profiles
	SET counter = counter + host_reward,
	    tickles_earned = tickles_earned + host_reward
	WHERE id = p_target;

	UPDATE public.profiles
	SET counter = counter + visitor_reward,
	    tickles_earned = tickles_earned + visitor_reward
	WHERE id = caller_id;

	-- Both pigs get happier (yours full, theirs 25%, both window-capped).
	PERFORM public.apply_happiness(caller_id, 1.0);
	PERFORM public.apply_happiness(p_target, 0.25);

	-- One tickle = one visit row (visit_cap kept at 1 for the new model).
	INSERT INTO public.barn_visits (visitor_id, target_id, tickles, visit_started_at, visit_cap)
	VALUES (caller_id, p_target, host_reward, now(), 1);

	-- Generosity + notify (every visit is a complete, single tickle).
	PERFORM public.shift_alignment(caller_id, 1);
	SELECT username INTO visitor_name FROM public.profiles WHERE id = caller_id;
	INSERT INTO public.system_announcements (user_id, kind, title, body, data)
	VALUES (
		p_target, 'barn_visit', 'Someone visited your Barn!',
		COALESCE(visitor_name, 'A friend') || ' came by and tickled your pig!',
		'{}'::jsonb
	);

	PERFORM public.grant_season_xp(caller_id, 5);

	RETURN jsonb_build_object(
		'ok', true,
		'tickles', host_reward,
		'visitor_tickles', visitor_reward,
		'taps_left', 0,                         -- one tickle per visit
		'tap_cap', 1,
		'visits_left', GREATEST(0, visit_budget - (visits_used + 1)),
		'visits_refresh_at', w_start + visit_window,
		-- this friend's barn is now on the 24h cooldown
		'next_at', now() + pair_cooldown
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.tickle_at_barn(uuid) TO authenticated;

-- barn_visit_status drives the arrival screen. A friend's barn is locked if you
-- visited them in the last 24h OR you've used all 3 visits this window. Returns
-- visits_left + visits_refresh_at so the client can show "2 visits left · fresh
-- in 1h 40m". The visitor's tickle-bank block is unchanged.
CREATE OR REPLACE FUNCTION public.barn_visit_status(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	pair_cooldown  constant interval := '24 hours';
	visit_window   constant interval := '3 hours';
	visit_budget   constant int := 3;
	last_visit     timestamptz;
	w_start        timestamptz;
	visits_used    int := 0;
	visits_left    int;
	window_refresh timestamptz;
	is_locked      boolean := false;
	v_next_at      timestamptz;
	v_vip          boolean;
	v_cap_bank     int;
	v_regen        int;
	v_count        int;
	v_intervals    int;
	v_bal          int;
	v_secs_since   numeric;
	v_next_regen   int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_target = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'error', 'self');
	END IF;

	-- Budget window (anchored to first visit).
	SELECT barn_visit_window_start INTO w_start
	FROM public.profiles WHERE id = caller_id;
	IF w_start IS NULL OR w_start <= now() - visit_window THEN
		visits_used := 0;            -- window expired → all 3 fresh
		window_refresh := NULL;
	ELSE
		SELECT count(*) INTO visits_used
		FROM public.barn_visits
		WHERE visitor_id = caller_id AND visit_started_at >= w_start;
		window_refresh := w_start + visit_window;
	END IF;
	visits_left := GREATEST(0, visit_budget - visits_used);

	-- This friend visited within 24h?
	SELECT max(visit_started_at) INTO last_visit
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target;

	IF last_visit IS NOT NULL AND last_visit > now() - pair_cooldown THEN
		is_locked := true;
		v_next_at := last_visit + pair_cooldown;          -- this friend, once a day
	ELSIF visits_left <= 0 THEN
		is_locked := true;
		v_next_at := window_refresh;                      -- out of visits this window
	END IF;

	-- Visitor's own tickle bank (unchanged from 20260681 / 20260608).
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
		'taps_left', CASE WHEN is_locked THEN 0 ELSE 1 END, -- one tickle available
		'tap_cap', 1,
		'resting', false,
		'locked', is_locked,
		'next_at', v_next_at,
		'visits_left', visits_left,
		'visit_budget', visit_budget,
		'visits_refresh_at', window_refresh,
		'balance', v_bal,
		'cap', v_cap_bank,
		'next_regen_seconds', v_next_regen,
		'regen_seconds', v_regen
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.barn_visit_status(uuid) TO authenticated;
