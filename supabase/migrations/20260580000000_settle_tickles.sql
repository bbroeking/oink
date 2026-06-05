-- settle_tickles refactor: over-cap grants + lifetime wasted-tickle tracking.
--
-- Two behaviours change, both via the same one-line idea — replace the
-- balance clamp `LEAST(cap, item_count + regen)` with
-- `GREATEST(item_count, LEAST(cap, item_count + regen))`:
--
--   1. OVER-CAP GRANTS now stick. Passive regen still tops out at the cap,
--      but a balance pushed ABOVE cap by a grant is preserved on read/spend
--      and simply doesn't regen further until spent back under cap.
--   2. WASTED TICKLES are now banked. Every time regen is materialized we
--      record the intervals the cap threw away into profiles.tickles_wasted_total.
--
-- Touched (the canonical live defs, last in 20260529000000_ritual_effects_regen):
--   tickle_balance, tickle_info (reads) and update_profile_and_item_count (spend).
-- Plus new helpers settle_tickles / grant_tickles for over-cap reward grants
-- (Trough, World Cup pick'em) and a wasted_tickles_leaderboard() RPC.
--
-- NOTE: display RPCs that recompute the balance inline (home_stats,
-- admin_tickle_overview) still clamp with LEAST — they should get the same
-- GREATEST fix when the first over-cap grant ships, so over-cap users see the
-- true number. Left out here to keep this migration focused.

set check_function_bodies = off;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tickles_wasted_total bigint NOT NULL DEFAULT 0;

-- ── tickle_balance — preserve over-cap balances ────────────────────────
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
	SELECT GREATEST(
		item_count,
		LEAST(
			CASE WHEN (SELECT is_vip FROM p) THEN 50 ELSE 25 END,
			item_count + GREATEST(0, floor(
				EXTRACT(EPOCH FROM (now() - last_increment))
				/ public.regen_secs_for(uid)
			)::int)
		)
	)
	FROM public.user_items
	WHERE user_id = uid;
$function$;

-- ── tickle_info — preserve over-cap balances ───────────────────────────
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
				GREATEST(
					item_count,
					LEAST(
						(SELECT cap FROM cfg),
						item_count + GREATEST(0, floor(
							EXTRACT(EPOCH FROM (now() - last_increment)) / (SELECT regen_secs FROM cfg)
						)::int)
					)
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

-- ── update_profile_and_item_count (spend) — preserve over-cap + bank waste ──
-- Byte-identical to the 20260529000000 version EXCEPT: the materialize step
-- now uses GREATEST(...) and banks the regen the cap discarded.
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

	-- Materialize regen, PRESERVING any over-cap balance, and bank the regen
	-- the cap threw away (intervals that didn't become tickles).
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

-- ── settle_tickles: materialize regen + bank waste, NO spend. Returns the
-- settled item_count. The chokepoint for over-cap reward grants. ──────────
CREATE OR REPLACE FUNCTION public.settle_tickles(uid uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	cap_val int;
	regen_secs int;
	intervals_elapsed int;
	prev_count int;
	settled int;
	wasted_this int;
BEGIN
	cap_val := CASE WHEN COALESCE(
		(SELECT is_vip FROM public.profiles WHERE id = uid), false) THEN 50 ELSE 25 END;
	regen_secs := public.regen_secs_for(uid);

	SELECT
		GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - last_increment)) / regen_secs)::int),
		item_count
	INTO intervals_elapsed, prev_count
	FROM public.user_items WHERE user_id = uid FOR UPDATE;

	IF prev_count IS NULL THEN
		RAISE EXCEPTION 'No user_items row for user %', uid;
	END IF;

	settled := GREATEST(prev_count, LEAST(cap_val, prev_count + intervals_elapsed));
	wasted_this := intervals_elapsed - (settled - prev_count);

	UPDATE public.user_items
	SET item_count = settled,
	    last_increment = last_increment + (intervals_elapsed * (regen_secs * INTERVAL '1 second'))
	WHERE user_id = uid;

	IF wasted_this > 0 THEN
		UPDATE public.profiles
		SET tickles_wasted_total = tickles_wasted_total + wasted_this WHERE id = uid;
	END IF;

	RETURN settled;
END;
$function$;

-- ── grant_tickles: settle first, then add n WITHOUT clamping to cap, so
-- reward grants (Trough, World Cup pick'em) can push a player over cap. ───
CREATE OR REPLACE FUNCTION public.grant_tickles(uid uuid, n int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	settled int;
	new_count int;
BEGIN
	IF n <= 0 THEN
		RETURN public.settle_tickles(uid);
	END IF;
	settled := public.settle_tickles(uid);   -- materialize + bank waste, locks row
	new_count := settled + n;
	UPDATE public.user_items SET item_count = new_count WHERE user_id = uid;
	RETURN new_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.settle_tickles(uuid) TO authenticated;
-- grant_tickles is server-side reward plumbing; not granted to clients.

-- ── wasted_tickles_leaderboard: exact-to-the-second (banked total + the
-- live unsettled overflow since last touch), highest first. ──────────────
CREATE OR REPLACE FUNCTION public.wasted_tickles_leaderboard(limit_n int DEFAULT 50)
RETURNS TABLE(username text, wasted bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT p.username,
		p.tickles_wasted_total + GREATEST(0,
			floor(EXTRACT(EPOCH FROM (now() - ui.last_increment))
				/ public.regen_secs_for(p.id))::int
			- GREATEST(0,
				(CASE WHEN COALESCE(p.is_vip,false) THEN 50 ELSE 25 END) - ui.item_count))
		AS wasted
	FROM public.profiles p
	JOIN public.user_items ui ON ui.user_id = p.id
	WHERE p.username IS NOT NULL AND p.username <> ''
	ORDER BY wasted DESC
	LIMIT limit_n;
$function$;

GRANT EXECUTE ON FUNCTION public.wasted_tickles_leaderboard(int) TO authenticated;
