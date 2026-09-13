-- Preserve Tickle regeneration across Sluggish Snout rate transitions.
--
-- Previously every bank read divided the entire wall-clock span since
-- user_items.last_increment by the rate that happened to be active *now*.
-- Starting Sluggish Snout therefore slowed time from before the curse, while
-- cleanse, blessing cancellation, and natural expiry re-rated cursed time at
-- the normal speed and refunded Tickles the curse had suppressed.
--
-- Keep fractional progress explicitly and integrate each timed ritual segment
-- at the rate that was active in that segment. Materialization checkpoints the
-- accumulated fraction at now(); completed Tickles and cap waste are handled as
-- before. Other (non-ritual) rate inputs intentionally retain their existing
-- lazy/current-value semantics.

set check_function_bodies = off;

ALTER TABLE public.user_items
	ADD COLUMN IF NOT EXISTS regen_progress numeric NOT NULL DEFAULT 0;

DO $$ BEGIN
	ALTER TABLE public.user_items
		ADD CONSTRAINT user_items_regen_progress_check
		CHECK (regen_progress >= 0 AND regen_progress < 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS blessings_receiver_regen_history_idx
	ON public.blessings (receiver_id, sent_at, expires_at)
	WHERE kind IN ('warm_tea', 'mud_wrap', 'chorus_glow', 'war_winner_regen');

CREATE INDEX IF NOT EXISTS curses_receiver_sluggish_history_idx
	ON public.curses (receiver_id, sent_at, expires_at)
	WHERE kind = 'sluggish_snout';

-- Historical form of the latest prestige-aware regen calculator
-- (20260779000000). Only ritual activity is evaluated at p_at; wallow,
-- alignment, and happiness keep the existing current-value behavior.
CREATE OR REPLACE FUNCTION public._regen_secs_for_wallow_at(
	uid uuid,
	p_wallow_count int,
	p_at timestamptz
)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(60, floor(
		3600
		* (1.0 - public._wallow_regen_percent(p_wallow_count) / 100.0)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid
			  AND kind IN ('warm_tea', 'mud_wrap', 'chorus_glow')
			  AND sent_at <= p_at
			  AND (cleared_at IS NULL OR cleared_at > p_at)
			  AND expires_at > p_at
		   ) THEN 0.5 ELSE 1 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.curses
			WHERE receiver_id = uid AND kind = 'sluggish_snout'
			  AND sent_at <= p_at
			  AND (cleared_at IS NULL OR cleared_at > p_at)
			  AND expires_at > p_at
		   ) THEN 2 ELSE 1 END)
		* (1.0 - LEAST(10.0, GREATEST(-10.0,
			COALESCE((SELECT alignment_score FROM public.profiles WHERE id = uid), 0) * 0.4
		  )) / 100.0)
		* (1.15 - (public.happiness_now(uid) - 20) / 60.0 * 0.30)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind = 'war_winner_regen'
			  AND sent_at <= p_at
			  AND (cleared_at IS NULL OR cleared_at > p_at)
			  AND expires_at > p_at
		   ) THEN 0.85 ELSE 1 END)
	)::int);
$function$;

REVOKE ALL ON FUNCTION public._regen_secs_for_wallow_at(uuid, int, timestamptz)
	FROM PUBLIC, anon, authenticated;

-- Keep the public/current calculators byte-compatible in behavior while making
-- the timestamp-aware implementation the single source of ritual-rate truth.
CREATE OR REPLACE FUNCTION public._regen_secs_for_wallow(uid uuid, p_wallow_count int)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT public._regen_secs_for_wallow_at(uid, p_wallow_count, now());
$function$;

REVOKE ALL ON FUNCTION public._regen_secs_for_wallow(uuid, int)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.regen_secs_for(uid uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT public._regen_secs_for_wallow(
		uid,
		COALESCE((SELECT wallow_count FROM public.profiles WHERE id = uid), 0)
	);
$function$;

REVOKE ALL ON FUNCTION public.regen_secs_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regen_secs_for(uuid) TO authenticated;

-- Integrate fractional Tickles between two checkpoints. Segment boundaries are
-- the starts/ends of every regen-affecting ritual, so overlapping effects and
-- all three Sluggish Snout endings (cleanse, blessing clear, expiry) share the
-- same accounting path.
CREATE OR REPLACE FUNCTION public._tickle_regen_progress_between(
	uid uuid,
	p_from timestamptz,
	p_to timestamptz
)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	WITH effect_bounds AS (
		SELECT b.sent_at AS boundary
		FROM public.blessings b
		WHERE b.receiver_id = uid
		  AND b.kind IN ('warm_tea', 'mud_wrap', 'chorus_glow', 'war_winner_regen')
		  AND b.sent_at > p_from AND b.sent_at < p_to
		UNION
		SELECT LEAST(b.expires_at, COALESCE(b.cleared_at, b.expires_at))
		FROM public.blessings b
		WHERE b.receiver_id = uid
		  AND b.kind IN ('warm_tea', 'mud_wrap', 'chorus_glow', 'war_winner_regen')
		  AND LEAST(b.expires_at, COALESCE(b.cleared_at, b.expires_at)) > p_from
		  AND LEAST(b.expires_at, COALESCE(b.cleared_at, b.expires_at)) < p_to
		UNION
		SELECT c.sent_at
		FROM public.curses c
		WHERE c.receiver_id = uid AND c.kind = 'sluggish_snout'
		  AND c.sent_at > p_from AND c.sent_at < p_to
		UNION
		SELECT LEAST(c.expires_at, COALESCE(c.cleared_at, c.expires_at))
		FROM public.curses c
		WHERE c.receiver_id = uid AND c.kind = 'sluggish_snout'
		  AND LEAST(c.expires_at, COALESCE(c.cleared_at, c.expires_at)) > p_from
		  AND LEAST(c.expires_at, COALESCE(c.cleared_at, c.expires_at)) < p_to
	), boundaries AS (
		SELECT p_from AS boundary
		UNION SELECT p_to
		UNION SELECT boundary FROM effect_bounds
	), segments AS (
		SELECT boundary AS segment_start,
			lead(boundary) OVER (ORDER BY boundary) AS segment_end
		FROM boundaries
	)
	SELECT CASE WHEN p_to <= p_from THEN 0::numeric ELSE COALESCE(sum(
		EXTRACT(EPOCH FROM (segment_end - segment_start))
		/ public._regen_secs_for_wallow_at(
			uid,
			COALESCE((SELECT wallow_count FROM public.profiles WHERE id = uid), 0),
			segment_start + (segment_end - segment_start) / 2
		)
	), 0)::numeric END
	FROM segments
	WHERE segment_end IS NOT NULL AND segment_end > segment_start;
$function$;

REVOKE ALL ON FUNCTION public._tickle_regen_progress_between(uuid, timestamptz, timestamptz)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._tickle_regen_snapshot(
	uid uuid,
	p_last_increment timestamptz,
	p_stored_progress numeric,
	p_at timestamptz DEFAULT now()
)
RETURNS TABLE(intervals_elapsed int, fraction numeric, current_regen_secs int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	WITH accrued AS (
		SELECT GREATEST(0::numeric,
			COALESCE(p_stored_progress, 0)
			+ public._tickle_regen_progress_between(uid, p_last_increment, p_at)
		) AS total
	)
	SELECT floor(total)::int,
		total - floor(total),
		public.regen_secs_for(uid)
	FROM accrued;
$function$;

REVOKE ALL ON FUNCTION public._tickle_regen_snapshot(uuid, timestamptz, numeric, timestamptz)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tickle_balance(uid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(
		ui.item_count,
		LEAST(
			CASE WHEN COALESCE(p.is_vip, false) THEN 50 ELSE 25 END,
			ui.item_count + snap.intervals_elapsed
		)
	)
	FROM public.user_items ui
	JOIN public.profiles p ON p.id = ui.user_id
	CROSS JOIN LATERAL public._tickle_regen_snapshot(
		uid, ui.last_increment, ui.regen_progress
	) snap
	WHERE ui.user_id = uid;
$function$;

CREATE OR REPLACE FUNCTION public.tickle_info(uid uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	WITH state AS (
		SELECT
			CASE WHEN COALESCE(p.is_vip, false) THEN 50 ELSE 25 END AS cap,
			COALESCE(p.is_vip, false) AS is_vip,
			ui.item_count,
			snap.intervals_elapsed,
			snap.fraction,
			snap.current_regen_secs
		FROM public.user_items ui
		JOIN public.profiles p ON p.id = ui.user_id
		CROSS JOIN LATERAL public._tickle_regen_snapshot(
			uid, ui.last_increment, ui.regen_progress
		) snap
		WHERE ui.user_id = uid
	), balanced AS (
		SELECT *, GREATEST(item_count, LEAST(cap, item_count + intervals_elapsed)) AS balance
		FROM state
	)
	SELECT jsonb_build_object(
		'balance', balance,
		'cap', cap,
		'is_vip', is_vip,
		'next_regen_seconds', CASE
			WHEN balance >= cap THEN NULL
			ELSE GREATEST(1, ceil((1 - fraction) * current_regen_secs)::int)
		END
	)
	FROM balanced;
$function$;

CREATE OR REPLACE FUNCTION public.settle_tickles(uid uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	cap_val int;
	intervals_elapsed int;
	fraction numeric;
	prev_count int;
	settled int;
	wasted_this int;
	checkpoint timestamptz := now();
BEGIN
	cap_val := CASE WHEN COALESCE(
		(SELECT is_vip FROM public.profiles WHERE id = uid), false) THEN 50 ELSE 25 END;

	SELECT item_count INTO prev_count
	FROM public.user_items WHERE user_id = uid FOR UPDATE;

	IF prev_count IS NULL THEN
		RAISE EXCEPTION 'No user_items row for user %', uid;
	END IF;

	SELECT snap.intervals_elapsed, snap.fraction
	INTO intervals_elapsed, fraction
	FROM public.user_items ui
	CROSS JOIN LATERAL public._tickle_regen_snapshot(
		uid, ui.last_increment, ui.regen_progress, checkpoint
	) snap
	WHERE ui.user_id = uid;

	settled := GREATEST(prev_count, LEAST(cap_val, prev_count + intervals_elapsed));
	wasted_this := intervals_elapsed - (settled - prev_count);

	UPDATE public.user_items
	SET item_count = settled,
		last_increment = checkpoint,
		regen_progress = fraction
	WHERE user_id = uid;

	IF wasted_this > 0 THEN
		UPDATE public.profiles
		SET tickles_wasted_total = tickles_wasted_total + wasted_this WHERE id = uid;
	END IF;

	RETURN settled;
END;
$function$;

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
	settled := public.settle_tickles(uid);
	new_count := settled + n;
	UPDATE public.user_items SET item_count = new_count WHERE user_id = uid;
	RETURN new_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.tickle_balance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tickle_info(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.settle_tickles(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tickle_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tickle_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_tickles(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.grant_tickles(uuid, int) FROM PUBLIC, anon, authenticated;

-- Latest home-tickle body (20260772000000), with only the bank checkpoint math
-- replaced. All hardened side-effect guards and the referral gate are retained.
CREATE OR REPLACE FUNCTION public.update_profile_and_item_count(uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	is_vip boolean;
	cap_val int;
	intervals_elapsed int;
	fraction numeric;
	current_balance int;
	prev_count int;
	wasted_this int;
	new_balance int;
	active_season_id text;
	bumped_counter bigint;
	lucky_numbers integer[];
	lucky_won int := NULL;
	caller_last_date date;
	checkpoint timestamptz := now();
BEGIN
	SELECT COALESCE(profiles.is_vip, false) INTO is_vip
	FROM public.profiles WHERE id = uid;

	cap_val := CASE WHEN is_vip THEN 50 ELSE 25 END;

	SELECT item_count INTO current_balance
	FROM public.user_items
	WHERE user_id = uid
	FOR UPDATE;

	IF current_balance IS NULL THEN
		RAISE EXCEPTION 'No user_items row for user %', uid;
	END IF;

	SELECT snap.intervals_elapsed, snap.fraction
	INTO intervals_elapsed, fraction
	FROM public.user_items ui
	CROSS JOIN LATERAL public._tickle_regen_snapshot(
		uid, ui.last_increment, ui.regen_progress, checkpoint
	) snap
	WHERE ui.user_id = uid;

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
			last_increment = checkpoint,
			regen_progress = fraction
		WHERE user_id = uid;
		RETURN jsonb_build_object('balance', current_balance, 'lucky_won', null);
	END IF;

	new_balance := current_balance - 1;

	UPDATE public.user_items
	SET item_count = new_balance,
		last_increment = checkpoint,
		regen_progress = fraction
	WHERE user_id = uid;

	UPDATE public.profiles
	SET counter = counter + 1,
		tickles_earned = tickles_earned + 1
	WHERE id = uid;

	BEGIN
		PERFORM public.apply_happiness(uid, 1.0);
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'home tickle side-effect apply_happiness failed for %: %', uid, SQLERRM;
	END;

	BEGIN
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
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'home tickle side-effect season_xp failed for %: %', uid, SQLERRM;
	END;

	BEGIN
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
	EXCEPTION WHEN OTHERS THEN
		lucky_won := NULL;
		RAISE WARNING 'home tickle side-effect lucky_pig failed for %: %', uid, SQLERRM;
	END;

	BEGIN
		SELECT last_active_date INTO caller_last_date
		FROM public.profiles WHERE id = uid;

		IF caller_last_date IS DISTINCT FROM CURRENT_DATE THEN
			UPDATE public.profiles
			SET distinct_active_days = COALESCE(distinct_active_days, 0) + 1,
				last_active_date = CURRENT_DATE
			WHERE id = uid;
		END IF;
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'home tickle side-effect active_day failed for %: %', uid, SQLERRM;
	END;

	BEGIN
		PERFORM public.complete_referral_if_eligible(uid);
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'home tickle side-effect referral_gate failed for %: %', uid, SQLERRM;
	END;

	RETURN jsonb_build_object(
		'balance', new_balance,
		'lucky_won', lucky_won,
		'global_counter', bumped_counter
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_profile_and_item_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_profile_and_item_count(uuid) TO authenticated;

-- Fulfillment is the remaining live direct bank consumer. Settle first, then
-- deduct without resetting the fractional checkpoint.
CREATE OR REPLACE FUNCTION public.fulfill_tickle_trade(trade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	trade record;
	current_bal int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO trade FROM public.tickle_trades
	WHERE id = trade_id FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	IF trade.target_id <> caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_target');
	END IF;
	IF trade.status <> 'pending' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_status');
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM public.user_items WHERE user_id = caller_id
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_bank');
	END IF;
	current_bal := public.settle_tickles(caller_id);

	IF current_bal < trade.amount THEN
		RETURN jsonb_build_object(
			'ok', false, 'reason', 'insufficient_bank',
			'balance', current_bal, 'needed', trade.amount
		);
	END IF;

	UPDATE public.user_items
	SET item_count = current_bal - trade.amount
	WHERE user_id = caller_id;

	UPDATE public.profiles
	SET counter = counter + trade.amount * 2,
		tickles_earned = tickles_earned + trade.amount * 2
	WHERE id = trade.requester_id;

	UPDATE public.tickle_trades
	SET status = 'fulfilled', fulfilled_at = now()
	WHERE id = trade.id;

	RETURN jsonb_build_object(
		'ok', true,
		'trade_id', trade.id,
		'new_bank', current_bal - trade.amount,
		'asker_gained', trade.amount * 2
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.fulfill_tickle_trade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fulfill_tickle_trade(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.wasted_tickles_leaderboard(limit_n int DEFAULT 50)
RETURNS TABLE(username text, wasted bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT p.username,
		p.tickles_wasted_total + GREATEST(
			0,
			snap.intervals_elapsed - GREATEST(
				0,
				(CASE WHEN COALESCE(p.is_vip, false) THEN 50 ELSE 25 END) - ui.item_count
			)
		)::bigint AS wasted
	FROM public.profiles p
	JOIN public.user_items ui ON ui.user_id = p.id
	CROSS JOIN LATERAL public._tickle_regen_snapshot(
		p.id, ui.last_increment, ui.regen_progress
	) snap
	WHERE p.username IS NOT NULL AND p.username <> ''
	ORDER BY wasted DESC
	LIMIT limit_n;
$function$;

REVOKE ALL ON FUNCTION public.wasted_tickles_leaderboard(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wasted_tickles_leaderboard(int) TO authenticated;

-- The Barn-status implementation still inlines the pre-checkpoint bank formula.
-- Preserve its latest visit/cooldown behavior behind a private wrapper and
-- replace only the four bank fields with tickle_info's canonical snapshot.
ALTER FUNCTION public.barn_visit_status(uuid)
	RENAME TO _barn_visit_status_before_sluggish_regen;

REVOKE ALL ON FUNCTION public._barn_visit_status_before_sluggish_regen(uuid)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.barn_visit_status(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	base jsonb;
	tickle jsonb;
BEGIN
	base := public._barn_visit_status_before_sluggish_regen(p_target);
	IF caller_id IS NULL OR NOT COALESCE((base->>'ok')::boolean, false) THEN
		RETURN base;
	END IF;

	tickle := public.tickle_info(caller_id);
	RETURN base || jsonb_build_object(
		'balance', tickle->'balance',
		'cap', tickle->'cap',
		'next_regen_seconds', tickle->'next_regen_seconds',
		'regen_seconds', public.regen_secs_for(caller_id)
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.barn_visit_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.barn_visit_status(uuid) TO authenticated;
