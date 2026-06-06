-- Wire happiness into the home tickle + surface it in home_stats.
-- (tickle_at_barn's happiness lands with the visit tap-session rework.)

-- update_profile_and_item_count: a successful home tickle nudges happiness +1.0.
-- Body mirrors 20260580_settle_tickles with one PERFORM added in the spend path.
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
		VALUES (uid, active_season_id, 1)
		ON CONFLICT (user_id, season_id) DO UPDATE
			SET xp = public.user_season_progress.xp + 1;
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

-- home_stats: also return the (decayed) happiness so the client can band it to a
-- mood sprite. Full body from 20260597 with the 'happiness' field appended.
CREATE OR REPLACE FUNCTION public.home_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	prof      record;
	tickle    jsonb;
	season    jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT counter, tickles_earned, active_hat_id, active_glasses_id,
		active_mask_id, active_neck_id, active_aura_id, active_background_id,
		active_held_id, active_tickle_particle_id, active_flag_id
		INTO prof
		FROM public.profiles
		WHERE id = caller_id;

	tickle := public.tickle_info(caller_id);
	season := public.season_state();

	RETURN jsonb_build_object(
		'ok',                  true,
		'counter',             COALESCE(prof.counter, 0),
		'tickles_earned',      COALESCE(prof.tickles_earned, 0),
		'happiness',           public.happiness_now(caller_id),
		'active_hat_id',       prof.active_hat_id,
		'active_hat',          (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_hat_id),
		'active_glasses_id',   prof.active_glasses_id,
		'active_glasses',      (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_glasses_id),
		'active_mask_id',      prof.active_mask_id,
		'active_mask',         (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_mask_id),
		'active_neck_id',      prof.active_neck_id,
		'active_neck',         (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_neck_id),
		'active_aura_id',      prof.active_aura_id,
		'active_aura',         (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_aura_id),
		'active_background_id', prof.active_background_id,
		'active_background',   (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_background_id),
		'active_held_id',      prof.active_held_id,
		'active_held',         (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_held_id),
		'active_tickle_particle_id', prof.active_tickle_particle_id,
		'active_tickle_particle',    (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_tickle_particle_id),
		'active_flag_id',      prof.active_flag_id,
		'active_flag',         (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_flag_id),
		'balance',             COALESCE((tickle->>'balance')::int, 0),
		'cap',                 COALESCE((tickle->>'cap')::int, 25),
		'next_regen_seconds',  tickle->'next_regen_seconds',
		'current_tier',        COALESCE((season->>'current_tier')::int, 1),
		'total_tiers',         COALESCE((season->'season'->>'total_tiers')::int, 30)
	);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.home_stats() TO authenticated;
