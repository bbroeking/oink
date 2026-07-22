-- Simplify referral qualification and pay tickles instead of snouts.
--
-- Contract:
--   * Code redemption still gives the referred player 50 snouts immediately.
--   * A referral completes as soon as that player reaches 100 lifetime tickles.
--   * Completion pays the inviter 100 spendable tickles (over-cap safe), not snouts.
--   * The existing 3/5/10/25/100/500/1000 milestone ladder is unchanged.
--
-- This carries the latest update_profile_and_item_count() and
-- my_referral_summary() definitions from 20260683000000, with only the
-- referral gate/progress changes below.

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.complete_referral_if_eligible(invitee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	inviter_id          uuid;
	invitee_name        text;
	new_completion_count int;
BEGIN
	-- The guarded UPDATE is the idempotency boundary: concurrent calls can
	-- never complete or pay the same referral twice.
	UPDATE public.profiles
	SET referral_completed_at = now()
	WHERE id = invitee_id
	  AND referred_by IS NOT NULL
	  AND referral_completed_at IS NULL
	  AND COALESCE(tickles_earned, 0) >= 100
	RETURNING referred_by, username
	INTO inviter_id, invitee_name;

	IF inviter_id IS NULL THEN
		RETURN false;
	END IF;

	UPDATE public.profiles
	SET referrals_completed = referrals_completed + 1
	WHERE id = inviter_id
	RETURNING referrals_completed
	INTO new_completion_count;

	-- Per-completion reward: 100 spendable tickles, preserved over the normal
	-- bank cap by grant_tickles(). Redemption's separate +50 snouts is unchanged.
	PERFORM public.grant_tickles(inviter_id, 100);

	-- Existing milestone ladder remains unchanged.
	IF new_completion_count = 3 THEN
		INSERT INTO public.user_hats (user_id, hat_id)
		VALUES (inviter_id, 'messenger')
		ON CONFLICT (user_id, hat_id) DO NOTHING;
	ELSIF new_completion_count = 5 THEN
		UPDATE public.profiles
		SET is_vip = true,
		    slop_club_grant_until =
		        GREATEST(now(), COALESCE(slop_club_grant_until, now())) + interval '30 days'
		WHERE id = inviter_id;
	ELSIF new_completion_count = 10 THEN
		INSERT INTO public.user_titles (user_id, title_id)
		VALUES (inviter_id, 'sounder_caller')
		ON CONFLICT (user_id, title_id) DO NOTHING;
		UPDATE public.profiles SET counter = counter + 500 WHERE id = inviter_id;
	ELSIF new_completion_count = 25 THEN
		INSERT INTO public.user_titles (user_id, title_id)
		VALUES (inviter_id, 'pen_marshal')
		ON CONFLICT (user_id, title_id) DO NOTHING;
		UPDATE public.profiles SET counter = counter + 1500 WHERE id = inviter_id;
	ELSIF new_completion_count = 100 THEN
		INSERT INTO public.user_titles (user_id, title_id)
		VALUES (inviter_id, 'pied_piper')
		ON CONFLICT (user_id, title_id) DO NOTHING;
		UPDATE public.profiles
		SET is_vip = true,
		    slop_club_grant_until =
		        GREATEST(now(), COALESCE(slop_club_grant_until, now())) + interval '90 days',
		    counter = counter + 5000
		WHERE id = inviter_id;
	ELSIF new_completion_count = 500 THEN
		INSERT INTO public.user_titles (user_id, title_id)
		VALUES (inviter_id, 'patron_of_the_pen')
		ON CONFLICT (user_id, title_id) DO NOTHING;
		UPDATE public.profiles
		SET is_vip = true,
		    slop_club_grant_until =
		        GREATEST(now(), COALESCE(slop_club_grant_until, now())) + interval '180 days',
		    counter = counter + 20000
		WHERE id = inviter_id;
	ELSIF new_completion_count = 1000 THEN
		INSERT INTO public.user_titles (user_id, title_id)
		VALUES (inviter_id, 'worldbringer')
		ON CONFLICT (user_id, title_id) DO NOTHING;
		UPDATE public.profiles
		SET is_vip = true,
		    slop_club_grant_until =
		        GREATEST(now(), COALESCE(slop_club_grant_until, now())) + interval '365 days',
		    counter = counter + 100000
		WHERE id = inviter_id;
	END IF;

	INSERT INTO public.system_announcements (user_id, kind, title, body, data)
	VALUES (
		inviter_id,
		'referral_completed',
		'Your referral ' || COALESCE(invitee_name, 'a new pig') || ' made it!',
		CASE
			WHEN new_completion_count = 1000 THEN
				'You earned 100 tickles, the Worldbringer title, a year of Slop Club, and 100,000 snouts!'
			WHEN new_completion_count = 500 THEN
				'You earned 100 tickles, the Patron of the Pen title, 180 days of Slop Club, and 20,000 snouts!'
			WHEN new_completion_count = 100 THEN
				'You earned 100 tickles, the Pied Piper title, 90 days of Slop Club, and 5,000 snouts!'
			WHEN new_completion_count = 25 THEN
				'You earned 100 tickles, the Pen Marshal title, and 1,500 snouts!'
			WHEN new_completion_count = 10 THEN
				'You earned 100 tickles, the Sounder Caller title, and 500 snouts!'
			WHEN new_completion_count = 5 THEN
				'You earned 100 tickles and a free month of Slop Club!'
			WHEN new_completion_count = 3 THEN
				'You earned 100 tickles and the Messenger Hat!'
			ELSE 'You earned 100 tickles.'
		END,
		jsonb_build_object('kind', 'referral_completed', 'screen', 'account')
	);

	BEGIN
		PERFORM public.send_push_to_user(
			inviter_id,
			'Your referral ' || COALESCE(invitee_name, 'a new pig') || ' made it!',
			CASE
				WHEN new_completion_count = 1000 THEN
					'100 tickles + Worldbringer + a year of Slop Club + 100k snouts!'
				WHEN new_completion_count = 500 THEN
					'100 tickles + Patron of the Pen + 180 days Slop Club + 20k snouts!'
				WHEN new_completion_count = 100 THEN
					'100 tickles + Pied Piper + 90 days Slop Club + 5k snouts!'
				WHEN new_completion_count = 25 THEN
					'100 tickles + the Pen Marshal title + 1,500 snouts!'
				WHEN new_completion_count = 10 THEN
					'100 tickles + the Sounder Caller title + 500 snouts!'
				WHEN new_completion_count = 5 THEN
					'100 tickles + a free month of Slop Club!'
				WHEN new_completion_count = 3 THEN
					'100 tickles + the Messenger Hat!'
				ELSE 'You earned 100 tickles. Tap to see your referrals.'
			END,
			jsonb_build_object('kind', 'referral_completed', 'screen', 'account')
		);
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;

	RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_referral_if_eligible(uuid)
FROM PUBLIC, anon, authenticated;

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
	caller_last_date date;
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

	-- Keep the general active-day counter current for streaks/feedback. It is
	-- no longer part of referral qualification.
	BEGIN
		SELECT last_active_date INTO caller_last_date
		FROM public.profiles WHERE id = uid;

		IF caller_last_date IS DISTINCT FROM CURRENT_DATE THEN
			UPDATE public.profiles
			SET distinct_active_days = COALESCE(distinct_active_days, 0) + 1,
			    last_active_date     = CURRENT_DATE
			WHERE id = uid;
		END IF;
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'home tickle side-effect active_day failed for %: %', uid, SQLERRM;
	END;

	-- One legible referral gate: the referred player reaches 100 lifetime
	-- tickles. Completion + payout are idempotent inside the helper.
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
GRANT EXECUTE ON FUNCTION public.update_profile_and_item_count(uuid) TO authenticated;

-- ── my_referral_summary — carried from 20260680 + the full ladder
-- next-milestone + per-friend progress (pending_friends) + the 3 most
-- recently referred (recent_friends) for the new referrals section/page.
CREATE OR REPLACE FUNCTION public.my_referral_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id       uuid := auth.uid();
	code            text;
	uname           text;
	completed       int;
	pending         int;
	next_milestone  int;
	grant_until     timestamptz;
	pending_friends jsonb;
	recent_friends  jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT referral_code, username, referrals_completed, slop_club_grant_until
		INTO code, uname, completed, grant_until
		FROM public.profiles WHERE id = caller_id;

	IF code IS NULL OR (code LIKE 'PIGXX-%' AND uname IS NOT NULL) THEN
		IF code IS NOT NULL THEN
			UPDATE public.profiles SET referral_code = NULL WHERE id = caller_id;
		END IF;
		code := public.generate_referral_code(caller_id);
	END IF;

	SELECT COUNT(*)::int INTO pending
		FROM public.profiles
		WHERE referred_by = caller_id
		  AND referral_completed_at IS NULL;

	-- Climb the full ladder: 3 → 5 → 10 → 25 → 100 → 500 → 1000 → done.
	next_milestone := CASE
		WHEN COALESCE(completed, 0) < 3    THEN 3
		WHEN COALESCE(completed, 0) < 5    THEN 5
		WHEN COALESCE(completed, 0) < 10   THEN 10
		WHEN COALESCE(completed, 0) < 25   THEN 25
		WHEN COALESCE(completed, 0) < 100  THEN 100
		WHEN COALESCE(completed, 0) < 500  THEN 500
		WHEN COALESCE(completed, 0) < 1000 THEN 1000
		ELSE NULL
	END;

	-- Pending invited friends (redeemed, not yet completed) + their progress
	-- toward the 100-tickle completion gate (display-capped).
	SELECT COALESCE(jsonb_agg(f ORDER BY f.redeemed_at DESC NULLS LAST), '[]'::jsonb)
		INTO pending_friends
	FROM (
		SELECT username,
		       LEAST(COALESCE(tickles_earned, 0), 100)::int       AS tickles,
		       referral_redeemed_at                                AS redeemed_at
		FROM public.profiles
		WHERE referred_by = caller_id AND referral_completed_at IS NULL
	) f;

	-- The 3 most recently referred (any status) for the Account card list.
	SELECT COALESCE(jsonb_agg(r ORDER BY r.redeemed_at DESC NULLS LAST), '[]'::jsonb)
		INTO recent_friends
	FROM (
		SELECT username,
		       LEAST(COALESCE(tickles_earned, 0), 100)::int        AS tickles,
		       (referral_completed_at IS NOT NULL)                 AS completed,
		       referral_redeemed_at                                AS redeemed_at
		FROM public.profiles
		WHERE referred_by = caller_id
		ORDER BY referral_redeemed_at DESC NULLS LAST
		LIMIT 3
	) r;

	RETURN jsonb_build_object(
		'ok',                    true,
		'code',                  code,
		'referrals_completed',   COALESCE(completed, 0),
		'referrals_pending',     COALESCE(pending,   0),
		'next_milestone_at',     next_milestone,
		'slop_club_grant_until', grant_until,
		'pending_friends',       pending_friends,
		'recent_friends',        recent_friends
	);
END;
$function$;


-- Credit already-qualified referrals that were waiting only on the old
-- three-day rule. The helper's guarded UPDATE keeps this rerunnable.
DO $backfill$
DECLARE
	pending_invitee uuid;
BEGIN
	FOR pending_invitee IN
		SELECT id
		FROM public.profiles
		WHERE referred_by IS NOT NULL
		  AND referral_completed_at IS NULL
		  AND COALESCE(tickles_earned, 0) >= 100
		ORDER BY referral_redeemed_at NULLS LAST, id
	LOOP
		PERFORM public.complete_referral_if_eligible(pending_invitee);
	END LOOP;
END
$backfill$;

GRANT EXECUTE ON FUNCTION public.my_referral_summary() TO authenticated;
