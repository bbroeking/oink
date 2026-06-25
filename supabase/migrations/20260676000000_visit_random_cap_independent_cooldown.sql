-- Barn visiting: server-authoritative random cap + an independent per-friend 3h
-- cooldown that re-entering the barn can't reset.
--
-- The previous model (20260661) capped taps in a trailing 15-minute SLIDING
-- window and only armed the 3h lock when your last tap was 15min–3h old. That
-- leaked: tapping ~once every couple minutes never put the cap's worth of taps
-- in any 15-min window AND never let the visit "end", so the 3h lock never
-- armed — you could drip-tap a single friend up to the daily cap. Re-entering
-- didn't reset state, but the window was gameable.
--
-- New model: each VISIT rolls a server-side random cap of 3–7 taps. Those taps
-- can be spent across any number of barn entries (leaving early never forfeits
-- them). The tap that HITS the cap exhausts the visit and locks that friend for
-- 3h, anchored to that final tap — re-entry returns the same countdown, never a
-- reset. After 3h a fresh visit rolls a new random cap. The old daily_cap is
-- dropped (the per-friend gate is now the real ceiling). A visit is tracked by
-- two new barn_visits columns: visit_started_at (groups a visit's taps) and
-- visit_cap (that visit's rolled 3–7). Pre-migration rows have NULL for both,
-- so everyone simply starts a fresh visit after deploy (a one-time reset).
--
-- Carried VERBATIM from 20260661 apart from the cap/cooldown block and the
-- INSERT (now stamps visit_started_at + visit_cap); the rewards, happiness,
-- first-tap generosity/announcement, season XP, and the barn_visit_status
-- visitor-bank block are unchanged.

ALTER TABLE public.barn_visits
	ADD COLUMN IF NOT EXISTS visit_started_at timestamptz,
	ADD COLUMN IF NOT EXISTS visit_cap        int;

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
	visit_cooldown  constant interval := '3 hours'; -- per-friend lock after the cap is hit
	v_start         timestamptz;
	v_cap           int;
	taps_this_visit int;
	exhausted_at    timestamptz;
	taps_left       int;
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

	-- Per-friend visit with a server-rolled random cap. Read the most recent
	-- visit to this friend (its start + cap). A visit's taps all share its
	-- visit_started_at; the cap is the same on every row of the visit.
	SELECT visit_started_at, visit_cap
	INTO v_start, v_cap
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target
	ORDER BY created_at DESC
	LIMIT 1;

	IF v_start IS NOT NULL THEN
		SELECT count(*) INTO taps_this_visit
		FROM public.barn_visits
		WHERE visitor_id = caller_id AND target_id = p_target
		  AND visit_started_at = v_start;

		IF taps_this_visit >= v_cap THEN
			-- Visit exhausted. Locked until the cap-hitting tap + 3h. Anchored
			-- to that tap (not "now"), so re-entry returns the same countdown.
			SELECT max(created_at) INTO exhausted_at
			FROM public.barn_visits
			WHERE visitor_id = caller_id AND target_id = p_target
			  AND visit_started_at = v_start;
			IF exhausted_at + visit_cooldown > now() THEN
				RETURN jsonb_build_object(
					'ok', false, 'error', 'cooldown',
					'next_at', exhausted_at + visit_cooldown
				);
			END IF;
			-- Cooldown elapsed → fall through and roll a fresh visit.
			v_start := NULL;
		END IF;
	END IF;

	IF v_start IS NULL THEN
		-- Fresh visit: roll a random cap of 3–7 taps.
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
		-- This tap exhausted the visit → hand back the lock time so the client
		-- shows the 3h countdown immediately, no second round-trip.
		'next_at', CASE WHEN taps_left = 0 THEN now() + visit_cooldown ELSE NULL END
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.tickle_at_barn(uuid) TO authenticated;

-- barn_visit_status drives the client's arrival nap/lock screen. Realign it to
-- the random-cap + visit-anchored cooldown model so the lock screen agrees with
-- tickle_at_barn. Carried from 20260661 apart from the lock/taps_left block; the
-- visitor's own tickle-bank block (balance/cap/regen) is unchanged.
CREATE OR REPLACE FUNCTION public.barn_visit_status(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id       uuid := auth.uid();
	visit_cooldown  constant interval := '3 hours';
	v_start         timestamptz;
	v_cap           int;
	taps_this_visit int := 0;
	exhausted_at    timestamptz;
	is_locked       boolean := false;
	v_next_at       timestamptz;
	v_taps_left     int;
	v_tap_cap       int;
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

	IF v_start IS NOT NULL THEN
		SELECT count(*) INTO taps_this_visit
		FROM public.barn_visits
		WHERE visitor_id = caller_id AND target_id = p_target
		  AND visit_started_at = v_start;

		IF taps_this_visit >= v_cap THEN
			SELECT max(created_at) INTO exhausted_at
			FROM public.barn_visits
			WHERE visitor_id = caller_id AND target_id = p_target
			  AND visit_started_at = v_start;
			IF exhausted_at + visit_cooldown > now() THEN
				-- Exhausted + still within 3h → locked, show the countdown.
				is_locked := true;
				v_next_at := exhausted_at + visit_cooldown;
				v_taps_left := 0;
				v_tap_cap := v_cap;
			END IF;
			-- else: cooldown elapsed → a fresh visit is available (taps_left/cap
			-- stay NULL; the cap is rolled on the next tap).
		ELSE
			-- Mid-visit: taps remain on the current rolled cap.
			v_taps_left := v_cap - taps_this_visit;
			v_tap_cap := v_cap;
		END IF;
	END IF;

	-- Visitor's own tickle bank (unchanged from 20260661 / 20260608).
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
		'resting', false,        -- no 15-min "resting" state anymore; exhausted == locked
		'locked', is_locked,
		'next_at', v_next_at,
		'balance', v_bal,
		'cap', v_cap_bank,
		'next_regen_seconds', v_next_regen,
		'regen_seconds', v_regen
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.barn_visit_status(uuid) TO authenticated;
