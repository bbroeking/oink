-- Season-pass XP boost + social sources (Season 1 mid-season). Goal: make the
-- 3,000-XP pass actually COMPLETABLE for an active player in the time left, and
-- stop punishing social play. Weighted by value; daily-capped where farmable.
--   home tickle (update_profile_and_item_count): +1 -> +3
--   visit tap (tickle_at_barn):  visitor +5   (the social loop, costs a tickle)
--   dig_truffle:                 digger  +3   (FIRST dig per day)
--   bury_truffle:                host    +5   (FIRST bury per day — snout sink)
--   send_blessing:               sender  +5   (1/day)
--   send_curse:                  sender  +2   (1/day)
-- Engaged daily ceiling ~100-120 XP → an active player completes the pass this
-- season; bank/regen + cooldowns keep it from being farmable. Referral (+50)
-- deferred to its own pass. XP-per-tier = 100 (curve unchanged).

CREATE OR REPLACE FUNCTION public.grant_season_xp(uid uuid, amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	active_season_id text;
BEGIN
	IF uid IS NULL OR amount IS NULL OR amount <= 0 THEN RETURN; END IF;
	SELECT id INTO active_season_id
	FROM public.seasons
	WHERE starts_at <= now() AND ends_at >= now()
	ORDER BY starts_at DESC LIMIT 1;
	IF active_season_id IS NULL THEN RETURN; END IF;
	INSERT INTO public.user_season_progress (user_id, season_id, xp)
	VALUES (uid, active_season_id, amount)
	ON CONFLICT (user_id, season_id) DO UPDATE
		SET xp = public.user_season_progress.xp + amount;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.grant_season_xp(uuid, int) TO authenticated;


-- == update_profile_and_item_count ==
CREATE OR REPLACE FUNCTION public.update_profile_and_item_count(uid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
	is_vip boolean;
	cap_val int;
	regen_secs int;
	intervals_elapsed int;
	current_balance int;
	prev_count int;
	wasted_this int;
	new_balance int;
	active_season_id text;
	bumped_counter bigint;
	lucky_numbers integer[];
	lucky_won int := NULL;
BEGIN
	SELECT COALESCE(profiles.is_vip, false) INTO is_vip
	FROM public.profiles WHERE id = uid;

	cap_val := CASE WHEN is_vip THEN 50 ELSE 25 END;
	regen_secs := public.regen_secs_for(uid);

	SELECT
		GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / regen_secs)::int),
		item_count
	INTO intervals_elapsed, current_balance
	FROM public.user_items
	WHERE user_id = uid
	FOR UPDATE;

	IF current_balance IS NULL THEN
		RAISE EXCEPTION 'No user_items row for user %', uid;
	END IF;

	prev_count := current_balance;
	current_balance := GREATEST(prev_count, LEAST(cap_val, prev_count + intervals_elapsed));
	wasted_this := intervals_elapsed - (current_balance - prev_count);
	IF wasted_this > 0 THEN
		UPDATE public.profiles
		SET tickles_wasted_total = tickles_wasted_total + wasted_this
		WHERE id = uid;
	END IF;

	IF current_balance <= 0 THEN
		UPDATE public.user_items
		SET item_count = current_balance,
		    last_increment = last_increment + (intervals_elapsed * (regen_secs * INTERVAL '1 second'))
		WHERE user_id = uid;
		RETURN jsonb_build_object('balance', current_balance, 'lucky_won', null);
	END IF;

	new_balance := current_balance - 1;

	UPDATE public.user_items
	SET item_count = new_balance,
	    last_increment = last_increment + (intervals_elapsed * (regen_secs * INTERVAL '1 second'))
	WHERE user_id = uid;

	UPDATE public.profiles
	SET counter = counter + 1,
	    tickles_earned = tickles_earned + 1
	WHERE id = uid;

	-- Happiness: tickling your own pig is your consistency, +1.0 (window-capped).
	PERFORM public.apply_happiness(uid, 1.0);

	SELECT id INTO active_season_id
	FROM public.seasons
	WHERE starts_at <= now() AND ends_at >= now()
	ORDER BY starts_at DESC LIMIT 1;

	IF active_season_id IS NOT NULL THEN
		INSERT INTO public.user_season_progress (user_id, season_id, xp)
		VALUES (uid, active_season_id, 3)
		ON CONFLICT (user_id, season_id) DO UPDATE
			SET xp = public.user_season_progress.xp + 3;
	END IF;

	INSERT INTO public.daily_lucky_state (d, global_counter, numbers)
	     VALUES (CURRENT_DATE, 1, public.roll_lucky_numbers())
	ON CONFLICT (d) DO UPDATE
	     SET global_counter = daily_lucky_state.global_counter + 1
	  RETURNING global_counter, numbers
	     INTO bumped_counter, lucky_numbers;

	IF bumped_counter = ANY(lucky_numbers) THEN
		INSERT INTO public.daily_lucky_claims (d, number, user_id)
		VALUES (CURRENT_DATE, bumped_counter::int, uid)
		ON CONFLICT (d, number) DO NOTHING;

		IF EXISTS (
			SELECT 1 FROM public.daily_lucky_claims
				WHERE d = CURRENT_DATE
				  AND number = bumped_counter::int
				  AND user_id = uid
		) THEN
			lucky_won := bumped_counter::int;
			UPDATE public.profiles
			SET counter = counter + 5,
			    tickles_earned = tickles_earned + 5
			WHERE id = uid;
		END IF;
	END IF;

	RETURN jsonb_build_object(
		'balance', new_balance,
		'lucky_won', lucky_won,
		'global_counter', bumped_counter
	);
END;
$function$;

-- == tickle_at_barn ==
CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	host_reward    constant int := 1;
	tired_cap      constant int := 7;
	visit_cooldown constant interval := '3 hours';
	taps_this_hour int;
	last_other_at  timestamptz;
	v_vip          boolean;
	v_cap          int;
	v_regen        int;
	v_count        int;
	v_intervals    int;
	v_bal          int;
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

	-- One person every 3 hours: if you've tickled a DIFFERENT barn inside the
	-- cooldown, you can't start on this one yet. Re-tapping the same barn is ok.
	SELECT max(created_at) INTO last_other_at
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id <> p_target;
	IF last_other_at IS NOT NULL AND last_other_at > now() - visit_cooldown THEN
		RETURN jsonb_build_object(
			'ok', false, 'error', 'cooldown', 'next_at', last_other_at + visit_cooldown
		);
	END IF;

	-- Per-barn tired ceiling: at most tired_cap taps/hour on the same barn.
	SELECT count(*) INTO taps_this_hour
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target
	  AND created_at > now() - INTERVAL '1 hour';
	IF taps_this_hour >= tired_cap THEN
		RETURN jsonb_build_object('ok', false, 'error', 'tired');
	END IF;

	-- Cost: spend one of the visitor's tickles (materialize regen, then deduct).
	SELECT COALESCE(is_vip, false) INTO v_vip FROM public.profiles WHERE id = caller_id;
	v_cap := CASE WHEN v_vip THEN 50 ELSE 25 END;
	v_regen := public.regen_secs_for(caller_id);
	SELECT item_count,
	       GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / v_regen)::int)
	INTO v_count, v_intervals
	FROM public.user_items WHERE user_id = caller_id FOR UPDATE;

	IF v_count IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'no_tickles');
	END IF;
	v_bal := GREATEST(v_count, LEAST(v_cap, v_count + v_intervals));
	IF v_bal < 1 THEN
		RETURN jsonb_build_object('ok', false, 'error', 'no_tickles');
	END IF;

	UPDATE public.user_items
	SET item_count = v_bal - 1,
	    last_increment = last_increment + (v_intervals * (v_regen * INTERVAL '1 second'))
	WHERE user_id = caller_id;

	-- Transfer the tickle to the host; both pigs get happier.
	PERFORM public.grant_tickles(p_target, host_reward);
	PERFORM public.apply_happiness(caller_id, 1.0);
	PERFORM public.apply_happiness(p_target, 0.25);

	INSERT INTO public.barn_visits (visitor_id, target_id, tickles)
	VALUES (caller_id, p_target, host_reward);

	-- First tap of the session: generosity + notify (once).
	IF taps_this_hour = 0 THEN
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
		'visitor_balance', v_bal - 1,
		'taps_left', tired_cap - taps_this_hour - 1
	);
END;
$function$;

-- == dig_truffle ==
CREATE OR REPLACE FUNCTION public.dig_truffle(p_host uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	share        constant numeric := 0.40;  -- fraction of remaining per dig
	floor_all    constant int := 5;         -- under this many left → take the rest
	v_truffle_id bigint;
	v_remaining  int;
	v_take       int;
	v_left       int;
	host_name    text;
	first_today  boolean;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_host = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'error', 'self');
	END IF;

	-- Lock the host's active truffle so concurrent diggers serialise.
	SELECT id, remaining INTO v_truffle_id, v_remaining
	FROM public.truffles
	WHERE host_id = p_host AND dug_at IS NULL
	FOR UPDATE;

	IF v_truffle_id IS NULL OR v_remaining <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'error', 'none');
	END IF;

	-- One share per visitor.
	IF EXISTS (
		SELECT 1 FROM public.truffle_digs
		WHERE truffle_id = v_truffle_id AND digger_id = caller_id
	) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'already_dug');
	END IF;

	-- Your share of what's left.
	IF v_remaining < floor_all THEN
		v_take := v_remaining;
	ELSE
		v_take := GREATEST(1, round(v_remaining * share)::int);
	END IF;
	v_take := LEAST(v_take, v_remaining);
	v_left := v_remaining - v_take;

	UPDATE public.truffles
		SET remaining = v_left,
		    dug_by    = caller_id,
		    dug_at    = CASE WHEN v_left <= 0 THEN now() ELSE dug_at END
		WHERE id = v_truffle_id;

	SELECT NOT EXISTS (
		SELECT 1 FROM public.truffle_digs
		WHERE digger_id = caller_id
		  AND (dug_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
	) INTO first_today;

	INSERT INTO public.truffle_digs (truffle_id, digger_id, amount)
		VALUES (v_truffle_id, caller_id, v_take);

	-- Pay the digger; thank the host (generous, tied to a real dig) + notify.
	UPDATE public.profiles SET counter = counter + v_take WHERE id = caller_id;
	PERFORM public.shift_alignment(p_host, 1);

	SELECT username INTO host_name FROM public.profiles WHERE id = caller_id;
	PERFORM public.send_system_announcement(
		p_host, 'truffle_dug',
		'Your truffle was found! 🐽',
		COALESCE(host_name, 'A visitor') || ' dug up ' || v_take || ' snouts from your truffle.',
		'{}'::jsonb
	);

	IF first_today THEN PERFORM public.grant_season_xp(caller_id, 3); END IF;

	RETURN jsonb_build_object('ok', true, 'reward', v_take, 'remaining', v_left);
END;
$function$;

-- == bury_truffle ==
CREATE OR REPLACE FUNCTION public.bury_truffle(p_amount integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	have_active boolean;
	paid        int;
	first_today boolean;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_amount NOT IN (10, 20, 50) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'bad_amount');
	END IF;

	SELECT EXISTS (
		SELECT 1 FROM public.truffles WHERE host_id = caller_id AND dug_at IS NULL
	) INTO have_active;
	IF have_active THEN
		RETURN jsonb_build_object('ok', false, 'error', 'already_buried');
	END IF;

	UPDATE public.profiles
		SET counter = counter - p_amount
		WHERE id = caller_id AND counter >= p_amount
		RETURNING counter INTO paid;
	IF paid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'too_poor', 'cost', p_amount);
	END IF;

	SELECT NOT EXISTS (
		SELECT 1 FROM public.truffles
		WHERE host_id = caller_id
		  AND (buried_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
	) INTO first_today;

	INSERT INTO public.truffles (host_id, reward, remaining) VALUES (caller_id, p_amount, p_amount);
	IF first_today THEN PERFORM public.grant_season_xp(caller_id, 5); END IF;
	RETURN jsonb_build_object('ok', true, 'reward', p_amount, 'balance', paid);
END;
$function$;

-- == send_blessing ==
CREATE OR REPLACE FUNCTION public.send_blessing(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	kind_today   text := public.daily_blessing_kind();
	casts_today  int;
	cast_cap     int;
	new_id       uuid;
	exp          timestamptz;
	bf           numeric;
	base         interval;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF caller_id = target_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;
	IF NOT public.are_friends(caller_id, target_user_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;

	cast_cap := 1;
	SELECT COUNT(*) INTO casts_today
		FROM public.blessings
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
	IF casts_today >= cast_cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
	END IF;

	-- Generous blessers cast LONGER blessings; greedy ones shorter. Only the
	-- timed kinds use it; halo_kiss + bountiful_snouts are instant (NULL).
	bf := 1 + (COALESCE(
		(SELECT alignment_score FROM public.profiles WHERE id = caller_id), 0) / 100.0) * 0.5;
	base := CASE kind_today
		WHEN 'warm_tea'  THEN interval '3 hours'
		WHEN 'sun_beam'  THEN interval '4 hours'
		ELSE NULL                          -- halo_kiss (+5 tickles) + bountiful_snouts (+5 snouts)
	END;
	exp := CASE WHEN base IS NULL THEN NULL ELSE now() + (base * bf) END;

	BEGIN
		INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
			VALUES (caller_id, target_user_id, kind_today, exp)
			RETURNING id INTO new_id;
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_blessed_today');
	END;

	-- Instant payouts.
	IF kind_today = 'bountiful_snouts' THEN
		UPDATE public.profiles SET counter = counter + 5
			WHERE id = target_user_id;
	ELSIF kind_today = 'halo_kiss' THEN
		PERFORM public.grant_tickles(target_user_id, 5);
	END IF;

	PERFORM public.shift_alignment(caller_id, 1);
	PERFORM public.grant_season_xp(caller_id, 5);

	RETURN jsonb_build_object('ok', true, 'kind', kind_today, 'blessing_id', new_id);
END;
$function$;

-- == send_curse ==
CREATE OR REPLACE FUNCTION public.send_curse(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
	caller_id     uuid := auth.uid();
	kind_today    text := public.daily_curse_kind();
	casts_today   int;
	cast_cap      int;
	taken_today   int;
	this_take     int := 0;
	new_id        uuid;
	exp           timestamptz;
	cf            numeric;
	base          interval;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF caller_id = target_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;
	IF NOT public.are_friends(caller_id, target_user_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;

	cast_cap := 1;
	SELECT COUNT(*) INTO casts_today
		FROM public.curses
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
	IF casts_today >= cast_cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
	END IF;

	-- Greedy cursers cast LONGER curses; generous ones shorter.
	cf := 1 - (COALESCE(
		(SELECT alignment_score FROM public.profiles WHERE id = caller_id), 0) / 100.0) * 0.5;
	base := CASE kind_today
		WHEN 'sluggish_snout' THEN interval '3 hours'
		WHEN 'goblin_whisper' THEN interval '4 hours'
		WHEN 'phantom_itch'   THEN interval '6 hours'
		ELSE NULL                                               -- coin_pinch (instant)
	END;
	exp := CASE WHEN base IS NULL THEN NULL ELSE now() + (base * cf) END;

	IF kind_today = 'coin_pinch' THEN
		SELECT COALESCE(SUM(snouts_taken), 0) INTO taken_today
			FROM public.curses
			WHERE receiver_id = target_user_id
			  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
		this_take := LEAST(3, GREATEST(0, 10 - taken_today));
	END IF;

	BEGIN
		INSERT INTO public.curses
			(sender_id, receiver_id, kind, expires_at, snouts_taken)
			VALUES (caller_id, target_user_id, kind_today, exp, this_take)
			RETURNING id INTO new_id;
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_cursed_today');
	END;

	IF this_take > 0 THEN
		UPDATE public.profiles
			SET counter = GREATEST(0, counter - this_take)
			WHERE id = target_user_id;
	END IF;

	PERFORM public.shift_alignment(caller_id, -1);
	PERFORM public.grant_season_xp(caller_id, 2);

	RETURN jsonb_build_object(
		'ok', true, 'kind', kind_today, 'curse_id', new_id,
		'snouts_taken', this_take
	);
END;
$function$;
