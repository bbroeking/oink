-- Referral reward: a FREE MONTH of Slop Club at the inviter's 5th
-- completed referral (player ask, build 101). Completes the deferred
-- "5-invite Slop Club trial" in docs/referrals.md.
--
-- MODEL
--   is_vip (boolean) is the single live perk flag every gate reads
--   (cap 50, 5 ritual casts, premium track, leaderboard star). It is
--   WEBHOOK-OWNED for paying subscribers (revenuecat-webhook flips it on
--   purchase/expiration). A referral grant ALSO sets is_vip = true so the
--   perks light up immediately — but records its OWN expiry in the new
--   profiles.slop_club_grant_until, kept SEPARATE from the store's
--   vip_until so the two writers never confuse a comped month for a paid
--   subscription:
--     • nightly cron expires is_vip ONLY for pure-grant users
--       (vip_until IS NULL) whose grant has lapsed — store subscribers
--       (vip_until set) are never touched, the webhook stays their sole
--       writer.
--     • the webhook's deactivation handler is taught (separately, in the
--       edge function) NOT to stomp an active grant.
--
-- update_profile_and_item_count + my_referral_summary are carried forward
-- VERBATIM from their latest definitions (20260644 / 20260566) with only
-- the additive grant + milestone surfacing — carry-latest-def discipline,
-- so no earlier feature is silently dropped.

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS slop_club_grant_until timestamptz;

-- ── update_profile_and_item_count — carried from 20260644 + the 5th-
-- referral free-month grant inside the (already guarded) referral block.
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
	-- Engagement-gate locals (restored — see header).
	caller_referred       uuid;
	caller_completed_at   timestamptz;
	caller_tickles_total  bigint;
	caller_active_days    int;
	caller_last_date      date;
	inviter_name          text;
	invitee_name          text;
	new_completion_count  int;
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

	-- ── Referral engagement gate (RESTORED) — guarded like every other
	-- side-effect: a fault here can never roll back the tickle.
	BEGIN
		SELECT referred_by, referral_completed_at, tickles_earned,
		       distinct_active_days, last_active_date, username
			INTO caller_referred, caller_completed_at, caller_tickles_total,
			     caller_active_days, caller_last_date, invitee_name
			FROM public.profiles WHERE id = uid;

		IF caller_last_date IS DISTINCT FROM CURRENT_DATE THEN
			UPDATE public.profiles
				SET distinct_active_days = COALESCE(distinct_active_days, 0) + 1,
				    last_active_date     = CURRENT_DATE
				WHERE id = uid;
			caller_active_days := COALESCE(caller_active_days, 0) + 1;
		END IF;

		IF caller_referred IS NOT NULL
		   AND caller_completed_at IS NULL
		   AND caller_tickles_total >= 100
		   AND caller_active_days >= 3
		THEN
			UPDATE public.profiles
				SET referral_completed_at = now()
				WHERE id = uid;

			UPDATE public.profiles
				SET counter             = counter + 100,
				    referrals_completed = referrals_completed + 1
				WHERE id = caller_referred
				RETURNING referrals_completed, username
					INTO new_completion_count, inviter_name;

			IF new_completion_count = 3 THEN
				INSERT INTO public.user_hats (user_id, hat_id)
					VALUES (caller_referred, 'messenger')
					ON CONFLICT (user_id, hat_id) DO NOTHING;
			END IF;

			-- NEW: free month of Slop Club at the 5th completed referral.
			-- is_vip lights up every perk immediately; slop_club_grant_until
			-- is the grant's own expiry (nightly cron + webhook honor it,
			-- separate from the store's vip_until). Fires once, at exactly 5.
			IF new_completion_count = 5 THEN
				UPDATE public.profiles
					SET is_vip = true,
					    slop_club_grant_until =
					        GREATEST(now(), COALESCE(slop_club_grant_until, now()))
					        + interval '30 days'
					WHERE id = caller_referred;
			END IF;

			-- NEW: inline announcement so the inviter SEES the payoff at
			-- next launch (While-Away/Inbox) — the old gate only pushed.
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (
				caller_referred, 'referral_completed',
				'Your friend ' || COALESCE(invitee_name, 'a pig') || ' made it! 🎉',
				CASE
					WHEN new_completion_count = 5
						THEN 'Your referral paid out: +100 snouts AND a free month of Slop Club! ★'
					WHEN new_completion_count = 3
						THEN 'Your referral paid out: +100 snouts AND the Messenger Hat! 2 more for a free month of Slop Club.'
					WHEN new_completion_count = 4
						THEN 'Your referral paid out: +100 snouts. 1 more for a free month of Slop Club.'
					WHEN new_completion_count < 3
						THEN 'Your referral paid out: +100 snouts. ' ||
							 (3 - new_completion_count) || ' more for the Messenger Hat.'
					ELSE 'Your referral paid out: +100 snouts.'
				END,
				jsonb_build_object('kind', 'referral_completed', 'screen', 'account')
			);

			BEGIN
				PERFORM public.send_push_to_user(
					caller_referred,
					'Your friend ' || COALESCE(invitee_name, 'a pig') || ' made it!',
					CASE
						WHEN new_completion_count = 5
							THEN '+100 snouts AND a free month of Slop Club! Tap to see.'
						WHEN new_completion_count = 3
							THEN '+100 snouts AND the Messenger Hat. Tap to see.'
						ELSE '+100 snouts. Tap to see your sounder.'
					END,
					jsonb_build_object('kind', 'referral_completed', 'screen', 'account')
				);
			EXCEPTION WHEN OTHERS THEN
				NULL;
			END;
		END IF;
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

-- ── my_referral_summary — carried from 20260566 + the free-month
-- milestone (next stop becomes 5 once the Hat at 3 is past) and the
-- grant expiry so the Account card can show "free month active until X".
CREATE OR REPLACE FUNCTION public.my_referral_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	code           text;
	uname          text;
	completed      int;
	pending        int;
	next_milestone int;
	grant_until    timestamptz;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT referral_code, username, referrals_completed, slop_club_grant_until
		INTO code, uname, completed, grant_until
		FROM public.profiles WHERE id = caller_id;

	-- Lazy generation: backfill never seen, or PIGXX prefix from
	-- pre-username signup that now has a username.
	IF code IS NULL OR (code LIKE 'PIGXX-%' AND uname IS NOT NULL) THEN
		-- For the PIGXX upgrade we have to clear the old code first
		-- so generate_referral_code's idempotency check falls through.
		IF code IS NOT NULL THEN
			UPDATE public.profiles SET referral_code = NULL WHERE id = caller_id;
		END IF;
		code := public.generate_referral_code(caller_id);
	END IF;

	-- Pending = redeemed-but-not-completed referrals pointing at me.
	SELECT COUNT(*)::int INTO pending
		FROM public.profiles
		WHERE referred_by = caller_id
		  AND referral_completed_at IS NULL;

	-- Milestones: 3 = Messenger Hat, 5 = free month of Slop Club; null past it.
	next_milestone := CASE
		WHEN COALESCE(completed, 0) < 3 THEN 3
		WHEN COALESCE(completed, 0) < 5 THEN 5
		ELSE NULL
	END;

	RETURN jsonb_build_object(
		'ok',                    true,
		'code',                  code,
		'referrals_completed',   COALESCE(completed, 0),
		'referrals_pending',     COALESCE(pending,   0),
		'next_milestone_at',     next_milestone,
		'slop_club_grant_until', grant_until
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.my_referral_summary() TO authenticated;

-- ── Nightly expiry for referral-granted Slop Club months.
-- Touches ONLY pure-grant users (vip_until IS NULL) whose grant has
-- lapsed — store subscribers (vip_until set) are never touched, so the
-- RC webhook stays their sole is_vip writer and renewal lag can't race
-- this. pg_cron is already installed (see 20260579); cron.schedule
-- upserts by job name, so re-applying is safe.
SELECT cron.schedule(
	'slop-club-referral-grant-expiry',
	'17 0 * * *',
	$$
		UPDATE public.profiles
		SET is_vip = false
		WHERE is_vip = true
		  AND slop_club_grant_until IS NOT NULL
		  AND slop_club_grant_until < now()
		  AND vip_until IS NULL;
	$$
);
