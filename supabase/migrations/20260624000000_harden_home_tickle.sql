-- Harden the home tickle so its side-effects can never roll it back.
--
-- BUG: a user reported "I can't tickle my own pig after the update — but if I
-- visit someone else, I can tickle." The home RPC (update_profile_and_item_count)
-- and the visit RPC (tickle_at_barn) share regen_secs_for + apply_happiness, and
-- visiting works — so those helpers are fine. The break can only live in a path
-- the HOME tickle runs and the VISIT tickle does not. There is exactly one such
-- path: the lucky-pig daily-counter block (daily_lucky_state / roll_lucky_numbers
-- / daily_lucky_claims). tickle_at_barn never touches it. If anything in that
-- block raises, the WHOLE transaction rolls back: the optimistic client UI
-- (oink, heart float, bounce) has already played, but counter/item_count never
-- move — so the player perceives "nothing happens when I tickle."
--
-- FIX (root-cause-agnostic): the CORE tickle (item_count--, counter++,
-- tickles_earned++) commits unconditionally. Every side-effect — happiness,
-- season XP, and the lucky-pig block — is wrapped in its own BEGIN/EXCEPTION
-- sub-block (a savepoint), so a fault in any of them rolls back ONLY that
-- side-effect and logs a WARNING, never the tickle itself. The core loop becomes
-- structurally unbreakable by side-effect faults.
--
-- This is the same resilience principle the other recent fixes apply piecemeal
-- (the inline-announcement footgun): a player-facing core action must never be
-- held hostage by a best-effort side-effect.

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

	-- ── CORE TICKLE — must ALWAYS commit. Never wrapped in a guard. ──
	UPDATE public.user_items
	SET item_count = new_balance,
	    last_increment = last_increment + (intervals_elapsed * (regen_secs * INTERVAL '1 second'))
	WHERE user_id = uid;

	UPDATE public.profiles
	SET counter = counter + 1,
	    tickles_earned = tickles_earned + 1
	WHERE id = uid;

	-- ── SIDE-EFFECTS — each guarded so a fault rolls back ONLY itself. ──

	-- Happiness: tickling your own pig is your consistency, +1.0 (window-capped).
	BEGIN
		PERFORM public.apply_happiness(uid, 1.0);
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'home tickle side-effect apply_happiness failed for %: %', uid, SQLERRM;
	END;

	-- Season XP (+3 per home tickle — see 20260613_xp_for_social_actions).
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

	-- Lucky-pig daily counter — HOME-UNIQUE (tickle_at_barn never runs this), so
	-- the prime suspect for the silent-rollback bug. Guarded: a failure here just
	-- skips the lucky roll; the tickle above still counts.
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

	RETURN jsonb_build_object(
		'balance', new_balance,
		'lucky_won', lucky_won,
		'global_counter', bumped_counter
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_profile_and_item_count(uuid) TO authenticated;
