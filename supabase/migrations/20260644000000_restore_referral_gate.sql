-- Restore the referral engagement gate (BUG: silently dropped) + give the
-- referrer visible feedback (player report: "Cash N was not able to get his
-- rewards" + "we need a more obvious dialogue when the referring user logs in").
--
-- ROOT CAUSE: 20260624 (harden_home_tickle) rebuilt
-- update_profile_and_item_count from a pre-referral base — the engagement
-- gate (invitee hits 100 tickles + 3 active days -> inviter gets +100,
-- referrals_completed++, Messenger Hat at 3, push) AND the daily
-- distinct_active_days bump vanished with it. Since build 93 no referral
-- could ever complete. Restored here as a GUARDED side-effect block,
-- preserving 20260624's never-roll-back-the-tickle structure.
--
-- NEW (the obvious dialogue):
--   1. redeem_referral_code now INSERTs an inline announcement to the
--      INVITER the moment their code is used ("X used your code! Credit
--      lands once they've played a bit") — instant feedback at next launch.
--   2. The completion payout also INSERTs an announcement (it only sent a
--      push before — invisible in-app).
-- Both inline INSERTs, never send_system_announcement (admin-gate footgun).
--
-- Invitees who crossed 100 tickles while the gate was missing complete on
-- their NEXT home tickle (condition is state-based, not event-based); their
-- active-day counts resume from where 20260624 froze them.

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

			-- NEW: inline announcement so the inviter SEES the payoff at
			-- next launch (While-Away/Inbox) — the old gate only pushed.
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (
				caller_referred, 'referral_completed',
				'Your friend ' || COALESCE(invitee_name, 'a pig') || ' made it! 🎉',
				CASE
					WHEN new_completion_count = 3
						THEN 'Your referral paid out: +100 snouts AND the Messenger Hat!'
					ELSE 'Your referral paid out: +100 snouts. ' ||
						 (3 - LEAST(3, new_completion_count)) || ' more for the Messenger Hat.'
				END,
				jsonb_build_object('kind', 'referral_completed', 'screen', 'account')
			);

			BEGIN
				PERFORM public.send_push_to_user(
					caller_referred,
					'Your friend ' || COALESCE(invitee_name, 'a pig') || ' made it!',
					CASE
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

CREATE OR REPLACE FUNCTION public.redeem_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id        uuid := auth.uid();
	caller_referred  uuid;
	caller_created   timestamptz;
	caller_tickles   bigint;
	inviter_id       uuid;
	inviter_name     text;
	normalized       text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	normalized := upper(trim(COALESCE(p_code, '')));
	IF normalized = '' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'code_not_found');
	END IF;

	-- 1. Caller hasn't already redeemed a code.
	SELECT referred_by INTO caller_referred
		FROM public.profiles WHERE id = caller_id;
	IF caller_referred IS NOT NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_redeemed');
	END IF;

	-- 2. The code maps to an actual profile.
	SELECT id, username INTO inviter_id, inviter_name
		FROM public.profiles WHERE referral_code = normalized;
	IF inviter_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'code_not_found');
	END IF;

	-- 3. Self-referral guard.
	IF inviter_id = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
	END IF;

	-- 4. Account is < 24h old.
	SELECT created_at INTO caller_created FROM auth.users WHERE id = caller_id;
	IF caller_created IS NULL OR caller_created < now() - interval '24 hours' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'too_old');
	END IF;

	-- 5. Caller has tickled fewer than 5 times.
	SELECT tickles_earned INTO caller_tickles
		FROM public.profiles WHERE id = caller_id;
	IF COALESCE(caller_tickles, 0) >= 5 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'too_active');
	END IF;

	-- All checks passed: attribute + pay the invitee bonus.
	UPDATE public.profiles
		SET referred_by          = inviter_id,
		    referral_redeemed_at = now(),
		    counter              = counter + 50
		WHERE id = caller_id;

	-- NEW: tell the INVITER right away (inline announcement -> While-Away
	-- at next launch + Inbox). Without this the referrer saw nothing until
	-- the engagement gate paid out days later — which read as "broken".
	-- Guarded: announcement faults must never roll back the redeem.
	BEGIN
		DECLARE caller_name text;
		BEGIN
			SELECT username INTO caller_name FROM public.profiles WHERE id = caller_id;
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (
				inviter_id, 'referral_redeemed',
				COALESCE(caller_name, 'A new pig') || ' used your code! 🐽',
				'They''re in your sounder now. Your +100 snout credit lands once they''ve played a bit (100 tickles + 3 days).',
				jsonb_build_object('kind', 'referral_redeemed', 'screen', 'account')
			);
		END;
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;

	RETURN jsonb_build_object(
		'ok', true,
		'inviter_username', inviter_name
	);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.redeem_referral_code(text) TO authenticated;
