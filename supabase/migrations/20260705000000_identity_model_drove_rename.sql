-- Identity Model rename: resolve the "Sounder" three-way word collision.
--
-- Per docs/wiki/identity-model.md, "Sounder" meant three things. This migration
-- disambiguates the two NON-war-crew meanings (display-name-only; no data moves,
-- no title_id/RPC/column renames). The WAR CREW keeps the word "Sounder".
--   • Referral downline  -> "the Drove"   (titles table + referral toast copy)
--   • Friends graph      -> "Friends"      (trough/item-drive announcement copy)
--   • War crew (Mud Wars) -> unchanged ("Sounder")
--
-- Function bodies are carried VERBATIM from their LATEST definitions with only
-- the target display strings swapped (carry-latest-def):
--   donate_to_drive                -> latest 20260635  (friends copy)
--   update_profile_and_item_count  -> latest 20260683  (referral toast copy)
-- my_referral_summary was audited (20260683) — it contains no "Sounder" copy.

BEGIN;

-- ── 1. Referral titles: "Sounder" -> "Drove" (display name + description only;
--        id/source/order untouched, so existing grants are unaffected). ──────
UPDATE public.titles SET name = 'Drove Initiate'  WHERE id = 'sounder_initiate';
UPDATE public.titles SET name = 'Drove Scout'     WHERE id = 'sounder_scout';
UPDATE public.titles SET name = 'Drove Sovereign', description = 'A whole drove calls you theirs.' WHERE id = 'sounder_sovereign';
UPDATE public.titles SET name = 'Drove Caller',    description = 'Brought 10 friends into the drove.' WHERE id = 'sounder_caller';
UPDATE public.titles SET description = 'The big boar — fifty in your drove.'  WHERE id = 'crown_hog';
UPDATE public.titles SET description = 'Brought 25 friends into the drove.'   WHERE id = 'pen_marshal';
UPDATE public.titles SET description = 'Brought 100 friends into the drove.'  WHERE id = 'pied_piper';
UPDATE public.titles SET description = 'Brought 500 friends into the drove.'  WHERE id = 'patron_of_the_pen';
-- (ambassador, drove_captain, worldbringer, sounder_initiate/scout descriptions had no "sounder" — left as-is.)

-- ── 2. donate_to_drive — carried VERBATIM from 20260635, friends-graph copy only ──
CREATE OR REPLACE FUNCTION public.donate_to_drive(drive_id uuid, snouts int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	d           public.item_drives;
	bal         bigint;
	reward      int;
	now_raised  int;
	item_name   text;
	op_name     text;
	donor_row   record;
	first_today boolean;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF snouts <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_amount');
	END IF;

	SELECT * INTO d FROM public.item_drives WHERE id = drive_id FOR UPDATE;
	IF d.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_drive');
	END IF;
	IF d.status <> 'open' OR d.closes_at <= now() THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'drive_closed');
	END IF;
	IF d.opener_user_id = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');  -- opener seeds via open
	END IF;
	-- Friends-scoped: only the opener's friends can donate.
	IF NOT public.are_friends(caller_id, d.opener_user_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;
	-- Donating cooldown: once every 12 hours PER DRIVE (was global across all
	-- drives — chipping into one friend's Trough locked out every other
	-- friend's for 12h). dd. alias is load-bearing: unqualified drive_id here
	-- is ambiguous against the function parameter (the 20260626 42702 bug).
	IF EXISTS (
		SELECT 1 FROM public.item_drive_donations dd
		WHERE dd.donor_user_id = caller_id
		  AND dd.drive_id = d.id
		  AND dd.created_at > now() - interval '12 hours'
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'donate_cooldown');
	END IF;

	-- Never take more than the remaining gap.
	snouts := LEAST(snouts, d.target_snouts - d.raised_snouts);
	IF snouts <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_funded');
	END IF;

	SELECT counter INTO bal FROM public.profiles WHERE id = caller_id FOR UPDATE;
	IF bal < snouts THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'have', bal, 'need', snouts);
	END IF;

	-- First donation of the UTC day? (checked before this donation's row exists)
	SELECT NOT EXISTS (
		SELECT 1 FROM public.item_drive_donations
		WHERE donor_user_id = caller_id
		  AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
	) INTO first_today;

	UPDATE public.profiles SET counter = counter - snouts WHERE id = caller_id;

	reward := floor(snouts / 10.0);  -- 10 snouts -> 1 tickle (paid out when funded)
	INSERT INTO public.item_drive_donations (drive_id, donor_user_id, snouts, tickle_reward)
		VALUES (drive_id, caller_id, snouts, reward);

	now_raised := d.raised_snouts + snouts;
	UPDATE public.item_drives SET raised_snouts = now_raised WHERE id = drive_id;

	-- Opener-side feedback: every chip-in drops a note into the opener's
	-- WhileAway feed ("Jen chipped in 25 — 1,775 to go"). Funded chips skip
	-- this — the funded announcement below already covers the moment.
	-- (Inline INSERT, never send_system_announcement: admin-gated rollback.)
	IF now_raised < d.target_snouts THEN
		SELECT username INTO op_name FROM public.profiles WHERE id = caller_id;
		SELECT name INTO item_name FROM public.hats WHERE id = d.item_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			d.opener_user_id, 'trough_chip',
			COALESCE(op_name, 'A friend') || ' chipped in!',
			COALESCE(op_name, 'A friend') || ' put ' || snouts || ' snouts in your '
				|| COALESCE(item_name, 'item') || ' Trough — '
				|| (d.target_snouts - now_raised) || ' to go.',
			jsonb_build_object('drive_id', drive_id));
	END IF;

	-- Funded → grant the item to the opener; donor rewards become claimable;
	-- tell the opener + every donor. (Inline INSERTs, not send_system_announcement,
	-- which is admin-gated and would roll back the donation for non-admins.)
	IF now_raised >= d.target_snouts THEN
		UPDATE public.item_drives
			SET status = 'funded', granted_at = now() WHERE id = drive_id;
		INSERT INTO public.user_hats (user_id, hat_id)
			VALUES (d.opener_user_id, d.item_id)
			ON CONFLICT (user_id, hat_id) DO NOTHING;

		SELECT name INTO item_name FROM public.hats WHERE id = d.item_id;
		SELECT username INTO op_name FROM public.profiles WHERE id = d.opener_user_id;

		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			d.opener_user_id, 'trough_funded',
			'Your Trough filled!',
			'Your Friends came through — the ' || COALESCE(item_name, 'item')
				|| ' is yours!',
			jsonb_build_object('drive_id', drive_id));

		FOR donor_row IN
			SELECT DISTINCT dd.donor_user_id FROM public.item_drive_donations dd
			WHERE dd.drive_id = d.id
		LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (
				donor_row.donor_user_id, 'trough_funded',
				'You helped land it!',
				'Thanks to you, ' || COALESCE(op_name, 'a friend') || ' got the '
					|| COALESCE(item_name, 'item') || '. Claim your snouts & score!',
				jsonb_build_object('drive_id', drive_id));
		END LOOP;
	END IF;

	-- Reward the donor's engagement: +5 season XP on the first donation of the day.
	IF first_today THEN PERFORM public.grant_season_xp(caller_id, 5); END IF;

	RETURN jsonb_build_object('ok', true, 'reward', reward,
		'raised', now_raised, 'target', d.target_snouts,
		'funded', now_raised >= d.target_snouts,
		'xp', CASE WHEN first_today THEN 5 ELSE 0 END);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.donate_to_drive(uuid, int) TO authenticated;

-- ── 3. update_profile_and_item_count — carried VERBATIM from 20260683, referral toast only ──
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

	-- ── Referral engagement gate — guarded; a fault here never rolls back the tickle.
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

			-- ── REWARD LADDER ─────────────────────────────────────────────
			-- Each tier fires once, on the exact completion that hits it.
			-- Snouts → counter only. Slop Club → slop_club_grant_until lane.
			IF new_completion_count = 3 THEN
				INSERT INTO public.user_hats (user_id, hat_id)
					VALUES (caller_referred, 'messenger')
					ON CONFLICT (user_id, hat_id) DO NOTHING;
			ELSIF new_completion_count = 5 THEN
				UPDATE public.profiles
					SET is_vip = true,
					    slop_club_grant_until =
					        GREATEST(now(), COALESCE(slop_club_grant_until, now())) + interval '30 days'
					WHERE id = caller_referred;
			ELSIF new_completion_count = 10 THEN
				INSERT INTO public.user_titles (user_id, title_id)
					VALUES (caller_referred, 'sounder_caller') ON CONFLICT (user_id, title_id) DO NOTHING;
				UPDATE public.profiles SET counter = counter + 500 WHERE id = caller_referred;
			ELSIF new_completion_count = 25 THEN
				INSERT INTO public.user_titles (user_id, title_id)
					VALUES (caller_referred, 'pen_marshal') ON CONFLICT (user_id, title_id) DO NOTHING;
				UPDATE public.profiles SET counter = counter + 1500 WHERE id = caller_referred;
			ELSIF new_completion_count = 100 THEN
				INSERT INTO public.user_titles (user_id, title_id)
					VALUES (caller_referred, 'pied_piper') ON CONFLICT (user_id, title_id) DO NOTHING;
				UPDATE public.profiles
					SET is_vip = true,
					    slop_club_grant_until =
					        GREATEST(now(), COALESCE(slop_club_grant_until, now())) + interval '90 days',
					    counter = counter + 5000
					WHERE id = caller_referred;
			ELSIF new_completion_count = 500 THEN
				INSERT INTO public.user_titles (user_id, title_id)
					VALUES (caller_referred, 'patron_of_the_pen') ON CONFLICT (user_id, title_id) DO NOTHING;
				UPDATE public.profiles
					SET is_vip = true,
					    slop_club_grant_until =
					        GREATEST(now(), COALESCE(slop_club_grant_until, now())) + interval '180 days',
					    counter = counter + 20000
					WHERE id = caller_referred;
			ELSIF new_completion_count = 1000 THEN
				INSERT INTO public.user_titles (user_id, title_id)
					VALUES (caller_referred, 'worldbringer') ON CONFLICT (user_id, title_id) DO NOTHING;
				UPDATE public.profiles
					SET is_vip = true,
					    slop_club_grant_until =
					        GREATEST(now(), COALESCE(slop_club_grant_until, now())) + interval '365 days',
					    counter = counter + 100000
					WHERE id = caller_referred;
			END IF;

			-- Inline announcement (NEVER send_system_announcement → admin_only rollback).
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (
				caller_referred, 'referral_completed',
				'Your friend ' || COALESCE(invitee_name, 'a pig') || ' made it!',
				CASE
					WHEN new_completion_count = 1000
						THEN 'Your referral paid out: +100 snouts AND the Worldbringer title, a YEAR of Slop Club, and 100,000 snouts! ★'
					WHEN new_completion_count = 500
						THEN 'Your referral paid out: +100 snouts AND the Patron of the Pen title, 180 days of Slop Club, and 20,000 snouts! ★'
					WHEN new_completion_count = 100
						THEN 'Your referral paid out: +100 snouts AND the Pied Piper title, 90 days of Slop Club, and 5,000 snouts! ★'
					WHEN new_completion_count = 25
						THEN 'Your referral paid out: +100 snouts AND the Pen Marshal title and 1,500 snouts! ★'
					WHEN new_completion_count = 10
						THEN 'Your referral paid out: +100 snouts AND the Drove Caller title and 500 snouts! ★'
					WHEN new_completion_count = 5
						THEN 'Your referral paid out: +100 snouts AND a free month of Slop Club! ★'
					WHEN new_completion_count = 3
						THEN 'Your referral paid out: +100 snouts AND the Messenger Hat!'
					ELSE 'Your referral paid out: +100 snouts.'
				END,
				jsonb_build_object('kind', 'referral_completed', 'screen', 'account')
			);

			BEGIN
				PERFORM public.send_push_to_user(
					caller_referred,
					'Your friend ' || COALESCE(invitee_name, 'a pig') || ' made it!',
					CASE
						WHEN new_completion_count = 1000
							THEN '+100 snouts AND Worldbringer + a year of Slop Club + 100k snouts! Tap to see.'
						WHEN new_completion_count = 500
							THEN '+100 snouts AND Patron of the Pen + 180 days Slop Club + 20k snouts! Tap to see.'
						WHEN new_completion_count = 100
							THEN '+100 snouts AND Pied Piper + 90 days Slop Club + 5k snouts! Tap to see.'
						WHEN new_completion_count = 25
							THEN '+100 snouts AND the Pen Marshal title + 1,500 snouts! Tap to see.'
						WHEN new_completion_count = 10
							THEN '+100 snouts AND the Drove Caller title + 500 snouts! Tap to see.'
						WHEN new_completion_count = 5
							THEN '+100 snouts AND a free month of Slop Club! Tap to see.'
						WHEN new_completion_count = 3
							THEN '+100 snouts AND the Messenger Hat. Tap to see.'
						ELSE '+100 snouts. Tap to see your drove.'
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

COMMIT;
