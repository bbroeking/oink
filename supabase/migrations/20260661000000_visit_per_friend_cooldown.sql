-- Barn visiting, reworked to "fresh burst + 3h lock per friend".
--
-- The old model fought itself: the client rolled a random 3-7 "energy" budget per
-- visit, but the server capped 7 taps per *hour* (cumulative, same barn) and only
-- 3h-cooled *different* barns — so re-tapping a barn you'd recently visited handed
-- back the hour's leftovers (the reported "only 1 tap"), and the 3h cooldown never
-- gated the same barn.
--
-- New model: a "visit" is a burst of up to per_visit_cap taps to ONE friend; a gap
-- longer than session_gap ends the visit, after which that friend is locked for
-- visit_cooldown (a real per-friend 3h gate). Per-visitor daily_cap still bounds
-- the total mint, so dropping the old global "one friend / 3h" gate doesn't widen
-- the faucet. Carried VERBATIM from 20260648 apart from the cooldown/ceiling block
-- + the taps_this_hour → taps_this_visit rename.

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
	per_visit_cap  constant int := 7;             -- max taps in one visit (client rolls 3-7 within this)
	session_gap    constant interval := '15 minutes'; -- a longer gap starts a NEW visit
	visit_cooldown constant interval := '3 hours';     -- per-friend lock after a visit ends
	daily_cap      constant int := 20;            -- max rewarded visit taps per visitor per day
	last_to_target timestamptz;
	taps_this_visit int;
	visits_today   int;
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

	-- Friends-only: the authoritative gate against minting to/from strangers.
	IF NOT public.are_friends(caller_id, p_target) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'not_friends');
	END IF;

	-- Per-friend visit model. Look at your most recent tap on THIS friend:
	--   • within session_gap  → you're mid-visit; enforce the per-visit burst cap.
	--   • within visit_cooldown (but past session_gap) → visit ended, friend locked.
	--   • older than visit_cooldown (or never) → a fresh visit, allowed.
	SELECT max(created_at) INTO last_to_target
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target;

	IF last_to_target IS NOT NULL THEN
		IF last_to_target > now() - session_gap THEN
			SELECT count(*) INTO taps_this_visit
			FROM public.barn_visits
			WHERE visitor_id = caller_id AND target_id = p_target
			  AND created_at > now() - session_gap;
			IF taps_this_visit >= per_visit_cap THEN
				RETURN jsonb_build_object('ok', false, 'error', 'tired');
			END IF;
		ELSIF last_to_target > now() - visit_cooldown THEN
			RETURN jsonb_build_object(
				'ok', false, 'error', 'cooldown', 'next_at', last_to_target + visit_cooldown
			);
		END IF;
	END IF;
	taps_this_visit := COALESCE(taps_this_visit, 0); -- fresh visit → first tap

	-- Per-visitor DAILY cap: bounds the snout mint. Reuses the 'cooldown' refusal so
	-- the client nap/lock screen shows a "come back tomorrow" timer with no change.
	SELECT count(*) INTO visits_today
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND created_at >= date_trunc('day', now());
	IF visits_today >= daily_cap THEN
		RETURN jsonb_build_object(
			'ok', false, 'error', 'cooldown',
			'next_at', date_trunc('day', now()) + INTERVAL '1 day'
		);
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

	INSERT INTO public.barn_visits (visitor_id, target_id, tickles)
	VALUES (caller_id, p_target, host_reward);

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

	RETURN jsonb_build_object(
		'ok', true,
		'tickles', host_reward,
		'visitor_tickles', visitor_reward,
		'taps_left', per_visit_cap - taps_this_visit - 1
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.tickle_at_barn(uuid) TO authenticated;

-- barn_visit_status drives the client's arrival nap/lock screen. Realign it to the
-- same per-friend model so the lock screen agrees with tickle_at_barn. Carried from
-- 20260608 apart from the lock/resting/taps_left computation; the balance/cap/regen
-- block (the visitor's own tickle bank) is unchanged.
CREATE OR REPLACE FUNCTION public.barn_visit_status(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	per_visit_cap  constant int := 7;
	session_gap    constant interval := '15 minutes';
	visit_cooldown constant interval := '3 hours';
	daily_cap      constant int := 20;
	last_to_target timestamptz;
	taps_this_visit int := 0;
	visits_today   int;
	is_locked      boolean := false;
	is_resting     boolean := false;
	v_next_at      timestamptz;
	v_taps_left    int;
	v_vip          boolean;
	v_cap          int;
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

	SELECT max(created_at) INTO last_to_target
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target;

	IF last_to_target IS NOT NULL AND last_to_target > now() - session_gap THEN
		-- mid-visit: how many of the burst are spent
		SELECT count(*) INTO taps_this_visit
		FROM public.barn_visits
		WHERE visitor_id = caller_id AND target_id = p_target
		  AND created_at > now() - session_gap;
		is_resting := taps_this_visit >= per_visit_cap;
	ELSIF last_to_target IS NOT NULL AND last_to_target > now() - visit_cooldown THEN
		-- visit ended; this friend is on the 3h cooldown
		is_locked := true;
		v_next_at := last_to_target + visit_cooldown;
	END IF;
	v_taps_left := GREATEST(0, per_visit_cap - taps_this_visit);

	-- Daily cap: out of visit taps for the day → lock until the next UTC day.
	SELECT count(*) INTO visits_today
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND created_at >= date_trunc('day', now());
	IF visits_today >= daily_cap THEN
		is_locked := true;
		v_next_at := date_trunc('day', now()) + INTERVAL '1 day';
		v_taps_left := 0;
	END IF;

	-- Visitor's own tickle bank (unchanged from 20260608).
	SELECT COALESCE(is_vip, false) INTO v_vip FROM public.profiles WHERE id = caller_id;
	v_cap := CASE WHEN v_vip THEN 50 ELSE 25 END;
	v_regen := public.regen_secs_for(caller_id);
	SELECT item_count,
	       EXTRACT(EPOCH FROM (now() - last_increment))
	INTO v_count, v_secs_since
	FROM public.user_items WHERE user_id = caller_id;
	v_intervals := GREATEST(0, floor(COALESCE(v_secs_since, 0) / v_regen)::int);
	v_bal := COALESCE(GREATEST(v_count, LEAST(v_cap, v_count + v_intervals)), 0);
	v_next_regen := CASE
		WHEN v_bal >= v_cap THEN NULL
		ELSE GREATEST(1, v_regen - (COALESCE(v_secs_since, 0)::int % v_regen))
	END;

	RETURN jsonb_build_object(
		'ok', true,
		'taps_left', v_taps_left,
		'resting', is_resting,
		'locked', is_locked,
		'next_at', v_next_at,
		'balance', v_bal,
		'cap', v_cap,
		'next_regen_seconds', v_next_regen,
		'regen_seconds', v_regen
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.barn_visit_status(uuid) TO authenticated;
