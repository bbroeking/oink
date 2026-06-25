-- Barn visit: the 3h cooldown now starts at the VISIT START (first tap), not at
-- the cap-hitting tap. "You visited, you're done for 3 hours."
--
-- Change from 20260676: the cooldown is anchored to visit_started_at + 3h, and
-- barn_visit_status reports LOCKED for the whole 3h window regardless of taps
-- left. So the first tap opens the visit (rolls a random 3–7 cap) AND commits
-- the 3h lock; you spend the cap while you stay in that session, but once you
-- leave, re-entry is locked and any unused taps are forfeit. (Reverses the
-- 20260676 "leaving never forfeits" model, per the SKILL.md decision log.)
--
-- Carried VERBATIM from 20260676 apart from the cooldown/lock block + next_at;
-- rewards, happiness, first-tap generosity/announcement, season XP, the random
-- 3–7 cap, and the visitor-bank block are unchanged. The visit_started_at /
-- visit_cap columns from 20260676 are reused as-is.

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
	visit_cooldown  constant interval := '3 hours'; -- per-friend lock from visit start
	v_start         timestamptz;
	v_cap           int;
	taps_this_visit int;
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

	-- Per-friend visit, cooldown anchored to the VISIT START. Read the most
	-- recent visit to this friend.
	SELECT visit_started_at, visit_cap
	INTO v_start, v_cap
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target
	ORDER BY created_at DESC
	LIMIT 1;

	IF v_start IS NOT NULL AND v_start > now() - visit_cooldown THEN
		-- A visit is live (started within the last 3h). Spend the cap if taps
		-- remain in this session; once the cap is hit the visit is spent and the
		-- friend stays locked until v_start + 3h. (Re-entry after leaving is gated
		-- client-side by barn_visit_status, which reports locked for the whole
		-- window — so leaving forfeits any unused taps.)
		SELECT count(*) INTO taps_this_visit
		FROM public.barn_visits
		WHERE visitor_id = caller_id AND target_id = p_target
		  AND visit_started_at = v_start;
		IF taps_this_visit >= v_cap THEN
			RETURN jsonb_build_object(
				'ok', false, 'error', 'cooldown',
				'next_at', v_start + visit_cooldown
			);
		END IF;
	ELSE
		-- No visit within 3h → open a fresh visit and start the cooldown now.
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
		-- Cooldown is committed from the visit start, so always hand back when it
		-- ends. The client uses it to show the countdown on the cap-hitting tap;
		-- on re-entry barn_visit_status supplies the same lock time.
		'next_at', v_start + visit_cooldown
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.tickle_at_barn(uuid) TO authenticated;

-- barn_visit_status drives the client's arrival nap/lock screen. Report LOCKED
-- for the entire 3h window after a visit starts (regardless of taps left) so a
-- re-entry can't tap. Carried from 20260676 apart from this lock block; the
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

	IF v_start IS NOT NULL AND v_start > now() - visit_cooldown THEN
		-- A visit happened within the last 3h → locked for the whole window,
		-- regardless of taps left. Re-entering a barn you've already visited
		-- shows the countdown, not the tap UI (leaving forfeited any unused taps).
		SELECT count(*) INTO taps_this_visit
		FROM public.barn_visits
		WHERE visitor_id = caller_id AND target_id = p_target
		  AND visit_started_at = v_start;
		is_locked := true;
		v_next_at := v_start + visit_cooldown;
		v_taps_left := GREATEST(0, v_cap - taps_this_visit);
		v_tap_cap := v_cap;
	END IF;
	-- else: no visit within 3h → a fresh visit is available (taps_left/cap NULL;
	-- the cap is rolled on the first tap).

	-- Visitor's own tickle bank (unchanged from 20260676 / 20260608).
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
		'balance', v_bal,
		'cap', v_cap_bank,
		'next_regen_seconds', v_next_regen,
		'regen_seconds', v_regen
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.barn_visit_status(uuid) TO authenticated;
