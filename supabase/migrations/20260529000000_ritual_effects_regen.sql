-- Season-1 social redesign, Phase D — wire the regen-rate rituals.
--
-- Until now warm_tea / sluggish_snout recorded an effect that nothing
-- honored. This makes them real: the tickle-bank regen interval is
-- now computed by regen_secs_for(uid), which factors active rituals
-- on top of the VIP rate.
--
--   base            3600s   (VIP: 1800s)
--   warm_tea active  × 0.5   (a blessing — tickles brew twice as fast)
--   sluggish_snout   × 2     (a curse — tickles crawl)
--   floor            60s     (never a degenerate interval)
--
-- The three regen RPCs (tickle_balance / tickle_info /
-- update_profile_and_item_count, all last defined in
-- 20260504010000_vip.sql) are re-created here with ONLY the regen
-- source swapped to regen_secs_for(uid). Cap logic, balance math,
-- the FOR UPDATE lock, and the battle-pass XP write are byte-identical
-- to the VIP versions.

set check_function_bodies = off;

-- ── One source of truth for the effective regen interval ───────────
CREATE OR REPLACE FUNCTION public.regen_secs_for(uid uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(60, floor(
		(CASE WHEN COALESCE(
			(SELECT is_vip FROM public.profiles WHERE id = uid), false)
		 THEN 1800 ELSE 3600 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind = 'warm_tea'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.5 ELSE 1 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.curses
			WHERE receiver_id = uid AND kind = 'sluggish_snout'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 2 ELSE 1 END)
	)::int);
$function$;

GRANT EXECUTE ON FUNCTION public.regen_secs_for(uuid) TO authenticated;

-- ── tickle_balance — regen source swapped ──────────────────────────
CREATE OR REPLACE FUNCTION public.tickle_balance(uid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	WITH p AS (
		SELECT COALESCE(pr.is_vip, false) AS is_vip
		FROM public.profiles pr WHERE pr.id = uid
	)
	SELECT LEAST(
		CASE WHEN (SELECT is_vip FROM p) THEN 50 ELSE 25 END,
		item_count + GREATEST(0, floor(
			EXTRACT(EPOCH FROM (now() - last_increment))
			/ public.regen_secs_for(uid)
		)::int)
	)
	FROM public.user_items
	WHERE user_id = uid;
$function$;

-- ── tickle_info — regen source swapped ─────────────────────────────
CREATE OR REPLACE FUNCTION public.tickle_info(uid uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	WITH
		p AS (
			SELECT COALESCE(pr.is_vip, false) AS is_vip
			FROM public.profiles pr WHERE pr.id = uid
		),
		cfg AS (
			SELECT
				CASE WHEN (SELECT is_vip FROM p) THEN 50 ELSE 25 END AS cap,
				public.regen_secs_for(uid) AS regen_secs
		),
		bal AS (
			SELECT
				LEAST(
					(SELECT cap FROM cfg),
					item_count + GREATEST(0, floor(
						EXTRACT(EPOCH FROM (now() - last_increment)) / (SELECT regen_secs FROM cfg)
					)::int)
				) AS balance,
				last_increment
			FROM public.user_items
			WHERE user_id = uid
		)
	SELECT jsonb_build_object(
		'balance', (SELECT balance FROM bal),
		'cap', (SELECT cap FROM cfg),
		'is_vip', (SELECT is_vip FROM p),
		'next_regen_seconds',
			CASE
				WHEN (SELECT balance FROM bal) >= (SELECT cap FROM cfg) THEN NULL
				ELSE (SELECT regen_secs FROM cfg)
				     - (EXTRACT(EPOCH FROM (now() - (SELECT last_increment FROM bal)))::int
				        % (SELECT regen_secs FROM cfg))
			END
	);
$function$;

-- ── update_profile_and_item_count — regen source swapped ───────────
-- Body is the LIVE remote definition (the jsonb-returning daily-lucky
-- version — verified via pg_get_functiondef, NOT the older vip.sql
-- integer version). The ONLY change vs live is the regen_secs source.
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

	current_balance := LEAST(cap_val, current_balance + intervals_elapsed);

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

	-- Personal: balance counter + lifetime tickles
	UPDATE public.profiles
	SET counter = counter + 1,
	    tickles_earned = tickles_earned + 1
	WHERE id = uid;

	-- Battle pass XP
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

	-- Global daily lucky counter — atomic insert-or-bump.
	INSERT INTO public.daily_lucky_state (d, global_counter, numbers)
	     VALUES (CURRENT_DATE, 1, public.roll_lucky_numbers())
	ON CONFLICT (d) DO UPDATE
	     SET global_counter = daily_lucky_state.global_counter + 1
	  RETURNING global_counter, numbers
	     INTO bumped_counter, lucky_numbers;

	-- Did this tickle land on a lucky number?
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
